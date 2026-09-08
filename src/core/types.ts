/**
 * Domain types for accessibility conformance auditing.
 *
 * The organising principle: a finding is worthless unless someone else can
 * check it. Every finding therefore carries the element it is about, the
 * markup as it actually appeared, the success criterion it fails, and how the
 * finding was arrived at. A regulator, a lawyer or a sceptical developer must
 * be able to reproduce the judgement without trusting us.
 */

/** WCAG conformance levels. EN 301 549 requires AA for the EAA. */
export type ConformanceLevel = 'A' | 'AA' | 'AAA';

/** How a finding was produced. This is disclosed in the report, not hidden. */
export type FindingSource =
  /** A deterministic rule engine (axe-core). Reproducible by re-running it. */
  | 'deterministic'
  /** Model judgement that survived verification against the live DOM. */
  | 'judgement'
  /** Something a machine cannot settle. Reported as a question, never as a failure. */
  | 'needs-human-review';

export type Severity = 'blocker' | 'serious' | 'moderate' | 'minor';

/** A WCAG 2.2 success criterion, as referenced by EN 301 549. */
export interface SuccessCriterion {
  /** Dotted number, e.g. "1.1.1". */
  id: string;
  /** e.g. "Non-text Content". */
  name: string;
  level: ConformanceLevel;
  /**
   * Whether a rule engine can decide this criterion on its own.
   * `none` means automation cannot see it at all; those are the criteria that
   * make an automated-only audit misleading.
   */
  automation: 'full' | 'partial' | 'none';
  /** Clause of EN 301 549 that adopts this criterion, where applicable. */
  en301549Clause?: string;
  /** What a human is actually being asked to decide, in plain words. */
  question: string;
}

/**
 * The element a finding is about, captured well enough that the finding can be
 * re-checked later against a page that may since have changed.
 */
export interface ElementEvidence {
  /**
   * A CSS selector that resolved to exactly one element at capture time.
   * Verification re-runs this selector; a selector that no longer resolves
   * uniquely invalidates the finding.
   */
  selector: string;
  /** The element's own markup, truncated, exactly as served. */
  html: string;
  /** Visible text content, trimmed. */
  text: string;
  /** Accessible name computed by the browser, if any. */
  accessibleName?: string;
  /** ARIA or implicit role. */
  role?: string;
  /** Where the element sat in the viewport, for the screenshot crop. */
  box?: { x: number; y: number; width: number; height: number };
}

export interface Finding {
  /** Stable identifier, derived from page, criterion and selector. */
  id: string;
  pageUrl: string;
  criterionId: string;
  source: FindingSource;
  severity: Severity;
  /** One sentence stating what is wrong. */
  summary: string;
  /**
   * Why this fails the criterion, in terms a developer can act on. For
   * judgement findings this is the model's reasoning, retained so it can be
   * disputed.
   */
  reasoning: string;
  element: ElementEvidence;
  /** Concrete remediation. Real markup, never an instruction to install a widget. */
  suggestedFix?: string;
  /** For deterministic findings, the rule engine's own rule id. */
  engineRuleId?: string;
  /**
   * Set when the finding came from a model. Records that it passed
   * verification, and what was checked.
   */
  verification?: VerificationRecord;
}

/**
 * Proof that a model-produced finding refers to something that genuinely
 * exists. Findings without a passing record are never emitted.
 */
export interface VerificationRecord {
  /** The selector resolved to exactly one element in the captured DOM. */
  selectorResolves: boolean;
  /** The markup the model quoted matches the element actually found. */
  quotedHtmlMatches: boolean;
  /** The cited success criterion exists in the catalogue. */
  criterionExists: boolean;
  /** Model claimed a criterion that automation had already settled as passing. */
  contradictsDeterministic: boolean;
  checkedAt: string;
}

/** A model finding that failed verification. Counted and reported, never shown as a defect. */
export interface RejectedFinding {
  criterionId: string;
  claimedSelector: string;
  summary: string;
  reason: string;
}

/** Everything captured from one page, and the sole input to the judgement pass. */
export interface PageSnapshot {
  url: string;
  title: string;
  capturedAt: string;
  /** Full serialised DOM after scripts have run. */
  html: string;
  /** Flattened accessibility tree as the browser computed it. */
  accessibilityTree: AccessibilityNode[];
  /** Interactive and structural elements, pre-extracted for judgement. */
  elements: ElementEvidence[];
  /** Base64 PNG of the page, used for criteria that need to be seen. */
  screenshot?: string;
  /** Page language declared on <html lang>. */
  lang?: string;
  viewport: { width: number; height: number };
}

export interface AccessibilityNode {
  role: string;
  name?: string;
  level?: number;
  disabled?: boolean;
  focusable?: boolean;
  children?: AccessibilityNode[];
}

export interface AuditResult {
  siteUrl: string;
  startedAt: string;
  finishedAt: string;
  pages: PageAudit[];
  findings: Finding[];
  rejected: RejectedFinding[];
  /** Criteria evaluated, and what we concluded about each. */
  coverage: CriterionCoverage[];
  stats: AuditStats;
}

export interface PageAudit {
  url: string;
  title: string;
  findingCount: number;
}

/**
 * The honesty layer. For every criterion in scope we state whether we tested
 * it, and if we could not, we say so rather than implying a pass.
 */
export interface CriterionCoverage {
  criterionId: string;
  name: string;
  level: ConformanceLevel;
  status: 'fail' | 'pass' | 'not-tested' | 'needs-human-review';
  findingCount: number;
  /** Why this status, especially when not tested. */
  note: string;
}

export interface AuditStats {
  pagesAudited: number;
  deterministicFindings: number;
  judgementFindings: number;
  rejectedJudgements: number;
  criteriaTestedAutomatically: number;
  criteriaRequiringHumanReview: number;
}
