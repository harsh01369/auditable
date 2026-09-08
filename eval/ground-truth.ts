/**
 * Ground truth for the evaluation corpus.
 *
 * Two things are labelled, and the second matters as much as the first.
 *
 * `defects` are planted failures with a known success criterion. They measure
 * recall: what the audit finds.
 *
 * `distractors` are elements that are deliberately correct, and often correct
 * in a way that superficially resembles a defect: a short link whose accessible
 * name rescues it, an image correctly marked decorative, an input labelled by
 * aria-label rather than a label element. They measure precision. A tool that
 * reports everything achieves perfect recall and is worthless, so a finding on
 * any distractor is counted as a false positive with no excuse.
 *
 * `expectedFrom` records which pass ought to catch each defect, so the
 * judgement pass is scored on what it is actually for rather than credited for
 * work the rule engine did.
 */

export interface ExpectedDefect {
  /** id attribute of the offending element in the fixture. */
  elementId: string;
  criterionId: string;
  /**
   * Other success criteria that would be a defensible way to report the same
   * defect. A missing label is a real failure of 3.3.2, and axe reports it under
   * 4.1.2; both are right. Scoring only the criterion we happened to write down
   * would penalise a correct finding and flatter the judgement pass by
   * comparison, so alternatives count as a hit.
   */
  alsoAcceptable?: string[];
  expectedFrom: 'engine' | 'judgement' | 'either';
  note: string;
}

export interface Fixture {
  file: string;
  /**
   * Written after prompt tuning and never iterated on. Tuning a prompt against
   * the same pages you score on inflates the score, so the held-out number is
   * the only one worth quoting.
   */
  heldOut?: boolean;
  defects: ExpectedDefect[];
  /** Elements that are correct. Any finding on one of these is a false positive. */
  distractors: string[];
}

export const FIXTURES: Fixture[] = [
  {
    file: 'alt-text.html',
    defects: [
      {
        elementId: 'alt-says-image',
        criterionId: '1.1.1',
        expectedFrom: 'judgement',
        note: 'alt="image" is present, so no rule engine can object, and it conveys nothing.',
      },
      {
        elementId: 'alt-is-filename',
        criterionId: '1.1.1',
        expectedFrom: 'judgement',
        note: 'alt is a camera filename.',
      },
      {
        elementId: 'alt-says-photo',
        criterionId: '1.1.1',
        expectedFrom: 'judgement',
        note: 'alt="photo" describes the medium, not the content.',
      },
      {
        elementId: 'alt-duplicates-caption',
        criterionId: '1.1.1',
        expectedFrom: 'judgement',
        note: 'alt repeats the adjacent visible caption verbatim, so it is announced twice.',
      },
    ],
    distractors: ['good-alt-1', 'good-decorative', 'good-alt-2'],
  },
  {
    file: 'links-and-labels.html',
    defects: [
      {
        elementId: 'link-click-here',
        criterionId: '2.4.4',
        expectedFrom: 'judgement',
        note: '"Click here" has an accessible name, so the engine is satisfied; the purpose is still undeterminable.',
      },
      {
        elementId: 'link-read-more',
        criterionId: '2.4.4',
        expectedFrom: 'judgement',
        note: '"Read more" names no destination.',
      },
      {
        elementId: 'link-here',
        criterionId: '2.4.4',
        expectedFrom: 'judgement',
        note: 'A bare "here".',
      },
      {
        elementId: 'placeholder-only-email',
        criterionId: '3.3.2',
        alsoAcceptable: ['4.1.2', '1.3.1'],
        expectedFrom: 'either',
        note: 'A placeholder is not a label; it disappears on input and is unreliable for assistive technology.',
      },
      {
        elementId: 'unassociated-order',
        criterionId: '3.3.2',
        alsoAcceptable: ['4.1.2', '1.3.1'],
        expectedFrom: 'either',
        note: 'Adjacent text is not a programmatically associated label.',
      },
      {
        elementId: 'label-in-name-mismatch',
        criterionId: '2.5.3',
        alsoAcceptable: ['4.1.2'],
        expectedFrom: 'either',
        note: 'Visible text "Submit enquiry" is not contained in the accessible name "Send".',
      },
      {
        elementId: 'fake-table',
        criterionId: '1.3.1',
        alsoAcceptable: ['1.3.2'],
        expectedFrom: 'judgement',
        note: 'Tabular data built from divs, with the relationships living only in the styling.',
      },
    ],
    distractors: [
      'good-link-1',
      'good-link-2',
      'good-link-3',
      'good-name',
      'good-postcode',
      'good-table',
    ],
  },
];

const HELD_OUT: Fixture = {
  file: 'checkout-heldout.html',
  heldOut: true,
  defects: [
    { elementId: 'ho-alt-picture', criterionId: '1.1.1', expectedFrom: 'judgement', note: 'alt="picture" names the medium.' },
    { elementId: 'ho-alt-assetpath', criterionId: '1.1.1', expectedFrom: 'judgement', note: 'alt is an asset path.' },
    { elementId: 'ho-alt-echo', criterionId: '1.1.1', expectedFrom: 'judgement', note: 'alt repeats the visible caption verbatim.' },
    { elementId: 'ho-placeholder-city', criterionId: '3.3.2', alsoAcceptable: ['4.1.2', '1.3.1'], expectedFrom: 'either', note: 'Placeholder standing in for a label.' },
    { elementId: 'ho-adjacent-instructions', criterionId: '3.3.2', alsoAcceptable: ['4.1.2', '1.3.1'], expectedFrom: 'either', note: 'Adjacent text is not an associated label.' },
    { elementId: 'ho-fake-list', criterionId: '1.3.1', alsoAcceptable: ['1.3.2'], expectedFrom: 'judgement', note: 'Name and value pairs as generic divs.' },
    { elementId: 'ho-link-learnmore', criterionId: '2.4.4', expectedFrom: 'judgement', note: '"Learn more" names no destination.' },
    { elementId: 'ho-link-thispage', criterionId: '2.4.4', expectedFrom: 'judgement', note: '"this page" refers to itself.' },
    { elementId: 'ho-link-details', criterionId: '2.4.4', expectedFrom: 'judgement', note: 'A single vague noun.' },
    { elementId: 'ho-name-mismatch', criterionId: '2.5.3', alsoAcceptable: ['4.1.2'], expectedFrom: 'either', note: 'Visible "Place order" absent from accessible name "Confirm".' },
  ],
  distractors: ['ho-good-alt', 'ho-good-decorative', 'ho-good-addr', 'ho-good-phone', 'ho-good-table', 'ho-good-link'],
};

FIXTURES.push(HELD_OUT);

export function tuningFixtures(): Fixture[] {
  return FIXTURES.filter((f) => !f.heldOut);
}

export function heldOutFixtures(): Fixture[] {
  return FIXTURES.filter((f) => f.heldOut);
}

export function allDistractors(): Set<string> {
  return new Set(FIXTURES.flatMap((f) => f.distractors));
}

export function defectsFor(file: string): ExpectedDefect[] {
  return FIXTURES.find((f) => f.file === file)?.defects ?? [];
}
