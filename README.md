# Auditable

Evidence-grade accessibility conformance auditing for the European Accessibility
Act, against WCAG 2.2 Level A and AA as adopted by EN 301 549.

## Why this exists

Since 28 June 2025 the European Accessibility Act has been enforceable. German
e-commerce operators are receiving warning letters from law firms, the first EAA
lawsuits were filed in France in November 2025, and penalties reach €100,000.

The two things a business can buy today are both bad. A human audit costs
$2,000 to $8,500 and takes weeks. An overlay widget costs a few hundred a year
and does not work: in April 2025 the FTC ordered accessiBe to pay $1,000,000
for claiming its widget could make a site WCAG compliant, courts have
consistently rejected overlay defences, and in the first half of 2025 22.6% of
US web accessibility lawsuits targeted sites that had an overlay installed.

Between a free scanner and a five-figure engagement there is nothing good.

## The technical problem

A rule engine can fully decide about 4 of the 55 Level A and AA criteria, and
partly help with 29. It can tell you an image has no `alt`. It cannot tell you
that `alt="image"` is useless, that a link reading "read more" fails 2.4.4, or
that a heading does not describe its section. That judgement is most of an
audit, and it is why a clean scan is not conformance.

## How this works

Three passes, in order.

1. **Deterministic.** axe-core settles what can be settled mechanically, and
   reproducibly. Anyone can re-run it and get the same answer.
2. **Judgement.** A model reads the captured DOM, the browser-computed
   accessibility tree and the element inventory, and reports what the engine
   structurally cannot see.
3. **Verification.** Every model claim must survive four checks against the
   captured evidence before it may be called a finding:
   - the success criterion it cites must exist in WCAG 2.2 A/AA;
   - its selector must resolve to exactly one element we actually captured;
   - the markup it quotes must genuinely appear in that element;
   - it may not overturn a fully automatable criterion the engine found clean.

   Claims that fail are counted and disclosed, never shown as defects.

That third pass is the product. An accessibility tool that asserts unverified
defects is not a defence, it is a liability, which is the lesson of the accessiBe
order. Here the model is allowed to be wrong; it is not allowed to be believed.

Because correctness lives in verification rather than in the model, a cheaper
model degrades the audit gracefully: it finds less, and what it invents is
discarded.

## Two things it refuses to do

**It will not audit a page it cannot show is the real page.** Bot interstitials,
consent walls, login screens and error pages all return HTTP 200 and all look
clean to a scanner. An early run of this tool audited Cloudflare's "Just a
moment..." challenge page and reported a single finding, because a hand-set user
agent had tripped the bot check. `src/capture/integrity.ts` now stops the audit
instead, and the user agent is no longer spoofed.

**It will not report absence of findings as conformance.** Every criterion is
reported as failed, passed, not tested, or needing human review. Only criteria a
rule engine fully decides and found clean are reported as passed. On the W3C's
demonstration page that is 1 criterion out of 55, and the report says so.

## Running it

```bash
npm install
npx playwright install chromium
cp .env.example .env      # add a key for the judgement pass
npm test                  # 27 tests, mostly on the verification layer

npx tsx src/cli.ts https://example.com --provider none          # engine only
npx tsx src/cli.ts https://example.com --provider anthropic     # full audit
npx tsx src/cli.ts https://example.com --json result.json --report report.html
npx tsx src/cli.ts https://example.com --provider groq --batch-size 22 --delay 32000
```

`--report` writes the evidence pack: findings with the element, the markup as
served, the success criterion and its EN 301 549 clause; a coverage table for all
55 criteria; the claims rejected during verification, published rather than
hidden; and a draft accessibility statement that deliberately will not claim full
conformance.

The judgement pass is batched. Small batches are not only a way to fit token
budgets: a model asked to judge thirty elements attends to each of them, where
one asked to judge two hundred skims and reports the obvious few.

Without a key the judgement pass is skipped and the audit runs deterministically,
which is honest but is only a small part of a real audit.

## Status

Working end to end, including the report and the draft accessibility statement.

On the W3C's demonstration page the rule engine records 53 findings and the
judgement pass adds 7 that it structurally cannot see, all of them 2.4.4 link
purpose: link text such as "public", "Member" and an unexplained "WAI-AGE"
acronym. In the same run verification rejected 6 further claims because the rule
engine had already reported those defects, and the report lists them as rejected
rather than counting them.

The judgement pass has not been evaluated for precision against a labelled
corpus, so no accuracy figure is claimed here. That evaluation is the next thing
worth building.

This is not legal advice.
