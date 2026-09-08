/**
 * The evaluation harness.
 *
 * Serves the fixture corpus locally, audits it, and scores the result against
 * the labelled ground truth. This exists so the product can state an accuracy
 * figure it has measured, rather than asking anyone to trust it.
 *
 * Run:  npx tsx eval/run.ts [--provider groq|anthropic|none] [--batch-size N] [--delay MS]
 */

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

try {
  process.loadEnvFile('.env');
} catch {
  // Deterministic-only evaluation still works without a key.
}

import { audit } from '../src/audit';
import {
  AnthropicJudgementProvider,
  GroqJudgementProvider,
  NullJudgementProvider,
} from '../src/detect/providers';
import type { JudgementProvider } from '../src/detect/judgement';
import type { Finding } from '../src/core/types';
import { FIXTURES, heldOutFixtures, tuningFixtures, type ExpectedDefect } from './ground-truth';

const here = dirname(fileURLToPath(import.meta.url));
const PORT = 8477;

async function serveFixtures() {
  const server = createServer(async (req, res) => {
    const name = (req.url ?? '/').replace(/^\//, '').split('?')[0] || 'index.html';
    try {
      const body = await readFile(join(here, 'fixtures', name));
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(body);
    } catch {
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('not found');
    }
  });
  await new Promise<void>((resolve) => server.listen(PORT, resolve));
  return server;
}

/** A finding is about an element if the captured markup carries that id. */
function findingTargets(finding: Finding, elementId: string): boolean {
  const html = finding.element.html ?? '';
  const selector = finding.element.selector ?? '';
  return html.includes(`id="${elementId}"`) || selector.includes(`#${elementId}`);
}

function chooseProvider(name: string | undefined): JudgementProvider {
  if (name === 'anthropic') return new AnthropicJudgementProvider({ model: process.env.ANTHROPIC_MODEL });
  if (name === 'none') return new NullJudgementProvider();
  if (process.env.GROQ_API_KEY) return new GroqJudgementProvider();
  return new NullJudgementProvider();
}

interface Scored {
  defect: ExpectedDefect;
  file: string;
  found: boolean;
  foundBy?: Finding['source'];
}

async function main() {
  const argv = process.argv.slice(2);
  const arg = (flag: string) => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const provider = chooseProvider(arg('--provider'));
  const split = argv.includes('--held-out') ? 'held-out' : argv.includes('--tuning') ? 'tuning' : 'all';
  const FIXTURE_SET =
    split === 'held-out' ? heldOutFixtures() : split === 'tuning' ? tuningFixtures() : FIXTURES;
  const distractorSet = new Set(FIXTURE_SET.flatMap((f) => f.distractors));
  const batchSize = arg('--batch-size') ? Number(arg('--batch-size')) : 22;
  const delayMs = arg('--delay') ? Number(arg('--delay')) : 33_000;

  const server = await serveFixtures();
  console.log(`\nAuditable evaluation`);
  console.log(`corpus: ${split} split, ${FIXTURE_SET.length} page(s), ${FIXTURE_SET.flatMap((f) => f.defects).length} planted defects, ${distractorSet.size} distractors`);
  console.log(`provider: ${provider.name}\n`);

  try {
    const urls = FIXTURE_SET.map((f) => `http://127.0.0.1:${PORT}/${f.file}`);
    const result = await audit({
      urls,
      provider,
      batchSize,
      judgementDelayMs: delayMs,
      onProgress: (m) => console.log(m),
    });

    // --- Recall -------------------------------------------------------------
    const scored: Scored[] = [];
    for (const fixture of FIXTURE_SET) {
      const pageUrl = `http://127.0.0.1:${PORT}/${fixture.file}`;
      const pageFindings = result.findings.filter((f) => f.pageUrl === pageUrl);
      for (const defect of fixture.defects) {
        const acceptable = new Set([defect.criterionId, ...(defect.alsoAcceptable ?? [])]);
        const hit = pageFindings.find(
          (f) => acceptable.has(f.criterionId) && findingTargets(f, defect.elementId),
        );
        scored.push({ defect, file: fixture.file, found: !!hit, foundBy: hit?.source });
      }
    }

    // --- Precision ----------------------------------------------------------
    const distractors = distractorSet;
    const falsePositives: Finding[] = [];
    const onKnownDefect: Finding[] = [];
    const other: Finding[] = [];

    const defectIds = new Set(FIXTURE_SET.flatMap((f) => f.defects.map((d) => d.elementId)));
    for (const finding of result.findings) {
      const hitsDistractor = [...distractors].some((id) => findingTargets(finding, id));
      const hitsDefect = [...defectIds].some((id) => findingTargets(finding, id));
      if (hitsDistractor) falsePositives.push(finding);
      else if (hitsDefect) onKnownDefect.push(finding);
      else other.push(finding);
    }

    // --- Report -------------------------------------------------------------
    const judgementDefects = scored.filter((s) => s.defect.expectedFrom === 'judgement');
    const eitherDefects = scored.filter((s) => s.defect.expectedFrom === 'either');

    const pct = (n: number, d: number) => (d === 0 ? 'n/a' : `${Math.round((n / d) * 100)}%`);

    console.log(`\n--- Recall: defects only the judgement pass can catch ---`);
    for (const s of judgementDefects) {
      console.log(
        `  ${s.found ? 'FOUND  ' : 'MISSED '} ${s.defect.criterionId}  ${s.defect.elementId}${s.foundBy ? `  (${s.foundBy})` : ''}`,
      );
    }
    const jFound = judgementDefects.filter((s) => s.found).length;
    console.log(`  ${jFound}/${judgementDefects.length} = ${pct(jFound, judgementDefects.length)}`);

    console.log(`\n--- Recall: defects either pass could catch ---`);
    for (const s of eitherDefects) {
      console.log(
        `  ${s.found ? 'FOUND  ' : 'MISSED '} ${s.defect.criterionId}  ${s.defect.elementId}${s.foundBy ? `  (${s.foundBy})` : ''}`,
      );
    }
    const eFound = eitherDefects.filter((s) => s.found).length;
    console.log(`  ${eFound}/${eitherDefects.length} = ${pct(eFound, eitherDefects.length)}`);

    console.log(`\n--- Precision ---`);
    console.log(`  findings on a planted defect : ${onKnownDefect.length}`);
    console.log(`  findings on a distractor     : ${falsePositives.length}   <- false positives`);
    console.log(`  findings elsewhere           : ${other.length}`);
    if (falsePositives.length > 0) {
      console.log(`\n  False positives in detail:`);
      for (const f of falsePositives) {
        console.log(`    ${f.criterionId} (${f.source}) ${f.element.selector}`);
        console.log(`      ${f.summary}`);
      }
    }
    if (other.length > 0) {
      console.log(`\n  Findings on unlabelled elements (inspect these, they may be real or noise):`);
      for (const f of other.slice(0, 15)) {
        console.log(`    ${f.criterionId} (${f.source}) ${f.element.selector}: ${f.summary}`);
      }
    }

    console.log(`\n--- Verification ---`);
    console.log(`  claims rejected as unsubstantiated: ${result.rejected.length}`);
    for (const r of result.rejected.slice(0, 10)) {
      console.log(`    ${r.criterionId}: ${r.reason}`);
    }

    const totalFound = scored.filter((s) => s.found).length;
    console.log(`\n--- Summary ---`);
    console.log(`  overall recall     ${totalFound}/${scored.length} = ${pct(totalFound, scored.length)}`);
    console.log(`  judgement recall   ${jFound}/${judgementDefects.length} = ${pct(jFound, judgementDefects.length)}`);
    console.log(`  false positives    ${falsePositives.length} on ${distractors.size} distractors`);
  } finally {
    server.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
