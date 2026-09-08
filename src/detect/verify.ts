/**
 * Verification of model-produced findings.
 *
 * A model asked to judge accessibility will occasionally describe a problem on
 * an element that does not exist, cite a success criterion that does not exist,
 * or restate something a rule engine has already settled. Shipping any of those
 * as a defect is how an accessibility tool becomes a liability rather than a
 * defence: it is the failure mode the FTC fined accessiBe $1,000,000 for in
 * April 2025, and it is the reason overlays lose in court.
 *
 * So no model claim reaches a report on the strength of the model's confidence.
 * Every claim must survive four checks against the captured evidence. Claims
 * that fail are counted and disclosed, never silently dropped and never shown
 * as defects.
 *
 * This module is deliberately pure. It performs no network or browser work, so
 * it can be tested exhaustively against fixtures.
 */

import { criterionExists, getCriterion } from '../core/wcag';
import type {
  ElementEvidence,
  Finding,
  PageSnapshot,
  RejectedFinding,
  Severity,
  VerificationRecord,
} from '../core/types';

/** What a judgement model is asked to return, before it has earned the name "finding". */
export interface ClaimedFinding {
  criterionId: string;
  /** Must be one of the selectors handed to the model in the evidence. */
  selector: string;
  /**
   * A short verbatim fragment of the element's markup. Requiring this forces
   * the model to have actually read the element rather than pattern-matched
   * a plausible-sounding defect.
   */
  quotedHtml: string;
  severity: Severity;
  summary: string;
  reasoning: string;
  suggestedFix?: string;
}

export interface VerificationOutcome {
  accepted: Finding[];
  rejected: RejectedFinding[];
}

/** Collapse insignificant whitespace so quoting is robust to formatting. */
function normalise(html: string): string {
  return html.replace(/\s+/g, ' ').trim().toLowerCase();
}

/** Deterministic identifier so the same defect keeps the same id between runs. */
export function findingId(pageUrl: string, criterionId: string, selector: string): string {
  const input = `${pageUrl}|${criterionId}|${selector}`;
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export interface VerifyContext {
  snapshot: PageSnapshot;
  /**
   * Criteria for which a rule engine already ran and reported no violation on
   * this page. A model may not overturn a fully automatable criterion that
   * automation has already settled.
   */
  deterministicallyClean: Set<string>;
  /**
   * Findings the rule engine already reported. The judgement pass exists to add
   * what automation cannot see, so restating an engine finding is noise, and
   * noise in a compliance report costs credibility.
   */
  existingFindings?: Finding[];
}

/**
 * Identity of a defect, independent of how the selector happens to be spelled.
 *
 * axe and the model routinely describe the same element differently: one says
 * `img[src$="border.gif"]`, the other a long nth-of-type path. Comparing
 * selectors as strings would treat those as different defects, so identity is
 * taken from the criterion plus the element's own markup.
 */
export function defectKey(criterionId: string, elementHtml: string): string {
  return `${criterionId}|${normalise(elementHtml)}`;
}

/**
 * Verify one claim. Returns either a finding that has earned its place, or the
 * reason it did not.
 */
export function verifyClaim(
  claim: ClaimedFinding,
  context: VerifyContext,
): { finding: Finding } | { rejected: RejectedFinding } {
  const { snapshot } = context;

  const reject = (reason: string): { rejected: RejectedFinding } => ({
    rejected: {
      criterionId: claim.criterionId,
      claimedSelector: claim.selector,
      summary: claim.summary,
      reason,
    },
  });

  // 1. The criterion must be real. A model inventing "2.4.14" is not a finding.
  if (!criterionExists(claim.criterionId)) {
    return reject(
      `Cites success criterion ${claim.criterionId}, which is not a WCAG 2.2 Level A or AA criterion.`,
    );
  }

  // 2. The element must be one we actually captured and showed the model.
  const matches = snapshot.elements.filter((e) => e.selector === claim.selector);
  if (matches.length === 0) {
    return reject(
      `Selector "${claim.selector}" was not among the elements captured from this page.`,
    );
  }
  if (matches.length > 1) {
    return reject(
      `Selector "${claim.selector}" is ambiguous: it matched ${matches.length} captured elements.`,
    );
  }
  const element = matches[0] as ElementEvidence;

  // 3. The quoted markup must genuinely come from that element.
  const quoted = normalise(claim.quotedHtml);
  const actual = normalise(element.html);
  const quotedHtmlMatches = quoted.length > 0 && actual.includes(quoted);
  if (!quotedHtmlMatches) {
    return reject(
      'The markup quoted in the finding does not appear in the captured element, so the finding cannot be substantiated.',
    );
  }

  // 4. A model may not contradict automation on criteria automation fully decides.
  const criterion = getCriterion(claim.criterionId)!;
  const contradictsDeterministic =
    criterion.automation === 'full' && context.deterministicallyClean.has(claim.criterionId);
  if (contradictsDeterministic) {
    return reject(
      `Success criterion ${claim.criterionId} is fully decidable by the rule engine, which reported no violation on this page.`,
    );
  }

  // 5. The judgement pass must add information, not restate the rule engine.
  const alreadyReported = (context.existingFindings ?? []).some(
    (f) => defectKey(f.criterionId, f.element.html) === defectKey(claim.criterionId, element.html),
  );
  if (alreadyReported) {
    return reject(
      `The rule engine already reported ${claim.criterionId} on this element; the judgement pass is for defects automation cannot see.`,
    );
  }

  const verification: VerificationRecord = {
    selectorResolves: true,
    quotedHtmlMatches: true,
    criterionExists: true,
    contradictsDeterministic: false,
    checkedAt: new Date().toISOString(),
  };

  return {
    finding: {
      id: findingId(snapshot.url, claim.criterionId, claim.selector),
      pageUrl: snapshot.url,
      criterionId: claim.criterionId,
      source: criterion.automation === 'none' ? 'needs-human-review' : 'judgement',
      severity: claim.severity,
      summary: claim.summary,
      reasoning: claim.reasoning,
      element,
      suggestedFix: claim.suggestedFix,
      verification,
    },
  };
}

/** Verify a batch, dropping duplicates that describe the same defect twice. */
export function verifyClaims(
  claims: ClaimedFinding[],
  context: VerifyContext,
): VerificationOutcome {
  const accepted: Finding[] = [];
  const rejected: RejectedFinding[] = [];
  const seen = new Set<string>();

  for (const claim of claims) {
    const key = `${claim.criterionId}|${claim.selector}`;
    if (seen.has(key)) {
      rejected.push({
        criterionId: claim.criterionId,
        claimedSelector: claim.selector,
        summary: claim.summary,
        reason: 'Duplicate of an earlier finding for the same criterion and element.',
      });
      continue;
    }
    seen.add(key);

    const outcome = verifyClaim(claim, context);
    if ('finding' in outcome) accepted.push(outcome.finding);
    else rejected.push(outcome.rejected);
  }

  return { accepted, rejected };
}
