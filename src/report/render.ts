/**
 * The evidence pack.
 *
 * This is the artefact a business hands to a developer to fix, and to a lawyer
 * to demonstrate that it acted. It is therefore written to be checked rather
 * than believed: every finding shows the element, the markup as served, the
 * success criterion and the EN 301 549 clause, and says how it was arrived at.
 *
 * It also publishes what was rejected. A report that quietly discards a model's
 * bad guesses looks identical to one that never made any, and the difference
 * matters to anyone deciding how much to trust it.
 */

import { automationCoverage, getCriterion } from '../core/wcag';
import { buildAccessibilityStatement, conformanceStatus, type StatementInputs } from './statement';
import type { AuditResult, Finding, Severity } from '../core/types';

const SEVERITY_ORDER: Record<Severity, number> = {
  blocker: 0,
  serious: 1,
  moderate: 2,
  minor: 3,
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sourceLabel(finding: Finding): string {
  switch (finding.source) {
    case 'deterministic':
      return 'Rule engine';
    case 'judgement':
      return 'Reviewed judgement';
    case 'needs-human-review':
      return 'Flagged for human review';
  }
}

export function renderReport(result: AuditResult, inputs: StatementInputs = {}): string {
  const cov = automationCoverage();
  const status = conformanceStatus(result);
  const date = result.finishedAt.slice(0, 10);

  const byCriterion = new Map<string, Finding[]>();
  for (const f of result.findings) {
    const list = byCriterion.get(f.criterionId) ?? [];
    list.push(f);
    byCriterion.set(f.criterionId, list);
  }
  const orderedCriteria = [...byCriterion.entries()].sort((a, b) => {
    const sa = Math.min(...a[1].map((f) => SEVERITY_ORDER[f.severity]));
    const sb = Math.min(...b[1].map((f) => SEVERITY_ORDER[f.severity]));
    return sa - sb || a[0].localeCompare(b[0], undefined, { numeric: true });
  });

  const counts = {
    fail: result.coverage.filter((c) => c.status === 'fail').length,
    pass: result.coverage.filter((c) => c.status === 'pass').length,
    human: result.coverage.filter((c) => c.status === 'needs-human-review').length,
    untested: result.coverage.filter((c) => c.status === 'not-tested').length,
  };

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Accessibility conformance report - ${escapeHtml(result.siteUrl)}</title>
<style>
  :root {
    --ink: #14181d; --ink-soft: #414b57; --ink-faint: #6d7885;
    --paper: #ffffff; --sunk: #f4f2ee; --edge: #ddd8ce;
    --fail: #a2303a; --pass: #1e6b58; --review: #8a6a2f;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: var(--paper); color: var(--ink);
    font: 15px/1.6 "Inter", system-ui, -apple-system, sans-serif;
  }
  .sheet { max-width: 60rem; margin: 0 auto; padding: 3rem 2rem 5rem; }
  h1 { font-size: 1.9rem; line-height: 1.2; margin: 0 0 .4rem; letter-spacing: -.01em; }
  h2 { font-size: 1.25rem; margin: 3rem 0 .75rem; padding-top: 1.25rem; border-top: 1px solid var(--edge); }
  h3 { font-size: 1rem; margin: 2rem 0 .5rem; }
  p { max-width: 66ch; }
  .meta { color: var(--ink-faint); font-size: .875rem; margin: 0 0 2rem; }
  .lede { font-size: 1.05rem; color: var(--ink-soft); max-width: 66ch; }
  .tnum { font-variant-numeric: tabular-nums; }

  .banner { border: 1px solid var(--edge); border-left: 3px solid var(--review);
            background: var(--sunk); padding: 1.1rem 1.25rem; margin: 1.5rem 0; }
  .banner strong { color: var(--ink); }

  .tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr)); gap: .75rem; margin: 1.5rem 0; }
  .tile { border: 1px solid var(--edge); padding: .85rem 1rem; }
  .tile .n { font-size: 1.6rem; font-weight: 600; }
  .tile .l { font-size: .72rem; text-transform: uppercase; letter-spacing: .08em; color: var(--ink-faint); }

  table { border-collapse: collapse; width: 100%; font-size: .875rem; margin: 1rem 0; }
  th, td { text-align: left; padding: .5rem .6rem; border-bottom: 1px solid var(--edge); vertical-align: top; }
  th { font-size: .7rem; text-transform: uppercase; letter-spacing: .07em; color: var(--ink-faint); }

  .status { font-weight: 600; font-size: .8rem; }
  .s-fail { color: var(--fail); } .s-pass { color: var(--pass); }
  .s-review, .s-untested { color: var(--review); }

  .finding { border: 1px solid var(--edge); border-left: 3px solid var(--fail); padding: 1rem 1.15rem; margin: .85rem 0; }
  .finding.minor, .finding.moderate { border-left-color: var(--review); }
  .finding h4 { margin: 0 0 .35rem; font-size: .95rem; }
  .finding .tags { font-size: .72rem; color: var(--ink-faint); text-transform: uppercase; letter-spacing: .06em; margin-bottom: .5rem; }
  pre { background: var(--sunk); border: 1px solid var(--edge); padding: .6rem .7rem; overflow-x: auto;
        font: 12.5px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; margin: .5rem 0; white-space: pre-wrap; word-break: break-all; }
  .fix pre { border-left: 3px solid var(--pass); }
  .rejected { font-size: .85rem; color: var(--ink-soft); }
  footer { margin-top: 3rem; padding-top: 1.25rem; border-top: 1px solid var(--edge);
           font-size: .8rem; color: var(--ink-faint); }
  @media print { .sheet { padding: 0; max-width: none; } h2 { page-break-after: avoid; } .finding { page-break-inside: avoid; } }
