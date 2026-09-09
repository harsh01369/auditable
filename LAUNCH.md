# Launch plan

Everything here is ready to paste. Nothing needs writing.

Ordered by expected value, not effort. Honest expectations are stated for each,
because a plan promising a first sale this week would be the same overclaiming
this product exists to argue against.

---

## Step 0: publish the package (5 minutes, do this first)

Every channel below points at `npx wcag-evidence`. Until it is on npm, every post
is a dead link.

```bash
cd C:\Users\Harsh\source\repos\auditable
npm login            # opens a browser
npm publish --access public
```

Then verify from anywhere:

```bash
npx wcag-evidence https://example.com
```

If `npm login` is awkward, create a granular access token at
npmjs.com/settings/~/tokens, put `NPM_TOKEN=` in `.env`, and I will publish from here.

---

## Step 1: Show HN (highest expected value, one shot)

The single best shot for this product: technical audience, a large EU share, many
of them agency and in-house developers being asked about the EAA right now with no
answer. It rewards intellectual honesty and punishes marketing.

**Post as "Show HN", Tuesday to Thursday, 14:00-16:00 UTC.** Link the GitHub repo,
not the sales page. The sales page one click further reads as honest; as the
landing page it reads as bait.

**Title:**

```
Show HN: Automated tools can fully decide 4 of 55 WCAG criteria. Here's the rest
```

**First comment, post immediately after submitting:**

```
I built this after comparing what the European Accessibility Act actually
requires against what the tools on the market actually check.

axe-core is excellent and I use it as the first pass. But of the 55 WCAG 2.2
Level A and AA criteria, a rule engine can fully decide 4. Another 29 are partly
automatable. 22 cannot be assessed mechanically at all. A scanner tells you an
image has no alt attribute; it cannot tell you the alt text reads "image", that a
link labelled "Read more" fails 2.4.4, or that a heading doesn't describe its
section.

So the second pass is a model reading the rendered DOM and the accessibility
tree. The obvious objection is hallucination, and in this market a false
accusation of non-compliance is worse than useless. So no model claim reaches the
report on the model's authority. It must cite a criterion that exists, resolve to
exactly one element actually captured, quote markup that element genuinely
contains, not overturn a criterion the rule engine fully decided, and not restate
something the engine already found. Everything else is discarded and printed in
the report as rejected, so you can see what it got wrong.

Measured on a held-out corpus written after the prompt was tuned: 5 of 7 defects
the rule engine structurally cannot catch, and 0 false positives on 6
deliberately correct distractors (a short link rescued by aria-label, an image
correctly marked decorative, an input labelled by aria-label, a real table beside
a fake one). On the corpus I tuned against it scores 88%. I quote the 71%,
because a score from the pages you tuned on is a score you gave yourself. Method
and known weaknesses are in EVALUATION.md.

Two things that went wrong and are now load-bearing features.

I set a realistic desktop user agent so it would look "more like a real browser".
That tripped Cloudflare's bot check, and my auditor happily analysed the "Just a
moment..." interstitial and reported it as nearly clean. It now refuses to audit
any page it cannot show is the real page.

Then I ran it against my own accessibility sales page. 15 contrast failures. A
muted grey computed to 4.30:1 against a 4.5:1 requirement, invisible to the eye.
The same token was in the report template, so every report it had generated
carried the defect.

It never reports absence of findings as conformance. On the W3C's own demo page
it establishes 1 criterion of 55 as passing and says so on the first page. The
rest are reported as failed, not established, or needing a person, with a manual
test procedure for each.

npx playwright install chromium && npx wcag-evidence https://your-site.example

The most useful contribution would be a failing fixture: a page with a defect it
misses, or a correct element it wrongly flags. Both go straight into the corpus.
```

**Answer the hard comments first.** Two will come. *"This is just axe-core with an
LLM bolted on"*: the verification layer and the published false-positive count are
the product, and axe finds 0 of those 7. *"LLMs hallucinate, this is dangerous"*:
agreed, which is exactly why nothing unverifiable is reported, and the rejected
list is printed in every report.

---

## Step 2: LinkedIn (same day, different audience)

Reaches the buyers HN does not: agency owners, compliance people, ecommerce
managers. Post the story, not the tool.

