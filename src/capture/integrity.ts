/**
 * Capture integrity.
 *
 * An audit of the wrong page is worse than no audit. Bot interstitials, consent
 * walls, login redirects and error pages all return HTTP 200 and all look like
 * perfectly ordinary documents to a rule engine, which will duly report that
 * they have very few accessibility defects. Handing that to a customer as a
 * clean bill of health is indefensible.
 *
 * This was not hypothetical: an early run of this tool audited Cloudflare's
 * "Just a moment..." challenge page and reported a single finding, because a
 * hand-set user agent had tripped the bot check. The guard below exists because
 * of that run.
 *
 * So capture is checked before anything is allowed to reason about it, and a
 * failed check stops the audit rather than degrading it.
 */

import type { PageSnapshot } from '../core/types';

export interface IntegrityProblem {
  code:
    | 'bot-challenge'
    | 'error-page'
    | 'too-little-content'
    | 'no-interactive-elements'
    | 'login-wall';
  detail: string;
}

const CHALLENGE_TITLES =
  /just a moment|checking your browser|attention required|are you (a )?human|verify you are|ddos protection|access denied|403 forbidden|captcha/i;

const CHALLENGE_MARKERS = [
  'cf-browser-verification',
  'challenge-platform',
  '__cf_chl',
  'cf_chl_opt',
  'g-recaptcha',
  'h-captcha',
];

const ERROR_TITLES = /^(404|500|502|503)\b|not found|server error|service unavailable/i;

const LOGIN_TITLES = /^(sign in|log ?in)\b|please (sign|log) ?in/i;

/**
 * Inspect a snapshot and report every reason it should not be trusted.
 * An empty array means the capture looks like a real page.
 */
export function checkIntegrity(snapshot: PageSnapshot): IntegrityProblem[] {
  const problems: IntegrityProblem[] = [];
  const title = snapshot.title ?? '';
  const html = snapshot.html ?? '';

  if (CHALLENGE_TITLES.test(title)) {
    problems.push({
      code: 'bot-challenge',
      detail: `The page title is ${JSON.stringify(title)}, which is an anti-bot or verification interstitial rather than the site's own content.`,
    });
  } else {
    const marker = CHALLENGE_MARKERS.find((m) => html.includes(m));
    if (marker) {
      problems.push({
        code: 'bot-challenge',
        detail: `The markup contains "${marker}", indicating an anti-bot challenge was served instead of the page.`,
      });
    }
  }

  if (ERROR_TITLES.test(title)) {
    problems.push({
      code: 'error-page',
      detail: `The page title is ${JSON.stringify(title)}, which looks like an error page.`,
    });
  }

  if (LOGIN_TITLES.test(title) && snapshot.elements.length < 25) {
    problems.push({
      code: 'login-wall',
      detail:
        'The page looks like a sign-in screen. Audit the authenticated pages directly, with credentials, rather than the wall in front of them.',
    });
  }

  if (html.length < 2000) {
    problems.push({
      code: 'too-little-content',
      detail: `Only ${html.length} bytes of markup were returned, which is too little to be the page a visitor sees.`,
    });
  }

  if (snapshot.elements.length < 5) {
    problems.push({
      code: 'no-interactive-elements',
      detail: `Only ${snapshot.elements.length} interactive or structural elements were found. A real page almost always has more, so the capture is probably not the real page.`,
    });
  }

  return problems;
}

export class CaptureIntegrityError extends Error {
  readonly problems: IntegrityProblem[];
  readonly url: string;

  constructor(url: string, problems: IntegrityProblem[]) {
    super(
      `Refusing to audit ${url}: the page captured does not appear to be the real page.\n` +
        problems.map((p) => `  - [${p.code}] ${p.detail}`).join('\n') +
        '\nAuditing this capture would produce a confident report about the wrong document.',
    );
    this.name = 'CaptureIntegrityError';
    this.problems = problems;
    this.url = url;
  }
}
