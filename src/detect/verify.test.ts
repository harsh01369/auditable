import { describe, expect, it } from 'vitest';
import { findingId, verifyClaim, verifyClaims, type ClaimedFinding, type VerifyContext } from './verify';
import type { PageSnapshot } from '../core/types';

const snapshot: PageSnapshot = {
  url: 'https://example.test/checkout',
  title: 'Checkout',
  capturedAt: '2026-09-09T00:00:00.000Z',
  html: '<html lang="en"><body></body></html>',
  accessibilityTree: [],
  viewport: { width: 1280, height: 900 },
  elements: [
    {
      selector: '#promo-img',
      html: '<img id="promo-img" src="/sale.png" alt="image">',
      text: '',
      accessibleName: 'image',
      role: 'img',
    },
    {
      selector: 'main > a:nth-of-type(2)',
      html: '<a href="/terms">Read more</a>',
      text: 'Read more',
      accessibleName: 'Read more',
      role: 'link',
    },
    {
      selector: '#dup',
      html: '<button id="dup">Go</button>',
      text: 'Go',
      role: 'button',
    },
    // Deliberately duplicated selector, to prove ambiguity is caught.
    {
      selector: '#dup',
      html: '<button id="dup">Go elsewhere</button>',
      text: 'Go elsewhere',
      role: 'button',
    },
  ],
};

const context: VerifyContext = {
  snapshot,
  deterministicallyClean: new Set(['2.4.2', '3.1.1']),
};

const validClaim: ClaimedFinding = {
  criterionId: '1.1.1',
  selector: '#promo-img',
  quotedHtml: 'alt="image"',
  severity: 'serious',
  summary: 'Alternative text does not describe the image.',
  reasoning:
    'The alt attribute is present but its value is the word "image", which conveys nothing about the content or purpose.',
  suggestedFix: '<img id="promo-img" src="/sale.png" alt="Summer sale: 30% off all footwear">',
};

describe('verifying a well-formed claim', () => {
  it('accepts it and records what was checked', () => {
    const outcome = verifyClaim(validClaim, context);
    expect('finding' in outcome).toBe(true);
    if (!('finding' in outcome)) return;

    const { finding } = outcome;
    expect(finding.criterionId).toBe('1.1.1');
    expect(finding.source).toBe('judgement');
    expect(finding.element.selector).toBe('#promo-img');
    expect(finding.verification).toMatchObject({
      selectorResolves: true,
      quotedHtmlMatches: true,
      criterionExists: true,
      contradictsDeterministic: false,
    });
  });

  it('attaches the captured element rather than the model description of it', () => {
    const outcome = verifyClaim(validClaim, context);
    if (!('finding' in outcome)) throw new Error('expected acceptance');
    // The evidence in the report is what the browser saw, not what the model said.
    expect(outcome.finding.element.html).toBe(snapshot.elements[0]!.html);
  });

  it('routes criteria automation cannot see to human review, not to failure', () => {
    // 1.4.1 Use of Color has automation: 'none'.
    const outcome = verifyClaim(
      { ...validClaim, criterionId: '1.4.1', selector: 'main > a:nth-of-type(2)', quotedHtml: 'Read more' },
      context,
    );
    if (!('finding' in outcome)) throw new Error('expected acceptance');
    expect(outcome.finding.source).toBe('needs-human-review');
  });
});