</style>
</head>
<body>
<div class="sheet">

<h1>Accessibility conformance report</h1>
<p class="meta tnum">${escapeHtml(result.siteUrl)} &middot; assessed ${date} &middot; WCAG 2.2 Level AA as adopted by EN 301 549</p>

<p class="lede">This service is assessed as <strong>${status}</strong> with EN 301 549.
${result.findings.length} defect${result.findings.length === 1 ? '' : 's'} were recorded across
${result.stats.pagesAudited} page${result.stats.pagesAudited === 1 ? '' : 's'}.</p>

<div class="banner">
<p style="margin:0"><strong>What this report does not say.</strong>
It does not certify conformance. Of the ${result.coverage.length} Level A and AA success criteria,
a rule engine can fully decide only ${cov.full}; ${cov.partial} are partly automatable and ${cov.none}
cannot be assessed by any automated or model-based method at all. Accordingly
<strong>${counts.pass}</strong> criteria are positively established here, and
<strong>${counts.human + counts.untested}</strong> still require testing by a person, including
keyboard-only operation and screen reader review. Absence of a finding is not a pass.</p>
</div>

<div class="tiles">
  <div class="tile"><div class="n s-fail">${counts.fail}</div><div class="l">Criteria failed</div></div>
  <div class="tile"><div class="n s-pass">${counts.pass}</div><div class="l">Established as passing</div></div>
  <div class="tile"><div class="n s-review">${counts.human}</div><div class="l">Need a human</div></div>
  <div class="tile"><div class="n s-untested">${counts.untested}</div><div class="l">Not established</div></div>
</div>

