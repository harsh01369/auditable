/**
 * The deterministic pass: axe-core.
 *
 * This settles the roughly 30% of WCAG 2.2 criteria a rule engine can decide on
 * its own, and it does so reproducibly: anyone can re-run axe and get the same
 * answer. Its output is also the guard rail for the judgement pass, which is
 * forbidden from overturning a fully automatable criterion this pass found
 * clean.
 *
 * What this pass must never be allowed to imply is conformance. A page with
 * zero axe violations has failed nothing that axe can see, which is a much
 * smaller claim than "accessible".
 */

import AxeBuilder from '@axe-core/playwright';
import type { Page } from 'playwright';
import { getCriterion } from '../core/wcag';
import { findingId } from './verify';
import type { ElementEvidence, Finding, PageSnapshot, Severity } from '../core/types';

/**
 * axe tags encode the criterion as digits: "wcag111" is 1.1.1, "wcag2411" is
 * 2.4.11. Level tags such as "wcag21aa" contain letters and are ignored here.
 */
export function criterionIdsFromAxeTags(tags: string[]): string[] {
  const ids: string[] = [];
  for (const tag of tags) {
    const m = /^wcag(\d)(\d)(\d+)$/.exec(tag);
    if (m) ids.push(`${m[1]}.${m[2]}.${m[3]}`);
  }
  return ids;
}

const IMPACT_TO_SEVERITY: Record<string, Severity> = {
  critical: 'blocker',
  serious: 'serious',
  moderate: 'moderate',
  minor: 'minor',
};

export interface DeterministicResult {
  findings: Finding[];
  /**
   * Criteria axe evaluated on this page and found no violation of. Used to stop
   * the judgement pass contradicting settled ground.
   */
  clean: Set<string>;
  /** Criteria axe could not decide and explicitly flagged as incomplete. */
  incomplete: Set<string>;
}

export async function runDeterministic(
  page: Page,
  snapshot: PageSnapshot,
): Promise<DeterministicResult> {
  const results = await new AxeBuilder({ page })
    .options({
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'],
      },
      rules: {
        // axe marks this rule experimental and so excludes it by default, even
        // under a WCAG tag filter. It is the only mechanical check for 2.5.3,
        // it is well defined, and our evaluation caught us missing a genuine
        // label-in-name mismatch because of the default. Enabled deliberately.
        'label-content-name-mismatch': { enabled: true },
      },
    })
    .analyze();

  const findings: Finding[] = [];
  const violated = new Set<string>();

  for (const violation of results.violations) {
    const criterionIds = criterionIdsFromAxeTags(violation.tags).filter((id) => getCriterion(id));
    if (criterionIds.length === 0) continue;

    for (const node of violation.nodes) {
      const selector = Array.isArray(node.target) ? String(node.target[0] ?? '') : String(node.target);
      const element = resolveElement(snapshot, selector, node.html);

      for (const criterionId of criterionIds) {
        violated.add(criterionId);
        findings.push({
          id: findingId(snapshot.url, criterionId, selector),
          pageUrl: snapshot.url,
          criterionId,
          source: 'deterministic',
          severity: IMPACT_TO_SEVERITY[node.impact ?? violation.impact ?? 'moderate'] ?? 'moderate',
          summary: violation.help,
          reasoning: `${violation.description} ${node.failureSummary ?? ''}`.trim(),
          element,
          engineRuleId: violation.id,
        });
      }
    }
  }

  // Only a fully automatable criterion can be "settled" by a clean engine run.
  //
  // For a partially automatable criterion, axe passing every node it understands
  // says nothing about the nodes it cannot judge: it will happily pass an input
  // whose only label is a placeholder, because a placeholder does supply an
  // accessible name. Marking that criterion settled would tell the judgement
  // pass to leave alone exactly the defects it exists to find.
  const clean = new Set<string>();
  for (const pass of results.passes) {
    for (const id of criterionIdsFromAxeTags(pass.tags)) {
      const criterion = getCriterion(id);
      if (criterion && criterion.automation === 'full' && !violated.has(id)) clean.add(id);
    }
  }

  const incomplete = new Set<string>();
  for (const item of results.incomplete) {
    for (const id of criterionIdsFromAxeTags(item.tags)) {
      if (getCriterion(id)) {
        incomplete.add(id);
        // Anything axe could not decide is by definition not clean.
        clean.delete(id);
      }
    }
  }

  return { findings, clean, incomplete };
}

/**
 * Prefer the element as we captured it, so the report shows one consistent view
 * of the page. Fall back to axe's own record when the selectors differ.
 */
function resolveElement(
  snapshot: PageSnapshot,
  selector: string,
  html: string,
): ElementEvidence {
  const captured = snapshot.elements.find((e) => e.selector === selector);
  if (captured) return captured;
  return {
    selector,
    html: html.slice(0, 600),
    text: '',
  };
}
