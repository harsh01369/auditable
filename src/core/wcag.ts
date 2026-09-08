/**
 * WCAG 2.2 Level A and AA success criteria, as adopted by EN 301 549.
 *
 * EN 301 549 clause 9 (Web) adopts the WCAG success criteria directly: clause
 * 9.x.y.z corresponds to WCAG success criterion x.y.z. Conformance with
 * EN 301 549 gives a presumption of conformity with the European Accessibility
 * Act under Article 15, which is why this catalogue is the unit of reporting.
 *
 * WCAG 2.2 has 55 Level A and AA criteria. Success criterion 4.1.1 (Parsing)
 * was removed in WCAG 2.2 and is deliberately absent.
 *
 * The `automation` field is the honest part. It records whether a rule engine
 * can decide a criterion at all. Roughly 30% of criteria are fully automatable;
 * an audit that reports only what a scanner sees is therefore not an audit, and
 * a tool that implies otherwise is selling a false clean bill of health.
 */

import type { ConformanceLevel, SuccessCriterion } from './types';

interface Row {
  id: string;
  name: string;
  level: ConformanceLevel;
  automation: 'full' | 'partial' | 'none';
  question: string;
}

const ROWS: Row[] = [
  // 1. Perceivable
  {
    id: '1.1.1',
    name: 'Non-text Content',
    level: 'A',
    automation: 'partial',
    question:
      'Does every image, icon and control have a text alternative that conveys the same purpose? A scanner sees whether alt exists, not whether it means anything.',
  },
  { id: '1.2.1', name: 'Audio-only and Video-only (Prerecorded)', level: 'A', automation: 'none', question: 'Is there a transcript for audio-only, and a transcript or audio track for video-only content?' },
  { id: '1.2.2', name: 'Captions (Prerecorded)', level: 'A', automation: 'partial', question: 'Do prerecorded videos carry accurate synchronised captions?' },
  { id: '1.2.3', name: 'Audio Description or Media Alternative (Prerecorded)', level: 'A', automation: 'none', question: 'Is visual information in video available as audio description or a text alternative?' },
  { id: '1.2.4', name: 'Captions (Live)', level: 'AA', automation: 'none', question: 'Is live audio content captioned in real time?' },
  { id: '1.2.5', name: 'Audio Description (Prerecorded)', level: 'AA', automation: 'none', question: 'Do prerecorded videos have an audio description track?' },
  { id: '1.3.1', name: 'Info and Relationships', level: 'A', automation: 'partial', question: 'Is visual structure such as headings, lists, tables and form labels expressed in the markup rather than only in styling?' },
  { id: '1.3.2', name: 'Meaningful Sequence', level: 'A', automation: 'partial', question: 'Does the DOM order match the order the content is meant to be read in?' },
  { id: '1.3.3', name: 'Sensory Characteristics', level: 'A', automation: 'none', question: 'Do instructions avoid relying solely on shape, colour, size or position, such as "click the round button on the right"?' },
  { id: '1.3.4', name: 'Orientation', level: 'AA', automation: 'partial', question: 'Does the content work in both portrait and landscape, rather than locking orientation?' },
  { id: '1.3.5', name: 'Identify Input Purpose', level: 'AA', automation: 'partial', question: 'Do inputs collecting personal data carry the correct autocomplete token?' },
  { id: '1.4.1', name: 'Use of Color', level: 'A', automation: 'none', question: 'Is colour ever the only way information is conveyed, such as a red field marking an error with no icon or text?' },
  { id: '1.4.2', name: 'Audio Control', level: 'A', automation: 'partial', question: 'Can audio that plays automatically for more than three seconds be paused or stopped?' },
  { id: '1.4.3', name: 'Contrast (Minimum)', level: 'AA', automation: 'partial', question: 'Does text meet 4.5:1 contrast, or 3:1 for large text? Automation cannot judge text over images or gradients.' },
  { id: '1.4.4', name: 'Resize Text', level: 'AA', automation: 'partial', question: 'Does text remain readable and functional when zoomed to 200%?' },
  { id: '1.4.5', name: 'Images of Text', level: 'AA', automation: 'none', question: 'Is text presented as real text rather than baked into an image?' },
  { id: '1.4.10', name: 'Reflow', level: 'AA', automation: 'partial', question: 'Does content reflow to a 320 CSS pixel width without two-dimensional scrolling?' },
  { id: '1.4.11', name: 'Non-text Contrast', level: 'AA', automation: 'partial', question: 'Do interface components and meaningful graphics meet 3:1 contrast against their surroundings?' },
  { id: '1.4.12', name: 'Text Spacing', level: 'AA', automation: 'partial', question: 'Does content survive increased line height, paragraph, letter and word spacing without loss?' },
  { id: '1.4.13', name: 'Content on Hover or Focus', level: 'AA', automation: 'none', question: 'Can additional content triggered by hover or focus be dismissed, hovered over, and does it persist?' },

  // 2. Operable
  { id: '2.1.1', name: 'Keyboard', level: 'A', automation: 'partial', question: 'Can every function be operated by keyboard alone?' },
  { id: '2.1.2', name: 'No Keyboard Trap', level: 'A', automation: 'partial', question: 'Can keyboard focus always be moved away from a component without a mouse?' },
  { id: '2.1.4', name: 'Character Key Shortcuts', level: 'A', automation: 'none', question: 'Can single-character shortcuts be turned off or remapped?' },
  { id: '2.2.1', name: 'Timing Adjustable', level: 'A', automation: 'none', question: 'Can time limits be turned off, adjusted or extended?' },
  { id: '2.2.2', name: 'Pause, Stop, Hide', level: 'A', automation: 'partial', question: 'Can moving, blinking or auto-updating content be paused or hidden?' },
  { id: '2.3.1', name: 'Three Flashes or Below Threshold', level: 'A', automation: 'none', question: 'Does anything flash more than three times per second?' },
  { id: '2.4.1', name: 'Bypass Blocks', level: 'A', automation: 'partial', question: 'Is there a skip link or landmark structure allowing repeated blocks to be bypassed?' },
  { id: '2.4.2', name: 'Page Titled', level: 'A', automation: 'full', question: 'Does the page have a title that describes its topic or purpose?' },
  { id: '2.4.3', name: 'Focus Order', level: 'A', automation: 'partial', question: 'Does focus move in an order that preserves meaning and operability?' },
  { id: '2.4.4', name: 'Link Purpose (In Context)', level: 'A', automation: 'partial', question: 'Can the purpose of each link be determined from its text, or its text with its context? "Read more" usually cannot.' },
  { id: '2.4.5', name: 'Multiple Ways', level: 'AA', automation: 'partial', question: 'Is there more than one way to locate a page within the site?' },
  { id: '2.4.6', name: 'Headings and Labels', level: 'AA', automation: 'partial', question: 'Do headings and labels actually describe the topic or purpose? A scanner sees that a heading exists, not that it is useful.' },
  { id: '2.4.7', name: 'Focus Visible', level: 'AA', automation: 'partial', question: 'Is the keyboard focus indicator visible, and not removed by a CSS outline reset?' },
  { id: '2.4.11', name: 'Focus Not Obscured (Minimum)', level: 'AA', automation: 'partial', question: 'Is the focused element ever entirely hidden behind a sticky header, cookie banner or chat widget?' },
  { id: '2.5.1', name: 'Pointer Gestures', level: 'A', automation: 'none', question: 'Do multipoint or path-based gestures have a single-pointer alternative?' },
  { id: '2.5.2', name: 'Pointer Cancellation', level: 'A', automation: 'none', question: 'Can a pointer action be aborted or undone before completion?' },
  { id: '2.5.3', name: 'Label in Name', level: 'A', automation: 'full', question: 'Does the accessible name contain the visible label text, so speech-input users can address the control?' },
  { id: '2.5.4', name: 'Motion Actuation', level: 'A', automation: 'none', question: 'Can functions triggered by device motion also be operated by conventional controls?' },
  { id: '2.5.7', name: 'Dragging Movements', level: 'AA', automation: 'none', question: 'Does anything requiring a drag also work with a single tap or click?' },
  { id: '2.5.8', name: 'Target Size (Minimum)', level: 'AA', automation: 'full', question: 'Are pointer targets at least 24 by 24 CSS pixels, or adequately spaced?' },

  // 3. Understandable
  { id: '3.1.1', name: 'Language of Page', level: 'A', automation: 'full', question: 'Is the page language declared correctly on the html element?' },
  { id: '3.1.2', name: 'Language of Parts', level: 'AA', automation: 'partial', question: 'Are passages in another language marked with the correct lang attribute?' },
  { id: '3.2.1', name: 'On Focus', level: 'A', automation: 'none', question: 'Does receiving focus ever trigger an unexpected change of context?' },
  { id: '3.2.2', name: 'On Input', level: 'A', automation: 'none', question: 'Does changing a setting ever submit a form or navigate without warning?' },
  { id: '3.2.3', name: 'Consistent Navigation', level: 'AA', automation: 'partial', question: 'Do repeated navigation blocks appear in the same relative order across pages?' },
  { id: '3.2.4', name: 'Consistent Identification', level: 'AA', automation: 'partial', question: 'Are components with the same function labelled consistently across the site?' },
  { id: '3.2.6', name: 'Consistent Help', level: 'A', automation: 'partial', question: 'Where help is offered, does it appear in the same relative place on every page?' },
  { id: '3.3.1', name: 'Error Identification', level: 'A', automation: 'none', question: 'Are input errors described to the user in text, not only by colour or position?' },
  { id: '3.3.2', name: 'Labels or Instructions', level: 'A', automation: 'partial', question: 'Does every input have a programmatically associated label? A placeholder is not a label.' },
  { id: '3.3.3', name: 'Error Suggestion', level: 'AA', automation: 'none', question: 'When an error is detected and a correction is known, is it suggested?' },
  { id: '3.3.4', name: 'Error Prevention (Legal, Financial, Data)', level: 'AA', automation: 'none', question: 'Are consequential submissions reversible, checked or confirmable?' },
  { id: '3.3.7', name: 'Redundant Entry', level: 'A', automation: 'none', question: 'Is information the user already entered auto-populated or selectable rather than re-typed?' },
  { id: '3.3.8', name: 'Accessible Authentication (Minimum)', level: 'AA', automation: 'none', question: 'Does login avoid requiring a cognitive function test such as transcribing a puzzle, with no alternative?' },

  // 4. Robust
  { id: '4.1.2', name: 'Name, Role, Value', level: 'A', automation: 'partial', question: 'Does every custom control expose a correct name, role and current value to assistive technology?' },
  { id: '4.1.3', name: 'Status Messages', level: 'AA', automation: 'partial', question: 'Are status changes such as "3 results found" or "added to basket" announced without moving focus?' },
];

