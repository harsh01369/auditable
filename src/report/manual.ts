/**
 * The manual test plan.
 *
 * Telling a customer that 48 criteria still require a person, and then stopping,
 * is not much better than not telling them. This turns that number into work
 * somebody can actually do: for each criterion no machine can settle, what to
 * do, and what a failure looks like.
 *
 * Nothing here is generated. These are the procedures a tester follows, written
 * so that a competent developer who is not an accessibility specialist can carry
 * them out and get a defensible answer.
 */

export interface ManualTest {
  criterionId: string;
  /** What the tester does, concretely. */
  procedure: string;
  /** What a failure looks like, so the answer is not a matter of taste. */
  failureLooksLike: string;
}

export const MANUAL_TESTS: ManualTest[] = [
  {
    criterionId: '1.2.1',
    procedure: 'Find every audio-only and video-only file. Check for a transcript on the same page or one click away.',
    failureLooksLike: 'A podcast episode or silent product video with no text alternative anywhere.',
  },
  {
    criterionId: '1.2.3',
    procedure: 'Play each prerecorded video with the sound off and note anything conveyed only by the picture. Check whether an audio description or a full text alternative covers it.',
    failureLooksLike: 'An on-screen price, address or instruction that is never spoken and appears in no transcript.',
  },
  {
    criterionId: '1.2.4',
    procedure: 'During any live stream, check that captions appear in real time.',
    failureLooksLike: 'A live event with no captions, or captions added only after the event.',
  },
  {
    criterionId: '1.2.5',
    procedure: 'For each prerecorded video, check for an audio description track or an equivalent described version.',
    failureLooksLike: 'Visual-only information with no described alternative.',
  },
  {
    criterionId: '1.3.3',
    procedure: 'Read every instruction aloud and ask whether it still makes sense to someone who cannot see the layout or colours.',
    failureLooksLike: '"Press the green button on the right" or "fields marked in red are required".',
  },
  {
    criterionId: '1.4.1',
    procedure: 'View the page in greyscale. Check that nothing meaningful is lost: errors, required fields, chart series, availability states, link identification within body text.',
    failureLooksLike: 'An invalid form field distinguished only by a red border, or a chart legend distinguished only by colour.',
  },
  {
    criterionId: '1.4.5',
    procedure: 'Try to select the text in banners, buttons and headings. Zoom to 400% and look for blurring.',
    failureLooksLike: 'Promotional text baked into a JPEG that pixelates on zoom and cannot be selected.',
  },
  {
    criterionId: '1.4.13',
    procedure: 'Hover and then keyboard-focus every tooltip, dropdown and popover. Try to dismiss it with Escape without moving the pointer, and try to move the pointer onto the popup itself.',
    failureLooksLike: 'A tooltip that vanishes the moment you move towards it, or one Escape will not close.',
  },
  {
    criterionId: '2.1.4',
    procedure: 'Press single letter keys while focus is in the page body and watch for actions firing. If any exist, look for a setting to disable or remap them.',
    failureLooksLike: 'Pressing "s" opens search with no way to turn it off, so a speech-input user triggers it by talking.',
  },
  {
    criterionId: '2.2.1',
    procedure: 'Find every time limit: session timeout, checkout hold, carousel auto-advance, one-time-code expiry. Check it can be turned off, adjusted, or extended before it expires.',
    failureLooksLike: 'A checkout that empties the basket after fifteen minutes with no warning and no extension.',
  },
  {
    criterionId: '2.3.1',
    procedure: 'Watch any animation, video or transition for flashing. Anything flashing more than three times a second needs measuring against the general and red flash thresholds.',
    failureLooksLike: 'A strobing hero animation or an autoplaying video with rapid cuts.',
  },
  {
    criterionId: '2.5.1',
    procedure: 'Operate every slider, carousel, map, signature pad and swipeable element using a single tap or click only, with no dragging, pinching or tracing.',
    failureLooksLike: 'An image gallery that only advances by swiping, or a map that only zooms by pinching.',
  },
  {
    criterionId: '2.5.2',
    procedure: 'Press the pointer down on a control, move away from it, and release. The action should not fire.',
    failureLooksLike: 'A "delete" button that acts on mousedown, so it cannot be aborted.',
  },
  {
    criterionId: '2.5.4',
    procedure: 'Identify anything triggered by shaking, tilting or moving the device, and check a conventional control does the same job.',
    failureLooksLike: 'Shake to undo, with no undo button.',
  },
  {
    criterionId: '2.5.7',
    procedure: 'For every drag interaction, check a single-pointer alternative exists: reorder buttons, a move-to menu, or a form field.',
    failureLooksLike: 'A basket that only lets you reorder items by dragging them.',
  },
  {
    criterionId: '3.2.1',
    procedure: 'Tab through the whole page and watch for anything that happens on focus alone.',
    failureLooksLike: 'A select that submits the form as soon as it receives focus, or a modal that opens on tab.',
  },
  {
    criterionId: '3.2.2',
    procedure: 'Change every input, radio, checkbox and select without pressing a submit button, and watch for navigation or content changes.',
    failureLooksLike: 'Choosing a country reloads the page and discards what was already typed.',
  },
  {
    criterionId: '3.3.1',
    procedure: 'Submit every form with wrong and missing values. Check the error is described in text, names the field, and is announced to a screen reader.',
    failureLooksLike: 'A red outline and nothing else, or a summary that says only "there was a problem".',
  },
  {
    criterionId: '3.3.3',
    procedure: 'Enter values that are wrong in a knowable way: a malformed postcode, a date in the past, a too-short password. Check the message says how to fix it.',
    failureLooksLike: '"Invalid input" where the system plainly knows the expected format.',
  },
  {
    criterionId: '3.3.4',
    procedure: 'For anything financial, legal or that deletes data, check the submission is reversible, checked for errors, or confirmed on a review step.',
    failureLooksLike: 'A one-click order with no review step and no cancellation window.',
  },
  {
    criterionId: '3.3.7',
    procedure: 'Work through a multi-step flow and note anything you are asked to enter twice.',
    failureLooksLike: 'Re-typing a delivery address as the billing address with no copy option.',
  },
  {
    criterionId: '3.3.8',
    procedure: 'Complete sign-in and checkout. Check that no step requires solving a puzzle, transcribing characters or recalling something, without an alternative such as a password manager, email link or passkey.',
    failureLooksLike: 'A distorted-text CAPTCHA with no non-visual alternative, or a field that blocks paste and so defeats a password manager.',
  },
];

const BY_ID = new Map(MANUAL_TESTS.map((t) => [t.criterionId, t]));

export function manualTestFor(criterionId: string): ManualTest | undefined {
  return BY_ID.get(criterionId);
}
