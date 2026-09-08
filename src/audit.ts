/**
 * Audit orchestration.
 *
 * Order matters. The deterministic pass runs first so the judgement pass can be
 * told what is already settled, and so verification has a guard rail to reject
 * model claims that contradict it.
 *
 * Coverage is computed last, and it is the honest part of the report. A
 * criterion with no findings is not thereby a pass. It is a pass only where a
 * rule engine can fully decide it and did. Everything else is reported as
 * not tested or as needing a human, because that is what it is.
 */

import { chromium, type Browser } from 'playwright';
import { CRITERIA, automationCoverage, getCriterion } from './core/wcag';
import { capturePage } from './capture/snapshot';
import { CaptureIntegrityError, checkIntegrity } from './capture/integrity';
import { discoverPages } from './capture/crawl';
import { runDeterministic } from './detect/deterministic';
import { verifyClaims } from './detect/verify';
import { NullJudgementProvider } from './detect/providers';
import { judgeInBatches, type JudgementProvider } from './detect/judgement';
import type {
  AuditResult,
  CriterionCoverage,
  Finding,
  PageAudit,
  RejectedFinding,
} from './core/types';

export interface AuditOptions {
  /** Pages to audit. With `crawl` set, the first is the starting point. */
  urls: string[];
  /**
   * Discover up to this many pages from the first URL, honouring robots.txt.
   * Omit to audit only the URLs given.
   */
  crawl?: number;
  /** Courtesy pause between page requests, in milliseconds. */
  politenessMs?: number;
  provider?: JudgementProvider;
  screenshot?: boolean;
  /** Elements sent to the judgement provider per request. */
  batchSize?: number;
  /** Pause between judgement batches, to respect per-minute token budgets. */
  judgementDelayMs?: number;
  /** Called with progress messages, so the CLI can report without this module printing. */
  onProgress?: (message: string) => void;
}

