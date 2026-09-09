/**
 * Library entry point.
 *
 * Exported so the engine can be embedded rather than only driven from the
 * command line: agencies with their own pipelines want the findings, not our
 * console output.
 */

export { audit, computeCoverage, type AuditOptions } from './audit';
export { capturePage } from './capture/snapshot';
export { checkIntegrity, CaptureIntegrityError } from './capture/integrity';
export { discoverPages, parseRobots, isAllowed, isSameSite, canonicalise } from './capture/crawl';
export { runDeterministic } from './detect/deterministic';
export { verifyClaim, verifyClaims, type ClaimedFinding } from './detect/verify';
export { judgeInBatches, buildRubric, buildEvidence, type JudgementProvider } from './detect/judgement';
export {
  AnthropicJudgementProvider,
  GroqJudgementProvider,
  NullJudgementProvider,
  providerFromEnv,
} from './detect/providers';
export { renderReport } from './report/render';
export { buildAccessibilityStatement } from './report/statement';
export { MANUAL_TESTS, manualTestFor } from './report/manual';
export { CRITERIA, getCriterion, automationCoverage } from './core/wcag';
export type * from './core/types';
