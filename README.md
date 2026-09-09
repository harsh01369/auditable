# wcag-evidence

**Accessibility audits that show their working.** WCAG 2.2 Level A and AA, as adopted by EN 301 549 for the European Accessibility Act.

```bash
npx playwright install chromium
npx wcag-evidence https://your-site.example --report report.html
```

No account, no key, no signup. The rule-engine pass runs on its own; add an API key and it also runs the judgement pass described below.

---

## The number nobody selling you a scanner shows you

**A rule engine can fully decide 4 of the 55 Level A and AA success criteria.**

Another 29 are only partly automatable. **22 cannot be assessed by any automated method at all.**

A scanner tells you an image has no `alt`. It cannot tell you the alt text reads `"image"`, that a link labelled `"Read more"` fails 2.4.4, or that a heading does not describe the section under it. That judgement is most of an audit, which is why a clean scan is not conformance and a green dashboard is not a defence.

This tool reports all 55 criteria as **failed, passed, not established, or needs a person**, and only calls something passed when a rule engine fully decides it and did. On the W3C's own demonstration page, that is 1 criterion out of 55, and the report says so on the first page.

## How it works

1. **Rule engine.** axe-core settles what is mechanical, reproducibly.
2. **Judgement.** A model reads the rendered DOM, the browser-computed accessibility tree and every interactive element, and reports what the engine structurally cannot see.
3. **Verification.** Every model claim is checked against the captured page before it may be called a finding.

A claim reaches your report only if it survives all five checks:

- the success criterion it cites exists in WCAG 2.2 A/AA;
- its selector resolves to exactly one element we really captured;
- the markup it quotes genuinely appears in that element;
- it does not overturn a criterion the engine fully decided and found clean;
- it does not restate a defect the engine already reported.

Claims that fail are counted and **printed in your report as rejected**, not silently dropped. A report that hides its rejects is indistinguishable from one that never made any.

**The model is allowed to be wrong. It is not allowed to be believed.** In April 2025 the FTC ordered accessiBe to pay **$1,000,000** for claiming its widget could make a site WCAG compliant. Unverified automated accessibility claims are not a defence; they are a liability with a subscription attached.

## How accurate is it

Measured, not asserted. Full method in [EVALUATION.md](./EVALUATION.md).

| | Rule engine alone | With judgement |
|---|---|---|
| Defects automation structurally cannot catch | **0 of 7** | **5 of 7 (71%)** |
| False positives on deliberately correct elements | 0 | **0 of 6** |

That 71% is from a **held-out** corpus written after the prompt was tuned and run once. On the corpus used for tuning it scores 88%. We quote the 71%, because a score from the pages you tuned on is a score you gave yourself.

The corpus contains distractors on purpose: a short link rescued by `aria-label`, an image correctly marked decorative, an input labelled by `aria-label`, a real table beside a fake one. A tool that reports everything has perfect recall and no value.

## Two things it refuses to do

**It will not audit a page it cannot show is the real page.** Bot challenges, cookie walls, login screens and error pages all return HTTP 200 and all look clean to a scanner. An early version of this tool set a realistic desktop user agent to look "more like a browser", tripped Cloudflare's bot check, and cheerfully audited the *"Just a moment..."* interstitial. It now refuses.

**It will not report absence of findings as conformance.** See above.

We also ran it against our own accessibility sales page. It found **15 contrast failures**, because a muted text colour computed to 4.30:1 against a 4.5:1 requirement. Invisible to the eye. The same token was in the report template, so every report we had generated carried the defect. Fixed, and the story is here because a tool you cannot catch being wrong is a tool you cannot trust.

## Usage

```bash
# Rule engine only, no key required
npx wcag-evidence https://example.com

# Crawl the site, honouring robots.txt and crawl-delay
npx wcag-evidence https://example.com --crawl 25

# Full audit with the judgement pass
ANTHROPIC_API_KEY=sk-... npx wcag-evidence https://example.com --provider anthropic

# Evidence pack you can hand to a developer or a lawyer
npx wcag-evidence https://example.com --crawl 10 --report report.html --json result.json
```

| Flag | Meaning |
|---|---|
| `--crawl N` | Discover up to N pages from the start URL, via sitemap then links |
| `--provider` | `anthropic`, `groq`, or `none` |
| `--report FILE` | Write the HTML evidence pack |
| `--json FILE` | Write the full machine-readable result |
| `--batch-size N` | Elements per judgement request (default 30) |
| `--delay MS` | Pause between judgement batches, for rate limits |

Keys are read from the environment or a local `.env`. Without one, the judgement pass is skipped and the audit runs deterministically, which is honest but is only a small part of a real audit.

### What the report contains

- Every finding with the element, the markup **as your server sent it**, the success criterion and its EN 301 549 clause
- A coverage table for all 55 criteria, with the basis for each verdict
- The claims rejected during verification
- **A manual test plan**: for every criterion no machine can settle, what to do and what failure looks like, written so a developer who is not an accessibility specialist can carry it out
- A draft accessibility statement that deliberately will not claim full conformance

### As a library

```ts
import { audit, renderReport } from 'wcag-evidence';

const result = await audit({ urls: ['https://example.com'], crawl: 10 });
console.log(result.coverage.filter((c) => c.status === 'fail'));
```

## Why this exists

The European Accessibility Act has been enforceable since **28 June 2025**. German e-commerce operators are receiving warning letters from law firms. In France, injunctions were filed in November 2025 against Auchan, Carrefour, E.Leclerc and Picard. Penalties reach **€100,000**.

The two things a business can buy today are both bad: a manual audit at $2,000 to $8,500 that takes weeks, or an overlay widget that a regulator has formally discredited. Between a free scanner and a five-figure engagement, there was nothing.

**You may not even be covered.** The EAA exempts microenterprises from its service requirements: **under 10 employees and under €2m** turnover or balance sheet total, both conditions, services only, aggregated across corporate groups, no grace period on crossing a threshold. If that is you, use this tool and pay nobody.

If you want the work done for you, including the manual testing this tool correctly refuses to guess at, that service is at **[harsh01369.github.io/auditable](https://harsh01369.github.io/auditable/)**.

## Contributing

The most valuable contribution is a **failing fixture**: a page with a defect this misses, or a correct element it wrongly flags. Both go straight into the evaluation corpus. See `eval/fixtures`.

MIT. Not legal advice, and not a certificate of conformance.