```
I built an accessibility auditing tool, pointed it at my own accessibility sales
page, and it failed.

15 contrast violations. A muted grey computed to 4.30:1 against the 4.5:1
minimum. Completely invisible to the eye. The same colour was in my report
template, so every report the tool had produced carried the same defect.

That is the whole problem in one incident. It is not that people don't care. It
is that the failures are often invisible to the person checking, and the tools
that promise to catch them mostly can't.

Here is the number that should worry anyone relying on a scanner: of the 55 WCAG
2.2 Level A and AA criteria the European Accessibility Act requires, an automated
rule engine can fully decide 4. Twenty-two cannot be assessed automatically at
all.

A clean scan is not conformance. It is a clean scan.

The EAA has been enforceable since June 2025. German operators are receiving
warning letters. French retailers had injunctions filed in November. And in April
2025 the FTC fined an accessibility overlay vendor $1,000,000 for claiming its
widget made sites compliant.

I have open-sourced the engine. It reports all 55 criteria as failed, passed, not
established, or needs-a-person, and refuses to call absence of findings a pass.
It also publishes the claims it rejected during verification, because a report
that hides its mistakes is indistinguishable from one that never made any.

npx wcag-evidence https://your-site.example

Free. If you run it on your own site, I would genuinely like to know what it got
wrong.
```

---

## Step 3: Reddit (free, targeted, allergic to selling)

Post the tool, never the price. Any whiff of a pitch gets removed.

- **r/accessibility** — most valuable and harshest. They have seen a hundred AI
  accessibility tools and despise overlays. Lead with the verification layer and
  the published false-positive count. Their acceptance is worth more than any
  other signal.
- **r/webdev** — lead with the 4-of-55 number and the self-audit failure.
- **r/ecommerce** — lead with the EAA deadline and the microenterprise exemption.
  Half of them are exempt, and telling them so buys enormous credibility.

Suggested r/accessibility title:

```
I built an LLM-assisted WCAG auditor and made it prove every finding against the
DOM. Published the false positive count and the corpus. Tear it apart.
```

---

## Step 4: Upwork and Fiverr (slowest setup, fastest actual cash)

The only channel that produces money **without first solving distribution**: the
buyers are already searching, and the platform handles payment, so the first sale
needs no Stripe account at all.

Search "EAA compliance", "WCAG audit", "accessibility audit". There is live demand
at £200 to £2,000 per engagement.

Profile positioning nobody else there can claim:

```
WCAG 2.2 AA and EN 301 549 conformance audits with verifiable evidence.

Every finding cites the success criterion, the element, and the markup exactly as
your server returned it, so your developer can act on it and your lawyer can
check it.

I do not use accessibility overlays. In April 2025 the FTC fined a major overlay
vendor $1,000,000 for claiming its widget produced compliance, and sites running
overlays are sued more often, not less.

I also will not certify conformance from a scan, because it isn't possible.
Automated tooling can fully decide 4 of the 55 Level A and AA criteria. My
reports state which criteria were established, which were not, and what still
requires human testing, with a procedure for each.

My tooling is open source and its accuracy is published, including its known
weaknesses: github.com/harsh01369/auditable
```

An open-source tool with a published evaluation is a credential no other seller on
those platforms has.

---

## The trap: do not cold-email German businesses

The obvious move is to audit EU ecommerce sites and email them the findings. Do
not do that in Germany.

German §7 UWG treats unsolicited commercial email as an unfair commercial practice
and generally requires prior consent, **including business to business**. That is
the same Abmahnung machinery currently generating accessibility warning letters.
Building this business on that dynamic and then collecting a warning letter for
cold email would be more than embarrassing.

Defensible alternatives:

- Publishing things people find, which is Steps 1 to 3.
- LinkedIn connection requests and messages, a different legal regime.
- Replying where someone has publicly asked about EAA compliance.
- **Web agencies rather than end businesses.** One agency carries dozens of EU
  clients, is being asked this question now, has no answer, and can resell. Fifty
  agency owners on LinkedIn beats a thousand cold emails, and it is legal.

Never publish an audit naming another company. Sending a business its own audit
privately is normal professional practice. Publishing it is defamation risk and,
more to the point, unkind.

---

## What success looks like, honestly

- **Week 1:** published and launched on three channels. Realistic outcome is 100
  to 3,000 GitHub visitors and between 0 and 40 stars. A Show HN that misses the
  front page is normal and is not a failed product.
- **Weeks 2-6:** first inbound enquiry, most likely an agency or an in-house
  developer whose company just got asked about the EAA. First paid engagement most
  likely arrives via Upwork rather than inbound.
- **Month 2-3:** if the tool is being used, the sales page converts a small
  fraction. If nobody uses the tool, no amount of Stripe configuration fixes that.

The measurement that matters early is not stars or traffic. It is **whether anyone
runs it against a site we did not choose**, because that is the only evidence the
problem is felt rather than merely real.
