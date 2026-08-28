---
schema_version: 1
workflow_id: find-legislation
intent: find the EU acts that deal with a subject, even one no title names
last_verified: 2026-08-28
source: local
---

# Find legislation on a subject

## Goal

From a subject in plain words ("facial recognition with cameras") to a list of acts with their CELEX numbers, then to their text.

## State signature

None until you have CELEX numbers. Once you do, the browser is no longer needed.

## Best path

**The browser, and only for the search step.** There is no adapter for this: EUR-Lex full-text search lives behind the WAF (`pitfalls.md#waf_answers_202`). This is the one place in this repo where the browser is the best path rather than the fallback.

```bash
opencli browser <sess> open 'https://eur-lex.europa.eu/search.html?scope=EURLEX&text=%22facial+recognition%22&lang=en&type=quick'
```

Then `action:list_results` in `pages/results.md` to harvest titles and CELEX numbers, `&page=2` for the next ten.

Search syntax: `"exact phrase"`, `term*` for variations, `ca?e` for one character.

## Then leave the browser

```bash
opencli eur-lex meta 32024R1689     # title, date, type, EuroVoc concepts
opencli eur-lex get 32024R1689      # full text, no browser, no WAF
```

Grepping the text you just pulled is often faster than refining the search:

```bash
opencli eur-lex get 32024R1689 -f json | jq -r '.[0].text' > aiact.txt
grep -c -i "biometric identification" aiact.txt
```

## Fallback path

```yaml
on_browser_unavailable:
  - the Browser Bridge is not connected: opencli doctor says "Extension: not connected"
  - full-text search is simply unavailable; do not fall back to curl, it returns 202
  - if you already know the act (its number, or the procedure behind it), skip search entirely:
      opencli eur-lex meta <celex>
  - to go from a subject to a candidate act without full text, ask the process side instead:
      opencli law-tracker search "<words that appear in a procedure title>"
      then bridge on the act number - see ../SITE.md, "Related sitemap"
```

## Avoid

- Filling in the advanced search form when a `search.html?...` URL expresses the query.
- Reporting a total without reading it: it is in the page text (`Results 1 - 10 of 356`), so read it rather than counting rows or guessing.
- Keeping `qid`/`rid` in a link you intend to save or cite.
- Concluding "the EU has not legislated on this" from a search that found nothing without having tried a wildcard and a synonym. `facial recognition` appears twice in the AI Act, `biometric identification` 57 times.

## State validation

Every harvested row yields a CELEX that `opencli eur-lex meta` resolves. If meta returns EMPTY_RESULT, the CELEX was misread from the href.

## Stale markers

If `search.html` starts refusing deep links without `qid`, or if `eur-lex.europa.eu` stops answering 202 to plain HTTP clients (the WAF removed), this workflow needs rewriting — the second case would allow a real search adapter.
