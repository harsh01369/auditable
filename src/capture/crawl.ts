/**
 * Page discovery.
 *
 * A conformance audit is of a service, not of a URL, so the tool has to find
 * the pages that matter. It does that politely: robots.txt is honoured, any
 * crawl-delay is obeyed, requests are serialised with a courtesy pause, and the
 * crawl never leaves the origin it was pointed at.
 *
 * This is not merely good manners. We are asking businesses to trust a stranger
 * to inspect their site and to tell them the truth about it. Ignoring the file
 * whose entire purpose is to say "please do not fetch this" would be a poor
 * opening argument.
 */

import type { Browser } from 'playwright';

export interface RobotsRules {
  /** Path prefixes disallowed for our user agent. */
  disallow: string[];
  /** Path prefixes explicitly allowed, which override a longer disallow. */
  allow: string[];
  /** Seconds to wait between requests, if the site asks. */
  crawlDelaySeconds?: number;
  sitemaps: string[];
}

export const EMPTY_ROBOTS: RobotsRules = { disallow: [], allow: [], sitemaps: [] };

/**
 * Parse robots.txt for a given user-agent token.
 *
 * Groups are matched most-specific-first: a group naming our token wins over
 * the wildcard group, and only the winning group's rules apply, which is what
 * the standard requires and what most naive parsers get wrong.
 */
export function parseRobots(text: string, userAgent = 'auditable'): RobotsRules {
  const lines = text.split(/\r?\n/);
  const groups: { agents: string[]; disallow: string[]; allow: string[]; delay?: number }[] = [];
  const sitemaps: string[] = [];

  let current: (typeof groups)[number] | null = null;
  let lastWasAgent = false;

  for (const raw of lines) {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) continue;
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const field = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();

    if (field === 'sitemap') {
      sitemaps.push(value);
      continue;
    }

    if (field === 'user-agent') {
      // Consecutive user-agent lines share one group of rules.
      if (!current || !lastWasAgent) {
        current = { agents: [], disallow: [], allow: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }

    lastWasAgent = false;
    if (!current) continue;
    if (field === 'disallow') current.disallow.push(value);
    else if (field === 'allow') current.allow.push(value);
    else if (field === 'crawl-delay') {
      const n = Number(value);
      if (Number.isFinite(n) && n >= 0) current.delay = n;
    }
  }

  const token = userAgent.toLowerCase();
  const specific = groups.find((g) => g.agents.some((a) => a !== '*' && token.includes(a)));
  const wildcard = groups.find((g) => g.agents.includes('*'));
  const chosen = specific ?? wildcard;
  if (!chosen) return { ...EMPTY_ROBOTS, sitemaps };

  return {
    // An empty Disallow value means "nothing is disallowed"; drop it.
    disallow: chosen.disallow.filter((p) => p !== ''),
    allow: chosen.allow.filter((p) => p !== ''),
    crawlDelaySeconds: chosen.delay,
    sitemaps,
  };
}

/** Whether a path may be fetched. The longest matching rule wins; Allow breaks ties. */
export function isAllowed(pathname: string, rules: RobotsRules): boolean {
  const longest = (patterns: string[]) =>
    patterns
      .filter((p) => pathname.startsWith(p))
      .reduce((best, p) => (p.length > best ? p.length : best), -1);

  const deny = longest(rules.disallow);
  if (deny === -1) return true;
  const permit = longest(rules.allow);
  return permit >= deny;
}

export async function fetchRobots(origin: string, userAgent = 'auditable'): Promise<RobotsRules> {
  try {
    const response = await fetch(new URL('/robots.txt', origin), {
      headers: { 'user-agent': userAgent },
    });
    if (!response.ok) return EMPTY_ROBOTS;
    return parseRobots(await response.text(), userAgent);
  } catch {
    // No robots.txt, or unreachable. Absence is permission.
    return EMPTY_ROBOTS;
  }
}

const NON_PAGE = /\.(pdf|zip|jpe?g|png|gif|svg|webp|avif|ico|css|js|mp4|webm|mp3|woff2?|ttf|xml|json)$/i;

/**
 * Whether two URLs belong to the same site.
 *
 * A strict origin comparison is wrong here. Sites routinely redirect between
 * the bare host and the www subdomain, and a sitemap almost always lists the
 * canonical form. Comparing origins literally meant a real site with 323 pages
 * in its sitemap yielded exactly one page to audit, because the start URL had
 * no www and every sitemap entry did.
 */
export function isSameSite(a: string, b: string): boolean {
  try {
    const ua = new URL(a);
    const ub = new URL(b);
    if (ua.protocol !== ub.protocol) return false;
    const host = (u: URL) => u.hostname.replace(/^www\./i, '').toLowerCase();
    return host(ua) === host(ub);
  } catch {
    return false;
  }
}

/**
 * Normalise a URL for de-duplication: drop the fragment, the query, any
 * trailing slash, and a leading www.
 *
 * The www must go for the same reason `isSameSite` ignores it. Without this the
 * crawler audited one homepage twice, once bare and once with www, and would
 * have reported every defect on it twice.
 */
export function canonicalise(url: string): string {
  const u = new URL(url);
  u.hash = '';
  u.search = '';
  u.hostname = u.hostname.replace(/^www\./i, '').toLowerCase();
  if (u.pathname.length > 1 && u.pathname.endsWith('/')) u.pathname = u.pathname.slice(0, -1);
  return u.toString();
}

export interface CrawlOptions {
  maxPages: number;
  /** Courtesy pause between requests, in milliseconds. Raised by crawl-delay. */
  politenessMs?: number;
  onProgress?: (message: string) => void;
}

/** Read a sitemap and return the page URLs it lists, following one level of index. */
export async function urlsFromSitemap(sitemapUrl: string, depth = 0): Promise<string[]> {
  if (depth > 1) return [];
  try {
    const response = await fetch(sitemapUrl, { headers: { 'user-agent': 'auditable' } });
    if (!response.ok) return [];
    const xml = await response.text();

    const nested = [...xml.matchAll(/<sitemap>[\s\S]*?<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]!);
    if (nested.length > 0) {
      const batches = await Promise.all(nested.slice(0, 5).map((u) => urlsFromSitemap(u, depth + 1)));
      return batches.flat();
    }
    return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]!);
  } catch {
    return [];
  }
}

