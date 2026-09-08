/**
 * Command line entry point.
 *
 * Usage:
 *   tsx src/cli.ts <url> [more urls...] [--provider anthropic|groq|none] [--json out.json] [--screenshot]
 */

import { writeFileSync } from 'node:fs';
import { audit } from './audit';
import { renderReport } from './report/render';

// Load .env if present. Keys stay on disk and out of the shell history.
try {
  process.loadEnvFile('.env');
} catch {
  // No .env is fine: the audit falls back to the deterministic pass alone.
}

import { automationCoverage } from './core/wcag';
import {
  AnthropicJudgementProvider,
  GroqJudgementProvider,
  NullJudgementProvider,
  providerFromEnv,
} from './detect/providers';
import type { JudgementProvider } from './detect/judgement';

function parseArgs(argv: string[]) {
  const urls: string[] = [];
  let providerName: string | undefined;
  let json: string | undefined;
  let screenshot = false;
  let report: string | undefined;
  let crawl: number | undefined;
  let batchSize: number | undefined;
  let delayMs: number | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === '--provider') providerName = argv[++i];
    else if (arg === '--json') json = argv[++i];
    else if (arg === '--screenshot') screenshot = true;
    else if (arg === '--report') report = argv[++i];
    else if (arg === '--crawl') crawl = Number(argv[++i]);
    else if (arg === '--batch-size') batchSize = Number(argv[++i]);
    else if (arg === '--delay') delayMs = Number(argv[++i]);
    else if (!arg.startsWith('--')) urls.push(arg);
  }
  return { urls, providerName, json, report, screenshot, crawl, batchSize, delayMs };
}

function chooseProvider(name?: string): JudgementProvider {
  switch (name) {
    case 'anthropic':
      return new AnthropicJudgementProvider({ model: process.env.ANTHROPIC_MODEL });
    case 'groq':
      return new GroqJudgementProvider();
    case 'none':
      return new NullJudgementProvider();
    default:
      return providerFromEnv();
  }
}

async function main() {
  const { urls, providerName, json, report, screenshot, crawl, batchSize, delayMs } = parseArgs(process.argv.slice(2));
  if (urls.length === 0) {
    console.error('Usage: tsx src/cli.ts <url> [...] [--provider anthropic|groq|none] [--json out.json]');
    process.exit(1);
  }

  const provider = chooseProvider(providerName);
  const cov = automationCoverage();

  console.log(`\nAuditable`);
  console.log(`WCAG 2.2 A and AA as adopted by EN 301 549. ${cov.total} criteria in scope.`);
  console.log(
    `Of those, ${cov.full} are fully decidable by a rule engine, ${cov.partial} partly, and ${cov.none} not at all.`,
  );
  console.log(`Judgement provider: ${provider.name}\n`);

  const result = await audit({
    urls,
    provider,
    crawl,
    screenshot,
    batchSize,
    judgementDelayMs: delayMs,
    onProgress: (m) => console.log(m),
  });

  console.log(`\n--- Findings ---`);
  if (result.findings.length === 0) {
    console.log('No findings recorded.');
  }
  for (const f of result.findings) {
    const tag = f.source === 'deterministic' ? 'ENGINE' : f.source === 'judgement' ? 'JUDGED' : 'REVIEW';
    console.log(`\n[${tag}] ${f.criterionId}  ${f.severity.toUpperCase()}  ${f.summary}`);
    console.log(`  at ${f.element.selector}`);
    console.log(`  ${f.element.html.replace(/\s+/g, ' ').slice(0, 160)}`);
    if (f.source !== 'deterministic') console.log(`  reasoning: ${f.reasoning.slice(0, 300)}`);
    if (f.suggestedFix) console.log(`  fix: ${f.suggestedFix.replace(/\s+/g, ' ').slice(0, 200)}`);
  }

  if (result.rejected.length > 0) {
    console.log(`\n--- Rejected as unsubstantiated (${result.rejected.length}) ---`);
    for (const r of result.rejected) {
      console.log(`  ${r.criterionId} at ${r.claimedSelector}: ${r.reason}`);
    }
  }

  if (result.failures.length > 0) {
    console.log(`
--- Pages that could not be audited (${result.failures.length}) ---`);
    for (const f of result.failures) console.log(`  ${f.url}
    ${f.reason}`);
  }

  const failed = result.coverage.filter((c) => c.status === 'fail').length;
  const passed = result.coverage.filter((c) => c.status === 'pass').length;
  const human = result.coverage.filter((c) => c.status === 'needs-human-review').length;
  const untested = result.coverage.filter((c) => c.status === 'not-tested').length;

  console.log(`\n--- Coverage ---`);
  console.log(`  failed:              ${failed}`);
  console.log(`  passed:              ${passed}`);
  console.log(`  needs human review:  ${human}`);
  console.log(`  not tested:          ${untested}`);
  console.log(
    `\n${result.stats.deterministicFindings} engine findings, ${result.stats.judgementFindings} verified judgements, ${result.stats.rejectedJudgements} rejected.`,
  );
  console.log(
    `\nNote: a criterion with no findings is not a pass. Only ${passed} of ${result.coverage.length} criteria were positively established.`,
  );

  if (json) {
    writeFileSync(json, JSON.stringify(result, null, 2));
    console.log(`\nFull result written to ${json}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
