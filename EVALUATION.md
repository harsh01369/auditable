# Evaluation

Measured on 9 September 2026. Reproduce with `npx tsx eval/run.ts --held-out`.

## Why this document exists

The product's claim is that a verified judgement pass finds accessibility
defects a rule engine structurally cannot. That is a testable claim, and a
product built on rigour has no business asking anyone to take it on trust.

## Method

Two corpora of hand-built pages with planted defects and, just as importantly,
**distractors**: elements that are deliberately correct, often in ways that
superficially resemble a defect. A short link rescued by `aria-label`. An image
correctly marked decorative with `alt=""`. An input labelled by `aria-label`
rather than a `<label>`. A semantic `<table>` next to a fake one.

Distractors are the point. A tool that reports everything achieves perfect
recall and is worthless, and in this market a false accusation of
non-compliance is not a harmless extra line in a report.

Each defect is labelled with the success criterion it fails and with which pass
ought to catch it, so the judgement pass is scored on the work it exists to do
rather than credited for what the rule engine already found. Where more than one
criterion is a defensible way to report the same defect, all of them count as a
hit: axe reports a missing label under 4.1.2 where we wrote 3.3.2, and both are
right. Scoring only our preferred criterion would have penalised a correct
finding and flattered the judgement pass by comparison.

**Tuning and held-out split.** The first corpus was used to improve the prompt.
Quoting a score from the same pages you tuned against is overfitting, so a
second corpus was written afterwards, in the same defect classes but with
different instances, run once, and not iterated on. The held-out number is the
only one worth quoting. The gap between the two is reported below precisely
because it shows how much tuning inflates a score.

Judgement provider: `openai/gpt-oss-120b` via Groq, free tier. Claude Opus 5 is
the intended production model and has not been measured yet; these numbers are
therefore a floor rather than a ceiling.

## Results

### Held-out corpus (the number we stand behind)

10 planted defects, 6 distractors, 1 page.

| Measure | Result |
|---|---|
| Recall on defects only judgement can catch | **5/7 (71%)** |
| Recall on defects either pass could catch | 3/3 (100%) |
| Overall recall | 8/10 (80%) |
| **False positives on distractors** | **0 of 6** |

The "either" row improved from 2/3 after a deterministic fix described under
Known weaknesses. That fix was made after seeing held-out results, which is a
mild contamination of the split and is disclosed here rather than quietly
absorbed. It is an engine bug fix rather than prompt tuning, and the
judgement-only figure of 71% is unaffected by it.

### Baseline: rule engine alone

On the held-out corpus the rule engine alone finds **0 of 7** judgement-only
defects and 2 of 10 overall. On the tuning corpus it found **0 of 8** in the
judgement-only category and 1 of 11 overall. That is
not a criticism of axe. It is the measurement of the gap the product exists to
close, and it is why a clean scan is not conformance.

### Tuning corpus, for comparison

11 planted defects, 9 distractors, 2 pages.

| Measure | Before prompt tuning | After |
|---|---|---|
| Judgement-only recall | 6/8 (75%) | 7/8 (88%) |
| Overall recall | 7/11 (64%) | 9/11 (82%) |
| False positives | 0 of 9 | 0 of 9 |

88% tuned against 71% held out. Anyone quoting the 88% would be quoting an
artefact of their own prompt engineering.

## Known weaknesses

Two defect classes were missed on both corpora, so these are characteristics of
the system rather than noise:

1. **Alternative text that repeats an adjacent visible caption.** Missed on both
   corpora even after the rubric named the pattern explicitly. It requires
   relating an image to nearby text rather than reading the image in isolation.
2. **Label-in-name mismatch (2.5.3).** ~~Missed on both corpora.~~ **Fixed.**
   This one is mechanically decidable, and the cause was ours: axe tags
   `label-content-name-mismatch` as experimental and therefore excludes it by
   default, even under a WCAG tag filter. It is the only mechanical check for
   2.5.3, so it is now enabled explicitly. The engine catches it directly, with
   no new false positives on either corpus.

   This is the evaluation earning its keep. Without a labelled corpus we would
   have shipped a tool that silently never tested a Level A criterion.

Div-based tabular content (1.3.1) was found on the tuning corpus and missed on
the held-out one, so treat it as unreliable rather than solved.

## What these numbers are not

The corpora are small, hand-built, and written by the same person who wrote the
rubric. They are English-language, static, and free of frameworks, cookie
banners, single-page-app routing and the other things that make real sites hard.
They measure whether the judgement pass can read markup and apply a criterion.
They do not establish that an audit of a real commercial site is 71% complete,
and no reader should take them that way.

Criteria requiring keyboard operation, screen reader output, focus movement,
timing or error handling are not evaluated here at all, because the system does
not attempt them and reports them as needing a person.

## Next

- Measure Claude Opus 5 on the same held-out corpus.
- Investigate the caption-echo miss, the one weakness that survived tuning.
- Grow the held-out corpus, and add pages built with a real framework.