/**
 * Discover pages to audit, preferring the site's own sitemap and falling back
 * to a breadth-first walk of same-origin links.
 */
export async function discoverPages(
  browser: Browser,
  startUrl: string,
  options: CrawlOptions,
): Promise<{ urls: string[]; robots: RobotsRules; skipped: string[] }> {
  const log = options.onProgress ?? (() => {});
  const origin = new URL(startUrl).origin;
  const robots = await fetchRobots(origin);
  const politeness = Math.max(
    options.politenessMs ?? 700,
    (robots.crawlDelaySeconds ?? 0) * 1000,
  );
  if (robots.crawlDelaySeconds) {
    log(`  robots.txt requests a ${robots.crawlDelaySeconds}s crawl delay; honouring it`);
  }

  const skipped: string[] = [];
  const accept = (url: string) => {
    if (!isSameSite(origin, url)) return false;
    if (NON_PAGE.test(new URL(url).pathname)) return false;
    if (!isAllowed(new URL(url).pathname, robots)) {
      skipped.push(url);
      return false;
    }
    return true;
  };

  const found = new Set<string>();
  if (accept(canonicalise(startUrl))) found.add(canonicalise(startUrl));

  // Prefer the sitemap: it is the site's own statement of what matters.
  for (const sitemap of robots.sitemaps.length > 0 ? robots.sitemaps : [`${origin}/sitemap.xml`]) {
    if (found.size >= options.maxPages) break;
    const urls = await urlsFromSitemap(sitemap);
    if (urls.length > 0) log(`  sitemap ${sitemap}: ${urls.length} url(s)`);
    for (const url of urls) {
      if (found.size >= options.maxPages) break;
      try {
        const c = canonicalise(url);
        if (accept(c)) found.add(c);
      } catch {
        // Malformed entry in someone else's sitemap is not our problem.
      }
    }
  }

  if (found.size >= options.maxPages) {
    return { urls: [...found].slice(0, options.maxPages), robots, skipped };
  }

  // Fall back to walking links from the start page.
  const context = await browser.newContext();
  const queue = [canonicalise(startUrl)];
  const visited = new Set<string>();
  try {
    while (queue.length > 0 && found.size < options.maxPages) {
      const url = queue.shift()!;
      if (visited.has(url)) continue;
      visited.add(url);

      const page = await context.newPage();
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
        const hrefs = await page.evaluate(
          'Array.from(document.querySelectorAll("a[href]")).map((a) => a.href)',
        );
        for (const href of hrefs as string[]) {
          if (found.size >= options.maxPages) break;
          try {
            const c = canonicalise(href);
            if (accept(c)) {
              found.add(c);
              if (!visited.has(c)) queue.push(c);
            }
          } catch {
            // Not a URL we can parse; ignore it.
          }
        }
      } catch {
        log(`  could not read links from ${url}`);
      } finally {
        await page.close();
      }
      await new Promise((resolve) => setTimeout(resolve, politeness));
    }
  } finally {
    await context.close();
  }

  return { urls: [...found].slice(0, options.maxPages), robots, skipped };
}
