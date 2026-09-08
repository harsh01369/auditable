import { describe, expect, it } from 'vitest';
import { checkIntegrity } from './integrity';
import type { PageSnapshot } from '../core/types';

function snapshot(overrides: Partial<PageSnapshot> = {}): PageSnapshot {
  return {
    url: 'https://example.test/',
    title: 'Shop | Example',
    capturedAt: '2026-09-09T00:00:00.000Z',
    // Comfortably past the minimum-content threshold.
    html: `<html lang="en"><body>${'<p>content</p>'.repeat(400)}</body></html>`,
    accessibilityTree: [],
    viewport: { width: 1280, height: 900 },
    elements: Array.from({ length: 30 }, (_, i) => ({
      selector: `#el-${i}`,
      html: `<a href="/p/${i}">Product ${i}</a>`,
      text: `Product ${i}`,
    })),
    ...overrides,
  };
}

describe('a normal page', () => {
  it('raises no integrity problems', () => {
    expect(checkIntegrity(snapshot())).toEqual([]);
  });
});

describe('captures that must never be audited', () => {
  it('catches the Cloudflare interstitial by title', () => {
    const problems = checkIntegrity(snapshot({ title: 'Just a moment...' }));
    expect(problems.map((p) => p.code)).toContain('bot-challenge');
  });

  it('catches a challenge by markup marker even when the title looks innocent', () => {
    const problems = checkIntegrity(
      snapshot({
        title: 'Shop | Example',
        html: `<html><body><div id="challenge-platform"></div>${'<p>x</p>'.repeat(400)}</body></html>`,
      }),
    );
    expect(problems.map((p) => p.code)).toContain('bot-challenge');
  });

  it.each([
    'Attention Required! | Cloudflare',
    'Checking your browser before accessing',
    'Access Denied',
    'Verify you are human',
  ])('catches the interstitial titled %s', (title) => {
    expect(checkIntegrity(snapshot({ title })).map((p) => p.code)).toContain('bot-challenge');
  });

  it('catches an error page', () => {
    expect(checkIntegrity(snapshot({ title: '404 Not Found' })).map((p) => p.code)).toContain(
      'error-page',
    );
  });

  it('catches a thin capture that cannot be the real page', () => {
    const problems = checkIntegrity(snapshot({ html: '<html><body></body></html>' }));
    expect(problems.map((p) => p.code)).toContain('too-little-content');
  });

  it('catches a capture with almost nothing interactive on it', () => {
    const problems = checkIntegrity(snapshot({ elements: [] }));
    expect(problems.map((p) => p.code)).toContain('no-interactive-elements');
  });

  it('flags a sign-in wall, since the pages worth auditing are behind it', () => {
    const problems = checkIntegrity(
      snapshot({ title: 'Sign in', elements: snapshot().elements.slice(0, 8) }),
    );
    expect(problems.map((p) => p.code)).toContain('login-wall');
  });

  it('does not mistake a real page that merely mentions signing in', () => {
    // 30 elements, ordinary title: a shop page with a sign-in link is not a wall.
    expect(checkIntegrity(snapshot({ title: 'Basket | Example' }))).toEqual([]);
  });

  it('reports every independent reason, not just the first', () => {
    const problems = checkIntegrity(
      snapshot({ title: 'Just a moment...', html: '<html></html>', elements: [] }),
    );
    expect(problems.length).toBeGreaterThanOrEqual(3);
  });
});
