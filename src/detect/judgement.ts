/**
 * The judgement pass.
 *
 * This is the part automation cannot do. A rule engine sees that an image has
 * an alt attribute; it cannot see that the alt text reads "image". It sees that
 * a link has text; it cannot see that the text is "read more" and therefore
 * fails 2.4.4. Roughly 70% of WCAG criteria come down to that kind of reading,
 * which is why a scan alone has never been an audit.
 *
 * Everything produced here is a *claim*, not a finding. Claims are handed to
 * the verifier, which throws away anything it cannot substantiate against the
 * captured DOM. The model is therefore allowed to be wrong; it is not allowed
 * to be believed.
 */

import { z } from 'zod';
import { criteriaNeedingJudgement, getCriterion } from '../core/wcag';
import { flattenAxTree } from '../capture/snapshot';
import type { ClaimedFinding } from './verify';
import type { PageSnapshot } from '../core/types';

export const ClaimSchema = z.object({
  criterionId: z
    .string()
    .describe('WCAG 2.2 success criterion number, e.g. "1.1.1". Must be one listed in the rubric.'),
  selector: z
    .string()
    .describe('The selector of the offending element, copied verbatim from the evidence list.'),
  quotedHtml: z
    .string()
    .describe('A short verbatim fragment of that element\'s markup, copied exactly from the evidence.'),
  severity: z.enum(['blocker', 'serious', 'moderate', 'minor']),
  summary: z.string().describe('One sentence stating what is wrong.'),
  reasoning: z
    .string()
    .describe('Why this fails the criterion, referring to what the element actually contains.'),
  suggestedFix: z
    .string()
    .optional()
    .describe('Corrected markup. Never suggest an accessibility overlay or widget.'),
});

export const JudgementSchema = z.object({
  findings: z.array(ClaimSchema),
});

export type JudgementOutput = z.infer<typeof JudgementSchema>;

export interface JudgementRequest {
  snapshot: PageSnapshot;
  /** Criteria the rule engine already settled; the model is told not to revisit them. */
  settledCriteria: Set<string>;
  maxElements?: number;
}

export interface JudgementProvider {
  readonly name: string;
  judge(request: JudgementRequest): Promise<ClaimedFinding[]>;
}

/**
 * The rubric. Deliberately identical between pages and between runs, so it sits
 * at the front of the prompt as a stable, cacheable prefix.
 */
export function buildRubric(): string {
  const criteria = criteriaNeedingJudgement()
    .map((c) => `- ${c.id} ${c.name} (Level ${c.level}, EN 301 549 clause ${c.en301549Clause}): ${c.question}`)
    .join('\n');

  return `You are auditing a web page against WCAG 2.2 Level A and AA, as adopted by EN 301 549 for the European Accessibility Act.

You are the judgement half of a two-part audit. A deterministic rule engine has already run and has settled everything it can decide mechanically. Your job is the part it cannot see: whether text alternatives actually describe anything, whether link and heading text is meaningful, whether labels genuinely identify their controls, whether structure reflects meaning.

CRITERIA IN SCOPE
${criteria}

RULES, IN ORDER OF IMPORTANCE

1. Report only defects you can point at. Every finding must name a selector copied character for character from the evidence list, and quote a fragment of that element's markup copied character for character from the evidence. If you cannot quote it, you cannot report it.

2. Never invent. Do not report an element that is not in the evidence list. Do not cite a success criterion that is not in the list above. Claims that fail these checks are discarded automatically and counted against the audit's accuracy, so guessing costs more than staying silent.

3. Prefer silence to speculation. A page with three real defects and no invented ones is a better audit than one with three real defects and seven guesses. Do not report something merely because it is common, or because a criterion has no findings yet.

4. Judge what is there, not what might be. You are looking at a static capture. You cannot observe keyboard behaviour, focus movement, hover states, animation or error handling. Do not claim failures that would require interacting with the page. If a criterion needs interaction to settle, leave it alone.

5. Do not restate the rule engine. The page evidence carries a SETTLED CRITERIA line listing what has already been decided mechanically and found clean. Do not report those unless you can see something the engine structurally cannot, and say what that is.

6. Never recommend an accessibility overlay, widget or automatic-fix script. They do not achieve conformance, courts have rejected them, and sites using them are sued more often, not less. Suggested fixes must be changes to the page's own markup or styling.

FAILURES THAT ARE COMMON AND EASY TO WALK PAST

A rule engine is satisfied by the presence of a thing. You are judging its
substance, so look specifically for these:

- An input whose only label is a placeholder. A placeholder supplies an
  accessible name, so the engine passes it, but it vanishes the moment the user
  types and many assistive technologies ignore it. That fails 3.3.2.
- An input whose label is merely adjacent text, not associated by "for" or by
  wrapping. Visually identical, programmatically absent. Also 3.3.2.
- A control whose visible text is not contained in its accessible name, for
  example a button reading "Submit enquiry" with aria-label="Send". A speech
  input user says what they can see, and nothing happens. That fails 2.5.3.
- Alternative text that repeats an adjacent visible caption word for word, so a
  screen reader announces the same sentence twice. That fails 1.1.1.
- Tabular or list content built from generic elements, where the relationship
  between label and value exists only in the styling. That fails 1.3.1.

WHAT GOOD LOOKS LIKE

Weak finding: "Image is missing descriptive alt text." Useless: it does not say which image, or what is wrong with the text that is there.

Strong finding: criterion 1.1.1, selector "#hero-img", quoting 'alt="img_2024_final"', reasoning that the alternative text is a filename, which conveys nothing to a screen reader user about the promotional offer shown in the image, with a suggested fix supplying real alternative text.

Severity: blocker if it stops a user completing a task, serious if it substantially impedes them, moderate if it degrades the experience, minor if it is a nuisance.`;
}