export async function audit(options: AuditOptions): Promise<AuditResult> {
  const provider = options.provider ?? new NullJudgementProvider();
  const log = options.onProgress ?? (() => {});
  const startedAt = new Date().toISOString();

  const findings: Finding[] = [];
  const rejected: RejectedFinding[] = [];
  const pages: PageAudit[] = [];
  const failures: { url: string; reason: string }[] = [];
  const cleanAcrossSite = new Set<string>();
  const incompleteAcrossSite = new Set<string>();

  let browser: Browser | undefined;
  try {
    browser = await chromium.launch();
    // Deliberately no user-agent override. Spoofing one makes the client look
    // less consistent, not more, and reliably trips bot challenges: an early
    // version of this file set a desktop Chrome UA and ended up auditing
    // Cloudflare's "Just a moment..." page. See capture/integrity.ts.
    const context = await browser.newContext();

    let targets = options.urls;
    if (options.crawl && options.crawl > 0 && options.urls[0]) {
      log(`Discovering up to ${options.crawl} page(s) from ${options.urls[0]}`);
      const discovered = await discoverPages(browser, options.urls[0], {
        maxPages: options.crawl,
        politenessMs: options.politenessMs,
        onProgress: log,
      });
      targets = discovered.urls;
      log(`  ${targets.length} page(s) to audit`);
      if (discovered.skipped.length > 0) {
        log(`  ${discovered.skipped.length} url(s) skipped because robots.txt disallows them`);
      }
    }

    for (const [pageIndex, url] of targets.entries()) {
      const page = await context.newPage();
      try {
        log(`Capturing ${url}`);
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
        const snapshot = await capturePage(page, { screenshot: options.screenshot });

        // Never audit a page we cannot show is the real page.
        const problems = checkIntegrity(snapshot);
        if (problems.length > 0) throw new CaptureIntegrityError(url, problems);

        log(`  running rule engine`);
        const deterministic = await runDeterministic(page, snapshot);
        findings.push(...deterministic.findings);
        for (const id of deterministic.clean) cleanAcrossSite.add(id);
        for (const id of deterministic.incomplete) incompleteAcrossSite.add(id);

        let pageFindingCount = deterministic.findings.length;

        if (provider.name !== 'none') {
          log(`  running judgement pass via ${provider.name}`);
          const { claims, batchesRun, batchesFailed } = await judgeInBatches(
            provider,
            { snapshot, settledCriteria: deterministic.clean },
            {
              batchSize: options.batchSize,
              delayMs: options.judgementDelayMs,
              onProgress: log,
            },
          );
          if (batchesFailed > 0) {
            log(`  warning: ${batchesFailed} of ${batchesRun} batches failed; this page was only partly judged`);
          }
          const outcome = verifyClaims(claims, {
            snapshot,
            deterministicallyClean: deterministic.clean,
            existingFindings: deterministic.findings,
          });
          findings.push(...outcome.accepted);
          rejected.push(...outcome.rejected);
          pageFindingCount += outcome.accepted.length;
          log(
            `  ${outcome.accepted.length} verified, ${outcome.rejected.length} rejected as unsubstantiated`,
          );
        }

        pages.push({ url: snapshot.url, title: snapshot.title, findingCount: pageFindingCount });
      } catch (error) {
        // One unreachable or challenged page must not lose the whole audit; the
        // failure is recorded so the report can say which pages went untested.
        const reason = (error as Error).message.split(/\r?\n/)[0] ?? String(error);
        failures.push({ url, reason });
        log(`  skipped: ${reason}`);
      } finally {
        await page.close();
        if (pageIndex < targets.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, options.politenessMs ?? 700));
        }
      }
    }
  } finally {
    await browser?.close();
  }

  const coverage = computeCoverage(findings, cleanAcrossSite, incompleteAcrossSite);

  return {
    siteUrl: options.urls[0] ?? '',
    startedAt,
    finishedAt: new Date().toISOString(),
    pages,
    failures,
    findings,
    rejected,
    coverage,
    stats: {
      pagesAudited: pages.length,
      deterministicFindings: findings.filter((f) => f.source === 'deterministic').length,
      judgementFindings: findings.filter((f) => f.source === 'judgement').length,
      rejectedJudgements: rejected.length,
      criteriaTestedAutomatically: automationCoverage().full,
      criteriaRequiringHumanReview: coverage.filter((c) => c.status === 'needs-human-review').length,
    },
  };
}

export function computeCoverage(
  findings: Finding[],
  clean: Set<string>,
  incomplete: Set<string>,
): CriterionCoverage[] {
  const byCriterion = new Map<string, number>();
  for (const f of findings) {
    byCriterion.set(f.criterionId, (byCriterion.get(f.criterionId) ?? 0) + 1);
  }

  return CRITERIA.map((criterion) => {
    const count = byCriterion.get(criterion.id) ?? 0;
    const base = {
      criterionId: criterion.id,
      name: criterion.name,
      level: criterion.level,
      findingCount: count,
    };

    if (count > 0) {
      return { ...base, status: 'fail' as const, note: `${count} finding(s) recorded.` };
    }
    if (criterion.automation === 'full' && clean.has(criterion.id)) {
      return {
        ...base,
        status: 'pass' as const,
        note: 'Fully decidable by the rule engine, which found no violation.',
      };
    }
    if (criterion.automation === 'none') {
      return {
        ...base,
        status: 'needs-human-review' as const,
        note: `No automated or model check can settle this. ${getCriterion(criterion.id)?.question ?? ''}`,
      };
    }
    if (incomplete.has(criterion.id)) {
      return {
        ...base,
        status: 'not-tested' as const,
        note: 'The rule engine flagged instances it could not decide; a human must review them.',
      };
    }
    return {
      ...base,
      status: 'not-tested' as const,
      note:
        'Partly automatable. Nothing was found, but absence of findings is not a pass for this criterion.',
    };
  });
}