<h2>Findings</h2>
${
  orderedCriteria.length === 0
    ? '<p>No defects were recorded. This is not a statement of conformance; see the note above.</p>'
    : orderedCriteria
        .map(([criterionId, findings]) => {
          const c = getCriterion(criterionId);
          return `<h3>${escapeHtml(criterionId)} ${escapeHtml(c?.name ?? '')} <span style="color:var(--ink-faint);font-weight:400">(Level ${c?.level ?? '?'}, EN 301 549 clause ${escapeHtml(c?.en301549Clause ?? '')})</span></h3>
${findings
  .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
  .map(
    (f) => `<div class="finding ${f.severity}">
  <div class="tags">${f.severity} &middot; ${sourceLabel(f)}${f.engineRuleId ? ` &middot; ${escapeHtml(f.engineRuleId)}` : ''} &middot; <span class="tnum">${escapeHtml(f.pageUrl)}</span></div>
  <h4>${escapeHtml(f.summary)}</h4>
  <p style="margin:.35rem 0">${escapeHtml(f.reasoning)}</p>
  <pre>${escapeHtml(f.element.selector)}</pre>
  <pre>${escapeHtml(f.element.html)}</pre>
  ${f.suggestedFix ? `<div class="fix"><strong style="font-size:.8rem">Suggested fix</strong><pre>${escapeHtml(f.suggestedFix)}</pre></div>` : ''}
</div>`,
  )
  .join('\n')}`;
        })
        .join('\n')
}

<h2>Coverage, criterion by criterion</h2>
<p>Every Level A and AA success criterion, and what this assessment was able to establish about it.</p>
<table>
<thead><tr><th>Criterion</th><th>Level</th><th>Status</th><th>Basis</th></tr></thead>
<tbody>
${result.coverage
  .map(
    (c) => `<tr>
  <td class="tnum">${escapeHtml(c.criterionId)} ${escapeHtml(c.name)}</td>
  <td>${c.level}</td>
  <td class="status s-${c.status === 'needs-human-review' ? 'review' : c.status === 'not-tested' ? 'untested' : c.status}">${c.status}</td>
  <td>${escapeHtml(c.note)}</td>
</tr>`,
  )
  .join('\n')}
</tbody>
</table>

${
  result.rejected.length > 0
    ? `<h2>Claims rejected during verification</h2>
<p>The judgement pass proposed the following, and each was discarded because it could not be
substantiated against the captured page. They are listed so the report can be judged on its
method rather than on trust. <strong>They are not defects.</strong></p>
<table class="rejected">
<thead><tr><th>Criterion</th><th>Element claimed</th><th>Why it was rejected</th></tr></thead>
<tbody>
${result.rejected
  .map(
    (r) => `<tr><td class="tnum">${escapeHtml(r.criterionId)}</td><td><code>${escapeHtml(r.claimedSelector.slice(0, 90))}</code></td><td>${escapeHtml(r.reason)}</td></tr>`,
  )
  .join('\n')}
</tbody>
</table>`
    : ''
}

<h2>Method</h2>
<p>Three passes. A deterministic rule engine (axe-core) settles what can be decided mechanically
and reproducibly. A judgement pass then reads the captured DOM, the browser-computed accessibility
tree and the element inventory, and reports what the engine structurally cannot see, such as
whether alternative text actually describes anything or whether link text conveys its destination.</p>
<p>Every judgement claim is then verified against the captured evidence before it is allowed into
this report. It must cite a success criterion that exists, resolve to exactly one element that was
actually captured, quote markup that element genuinely contains, not overturn a fully automatable
criterion the engine found clean, and not restate a defect the engine already reported. Claims
failing any of these are rejected and listed above.</p>
<p>The assessment did not operate the page. Criteria that depend on keyboard interaction, focus
movement, hover behaviour, timing or error handling cannot be settled this way and are reported as
requiring human review.</p>

<h2>Draft accessibility statement</h2>
<p>The European Accessibility Act requires a covered service to publish a statement of how it
conforms. The following is a draft. It deliberately does not claim full conformance, and fields
requiring a human decision are left blank.</p>
<pre>${escapeHtml(buildAccessibilityStatement(result, inputs))}</pre>

<footer>
<p>Generated by Auditable on ${date}. Rule engine findings are reproducible by re-running axe-core
against the same pages. This report is not legal advice, and it is not a certificate of conformance.</p>
</footer>

</div>
</body>
</html>`;
}