describe('rejecting claims that cannot be substantiated', () => {
  it('rejects a success criterion that does not exist', () => {
    const outcome = verifyClaim({ ...validClaim, criterionId: '2.4.14' }, context);
    if (!('rejected' in outcome)) throw new Error('expected rejection');
    expect(outcome.rejected.reason).toMatch(/not a WCAG 2.2 Level A or AA criterion/);
  });

  it('rejects 4.1.1 Parsing, which WCAG 2.2 removed', () => {
    const outcome = verifyClaim({ ...validClaim, criterionId: '4.1.1' }, context);
    expect('rejected' in outcome).toBe(true);
  });

  it('rejects an element that was never captured', () => {
    const outcome = verifyClaim({ ...validClaim, selector: '#does-not-exist' }, context);
    if (!('rejected' in outcome)) throw new Error('expected rejection');
    expect(outcome.rejected.reason).toMatch(/not among the elements captured/);
  });

  it('rejects an ambiguous selector', () => {
    const outcome = verifyClaim(
      { ...validClaim, selector: '#dup', quotedHtml: 'Go' },
      context,
    );
    if (!('rejected' in outcome)) throw new Error('expected rejection');
    expect(outcome.rejected.reason).toMatch(/ambiguous/);
  });

  it('rejects markup the element does not contain', () => {
    const outcome = verifyClaim(
      { ...validClaim, quotedHtml: 'aria-hidden="true"' },
      context,
    );
    if (!('rejected' in outcome)) throw new Error('expected rejection');
    expect(outcome.rejected.reason).toMatch(/does not appear in the captured element/);
  });

  it('rejects an empty quote, which proves nothing', () => {
    const outcome = verifyClaim({ ...validClaim, quotedHtml: '' }, context);
    expect('rejected' in outcome).toBe(true);
  });

  it('will not let the model overturn automation on a fully decidable criterion', () => {
    // 3.1.1 Language of Page is automation: 'full' and the engine found it clean.
    const outcome = verifyClaim(
      { ...validClaim, criterionId: '3.1.1' },
      context,
    );
    if (!('rejected' in outcome)) throw new Error('expected rejection');
    expect(outcome.rejected.reason).toMatch(/fully decidable by the rule engine/);
  });

  it('still allows a partially automatable criterion the engine did not flag', () => {
    // 1.1.1 is 'partial', so the model is permitted to add judgement.
    const outcome = verifyClaim(
      validClaim,
      { ...context, deterministicallyClean: new Set(['1.1.1']) },
    );
    expect('finding' in outcome).toBe(true);
  });

  it('tolerates whitespace and case differences when matching the quote', () => {
    const outcome = verifyClaim({ ...validClaim, quotedHtml: '  ALT="IMAGE"  ' }, context);
    expect('finding' in outcome).toBe(true);
  });
});

describe('verifying a batch', () => {
  it('separates accepted from rejected and drops duplicates', () => {
    const outcome = verifyClaims(
      [
        validClaim,
        validClaim, // exact duplicate
        { ...validClaim, criterionId: '9.9.9' },
        {
          ...validClaim,
          criterionId: '2.4.4',
          selector: 'main > a:nth-of-type(2)',
          quotedHtml: 'Read more',
          summary: 'Link text does not describe its destination.',
        },
      ],
      context,
    );

    expect(outcome.accepted).toHaveLength(2);
    expect(outcome.rejected).toHaveLength(2);
    expect(outcome.rejected.map((r) => r.reason)).toEqual([
      expect.stringMatching(/Duplicate/),
      expect.stringMatching(/not a WCAG/),
    ]);
  });

  it('gives the same defect the same id across runs', () => {
    const a = findingId('https://example.test/checkout', '1.1.1', '#promo-img');
    const b = findingId('https://example.test/checkout', '1.1.1', '#promo-img');
    const c = findingId('https://example.test/other', '1.1.1', '#promo-img');
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});

describe('not restating the rule engine', () => {
  const engineFinding = {
    id: 'x',
    pageUrl: snapshot.url,
    criterionId: '1.1.1',
    source: 'deterministic' as const,
    severity: 'serious' as const,
    summary: 'Images must have alternative text',
    reasoning: '',
    // axe describes the element with its own selector dialect.
    element: {
      selector: 'img[src$="sale.png"]',
      html: '<img id="promo-img" src="/sale.png" alt="image">',
      text: '',
    },
    engineRuleId: 'image-alt',
  };

  it('rejects a claim about a defect the engine already reported, despite a different selector', () => {
    const outcome = verifyClaim(validClaim, { ...context, existingFindings: [engineFinding] });
    if (!('rejected' in outcome)) throw new Error('expected rejection');
    expect(outcome.rejected.reason).toMatch(/already reported/);
  });

  it('still accepts a different criterion on the same element', () => {
    const outcome = verifyClaim(
      { ...validClaim, criterionId: '2.5.3' },
      { ...context, existingFindings: [engineFinding] },
    );
    expect('finding' in outcome).toBe(true);
  });

  it('still accepts the same criterion on a different element', () => {
    const outcome = verifyClaim(
      {
        ...validClaim,
        selector: 'main > a:nth-of-type(2)',
        quotedHtml: 'Read more',
      },
      { ...context, existingFindings: [engineFinding] },
    );
    expect('finding' in outcome).toBe(true);
  });
});
