/**
 * Accessibility statement generation.
 *
 * The European Accessibility Act requires a covered service to say how it
 * conforms to the applicable accessibility requirements. A statement that
 * claims full conformance on the strength of an automated scan is worse than
 * no statement at all: it is a written, dated, published assertion that a
 * regulator or a claimant can hold you to.
 *
 * So this generator will not write "fully conformant". The strongest status it
 * will produce from an automated audit is partial conformance, and where the
 * audit found unresolved defects it says so and lists them. Anything requiring
 * a human decision is left as an explicit blank rather than filled with a
 * plausible default.
 */

import { CRITERIA } from '../core/wcag';
import type { AuditResult } from '../core/types';

export type ConformanceStatus = 'partially conformant' | 'non-conformant';

export interface StatementInputs {
  /** Legal or trading name of the organisation providing the service. */
  organisationName?: string;
  /** The service the statement covers, e.g. "the example.com online shop". */
  serviceName?: string;
  /** Where users report accessibility problems. Required by the EAA. */
  feedbackEmail?: string;
  /** National enforcement body for the member state, for the escalation route. */
  enforcementBody?: string;
}

const BLANK = '[TO BE COMPLETED]';

export function conformanceStatus(result: AuditResult): ConformanceStatus {
  const blockers = result.findings.filter((f) => f.severity === 'blocker').length;
  return blockers > 0 ? 'non-conformant' : 'partially conformant';
}

export function buildAccessibilityStatement(
  result: AuditResult,
  inputs: StatementInputs = {},
): string {
  const org = inputs.organisationName ?? BLANK;
  const service = inputs.serviceName ?? result.siteUrl;
  const email = inputs.feedbackEmail ?? BLANK;
  const body = inputs.enforcementBody ?? BLANK;
  const status = conformanceStatus(result);
  const date = result.finishedAt.slice(0, 10);

  const failing = result.coverage
    .filter((c) => c.status === 'fail')
    .map((c) => `  - ${c.criterionId} ${c.name} (Level ${c.level}): ${c.findingCount} issue(s) recorded.`);

  const unreviewed = result.coverage.filter(
    (c) => c.status === 'needs-human-review' || c.status === 'not-tested',
  ).length;

  return `ACCESSIBILITY STATEMENT (DRAFT)

${org} is committed to making ${service} accessible, in accordance with the
European Accessibility Act (Directive (EU) 2019/882).

COMPLIANCE STATUS

${service} is ${status} with EN 301 549, which adopts the Web Content
Accessibility Guidelines (WCAG) 2.2 at Level AA. ${
    status === 'non-conformant'
      ? 'It is non-conformant because defects that block completion of tasks were identified and are not yet resolved.'
      : 'It is partially conformant because some content does not yet fully conform, as set out below.'
  }

NON-ACCESSIBLE CONTENT

The following success criteria had defects recorded on ${date}:

${failing.length > 0 ? failing.join('\n') : '  None recorded in the pages assessed.'}

SCOPE AND LIMITS OF THIS ASSESSMENT

This statement is based on an assessment of ${result.stats.pagesAudited} page(s)
listed at the end of this statement, carried out on ${date}.

The assessment combined an automated rule engine with a reviewed judgement pass.
It is not a substitute for a full manual audit. Of the ${CRITERIA.length} Level A and AA
success criteria, ${unreviewed} could not be conclusively established by this
method and require testing by a person, including testing with a screen reader
and by keyboard alone. Those criteria are neither claimed as conforming nor
reported as failing.

FEEDBACK AND CONTACT

If you encounter a barrier using ${service}, please contact us at ${email}.
We aim to respond within [NUMBER] working days.

ENFORCEMENT PROCEDURE

If you are not satisfied with our response, you may contact ${body}.

PAGES ASSESSED

${result.pages.map((p) => `  - ${p.url}`).join('\n')}

Statement prepared on ${date}.
Method: automated assessment with verified judgement review.

---
This is a draft. Fields marked ${BLANK} must be completed, the outstanding
defects should be remediated or explained, and the statement should be reviewed
by someone qualified before it is published. A published statement is a formal
assertion about your service.`;
}