export const CRITERIA: SuccessCriterion[] = ROWS.map((r) => ({
  ...r,
  // EN 301 549 clause 9 adopts WCAG criteria one to one for web content.
  en301549Clause: `9.${r.id}`,
}));

const BY_ID = new Map(CRITERIA.map((c) => [c.id, c]));

export function getCriterion(id: string): SuccessCriterion | undefined {
  return BY_ID.get(id);
}

export function criterionExists(id: string): boolean {
  return BY_ID.has(id);
}

/** Criteria a rule engine cannot decide alone. These are what the judgement pass exists for. */
export function criteriaNeedingJudgement(): SuccessCriterion[] {
  return CRITERIA.filter((c) => c.automation !== 'full');
}

/** Criteria no automated or model pass should ever claim to have settled. */
export function criteriaRequiringHuman(): SuccessCriterion[] {
  return CRITERIA.filter((c) => c.automation === 'none');
}

/**
 * The share of criteria a rule engine can fully decide. Reported on every audit
 * so nobody mistakes a clean scan for conformance.
 */
export function automationCoverage(): { full: number; partial: number; none: number; total: number } {
  const full = CRITERIA.filter((c) => c.automation === 'full').length;
  const partial = CRITERIA.filter((c) => c.automation === 'partial').length;
  const none = CRITERIA.filter((c) => c.automation === 'none').length;
  return { full, partial, none, total: CRITERIA.length };
}
