import { describe, expect, it } from 'vitest';
import { canonicalise, isAllowed, isSameSite, parseRobots } from './crawl';

describe('parsing robots.txt', () => {
  it('reads the wildcard group', () => {
    const rules = parseRobots(`
User-agent: *
Disallow: /admin/
Disallow: /cart
Crawl-delay: 2
Sitemap: https://example.test/sitemap.xml
`);
    expect(rules.disallow).toEqual(['/admin/', '/cart']);
    expect(rules.crawlDelaySeconds).toBe(2);
    expect(rules.sitemaps).toEqual(['https://example.test/sitemap.xml']);
  });

  it('prefers a group naming us over the wildcard group', () => {
    const rules = parseRobots(`
User-agent: *
Disallow: /

User-agent: auditable
Disallow: /private/
`);
    // The wildcard bans everything; our own group does not. Only ours applies.
    expect(rules.disallow).toEqual(['/private/']);
    expect(isAllowed('/products', rules)).toBe(true);
  });

  it('treats consecutive user-agent lines as one group', () => {
    const rules = parseRobots(`
User-agent: googlebot
User-agent: auditable
Disallow: /secret/
`);
    expect(rules.disallow).toEqual(['/secret/']);
  });

  it('treats an empty Disallow as permitting everything', () => {
    const rules = parseRobots('User-agent: *\nDisallow:\n');
    expect(rules.disallow).toEqual([]);
    expect(isAllowed('/anything', rules)).toBe(true);
  });

  it('ignores comments and blank lines', () => {
    const rules = parseRobots(`
# a comment
User-agent: *   # trailing comment
Disallow: /tmp/
`);
    expect(rules.disallow).toEqual(['/tmp/']);
  });

  it('collects sitemaps regardless of which group they follow', () => {
    const rules = parseRobots(`
Sitemap: https://a.test/one.xml
User-agent: *
Disallow: /x
Sitemap: https://a.test/two.xml
`);
    expect(rules.sitemaps).toHaveLength(2);
  });

  it('survives a file with no groups at all', () => {
    expect(parseRobots('').disallow).toEqual([]);
    expect(parseRobots('nonsense').disallow).toEqual([]);
  });
});

describe('deciding whether a path may be fetched', () => {
  const rules = parseRobots(`
User-agent: *
Disallow: /shop/
Allow: /shop/public/
Disallow: /
Allow: /catalogue
`);

  it('blocks a disallowed prefix', () => {
    expect(isAllowed('/shop/orders', rules)).toBe(false);
  });

  it('lets a longer Allow override a shorter Disallow', () => {
    expect(isAllowed('/shop/public/lookbook', rules)).toBe(true);
  });

  it('applies a blanket disallow to unmatched paths', () => {
    expect(isAllowed('/anything-else', rules)).toBe(false);
  });

  it('honours an Allow carved out of a blanket disallow', () => {
    expect(isAllowed('/catalogue/mugs', rules)).toBe(true);
  });

  it('permits everything when there are no rules', () => {
    expect(isAllowed('/admin', { disallow: [], allow: [], sitemaps: [] })).toBe(true);
  });
});

describe('canonicalising urls for de-duplication', () => {
  it('drops fragments, queries and trailing slashes', () => {
    expect(canonicalise('https://a.test/p/?utm=x#top')).toBe('https://a.test/p');
    expect(canonicalise('https://a.test/p')).toBe('https://a.test/p');
  });

  it('keeps the root path intact', () => {
    expect(canonicalise('https://a.test/')).toBe('https://a.test/');
  });

  it('treats the same page reached two ways as one page', () => {
    expect(canonicalise('https://a.test/about/#team')).toBe(canonicalise('https://a.test/about?ref=nav'));
  });

  it('collapses www so one homepage is not audited twice', () => {
    // A real crawl audited the bare host and the www host as two pages, which
    // would have reported every defect on that page twice.
    expect(canonicalise('https://www.a.test/')).toBe(canonicalise('https://a.test/'));
    expect(canonicalise('https://WWW.A.test/x')).toBe(canonicalise('https://a.test/x'));
  });
});

describe('deciding whether a url belongs to the same site', () => {
  it('treats www and the bare host as one site', () => {
    // A real audit found 1 page instead of 323 because these compared unequal.
    expect(isSameSite('https://example.test/', 'https://www.example.test/about')).toBe(true);
    expect(isSameSite('https://www.example.test/', 'https://example.test/about')).toBe(true);
  });

  it('still rejects a genuinely different host', () => {
    expect(isSameSite('https://example.test/', 'https://cdn.example.test/x')).toBe(false);
    expect(isSameSite('https://example.test/', 'https://other.test/')).toBe(false);
  });

  it('does not cross protocols', () => {
    expect(isSameSite('https://example.test/', 'http://example.test/x')).toBe(false);
  });

  it('is case insensitive on the host', () => {
    expect(isSameSite('https://Example.Test/', 'https://example.test/x')).toBe(true);
  });

  it('returns false rather than throwing on rubbish', () => {
    expect(isSameSite('not a url', 'https://example.test/')).toBe(false);
  });
});