export function buildEvidence(request: JudgementRequest): string {
  const { snapshot, settledCriteria } = request;
  const max = request.maxElements ?? 120;

  const elements = snapshot.elements.slice(0, max).map((e, i) => {
    const name = e.accessibleName ? ` accessibleName=${JSON.stringify(e.accessibleName)}` : '';
    const text = e.text ? ` text=${JSON.stringify(e.text.slice(0, 120))}` : '';
    return `[${i}] selector=${JSON.stringify(e.selector)} role=${e.role ?? 'generic'}${name}${text}\n    html: ${e.html.slice(0, 320)}`;
  });

  const tree = flattenAxTree(snapshot.accessibilityTree).slice(0, 80);
  const settled = [...settledCriteria].sort().join(', ') || 'none';

  return `PAGE
url: ${snapshot.url}
title: ${JSON.stringify(snapshot.title)}
html lang: ${snapshot.lang ?? '(not declared)'}
viewport: ${snapshot.viewport.width}x${snapshot.viewport.height}

SETTLED CRITERIA (already decided mechanically on this page, do not restate): ${settled}

ACCESSIBILITY TREE (as the browser computed it)
${tree.join('\n')}

ELEMENTS (${elements.length} of ${snapshot.elements.length} captured; you may only cite selectors from this list)
${elements.join('\n')}

Report every genuine failure you can substantiate from the evidence above, and nothing else.`;
}

/**
 * Split a page into batches of elements small enough to fit a provider's
 * per-request budget.
 *
 * Batching is not only a workaround for token limits. A model asked to judge
 * thirty elements attends to each of them; asked to judge two hundred, it
 * skims and reports the most obvious few. Smaller batches find more.
 *
 * The accessibility tree is carried on the first batch only. It is page-wide
 * context, and repeating it in every batch would spend most of the budget on
 * the same text.
 */
export function chunkForJudgement(snapshot: PageSnapshot, batchSize: number): PageSnapshot[] {
  if (snapshot.elements.length <= batchSize) return [snapshot];
  const batches: PageSnapshot[] = [];
  for (let i = 0; i < snapshot.elements.length; i += batchSize) {
    batches.push({
      ...snapshot,
      elements: snapshot.elements.slice(i, i + batchSize),
      accessibilityTree: i === 0 ? snapshot.accessibilityTree : [],
    });
  }
  return batches;
}

export interface BatchOptions {
  batchSize?: number;
  /** Pause between batches, to stay inside per-minute token budgets. */
  delayMs?: number;
  onProgress?: (message: string) => void;
}

/**
 * Run the judgement pass over a page in batches and collect the claims.
 *
 * A batch that fails is logged and skipped rather than failing the audit: a
 * partial judgement pass is still worth having, and the report discloses how
 * much of the page was judged.
 */
export async function judgeInBatches(
  provider: JudgementProvider,
  request: JudgementRequest,
  options: BatchOptions = {},
): Promise<{ claims: ClaimedFinding[]; batchesRun: number; batchesFailed: number }> {
  const batchSize = options.batchSize ?? 30;
  const delayMs = options.delayMs ?? 0;
  const log = options.onProgress ?? (() => {});

  const batches = chunkForJudgement(request.snapshot, batchSize);
  const claims: ClaimedFinding[] = [];
  let batchesFailed = 0;

  for (const [index, batch] of batches.entries()) {
    try {
      const result = await provider.judge({ ...request, snapshot: batch });
      claims.push(...result);
      log(`    batch ${index + 1}/${batches.length}: ${result.length} claim(s)`);
    } catch (error) {
      batchesFailed++;
      log(`    batch ${index + 1}/${batches.length} failed: ${(error as Error).message.slice(0, 160)}`);
    }
    if (delayMs > 0 && index < batches.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return { claims, batchesRun: batches.length, batchesFailed };
}

/** Shape-check provider output and drop anything malformed before verification. */
export function parseClaims(raw: unknown): ClaimedFinding[] {
  const parsed = JudgementSchema.safeParse(raw);
  if (!parsed.success) {
    const loose = z.object({ findings: z.array(z.unknown()) }).safeParse(raw);
    if (!loose.success) return [];
    return loose.data.findings
      .map((f) => ClaimSchema.safeParse(f))
      .filter((r): r is { success: true; data: z.infer<typeof ClaimSchema> } => r.success)
      .map((r) => r.data);
  }
  return parsed.data.findings;
}

/** Criteria the model may legitimately be asked about, for prompt construction and tests. */
export function judgeableCriterionIds(): string[] {
  return criteriaNeedingJudgement().map((c) => c.id);
}

export function isJudgeable(criterionId: string): boolean {
  const c = getCriterion(criterionId);
  return !!c && c.automation !== 'full';
}
