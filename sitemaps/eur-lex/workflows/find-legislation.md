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

```bash
opencli eur-lex search "facial recognition" --exact
opencli eur-lex search "facial recognition" --exact --page 2     # next ten
opencli eur-lex search "biometr*"                                 # wildcard
```

Columns: `celex, date, form, act, title, url`; the result total is in the footer. Ten per page.

This command needs the Browser Bridge connected — it drives the site's own search page, because EUR-Lex full-text search exists nowhere else (`pitfalls.md#waf_answers_202`). It is the only command in this repo that requires a browser.

Without `--exact` the words are OR-ed: `facial recognition` gives 904 results, `"facial recognition"` gives 356. `--exact` adds the quotes for you. Wildcards: `term*` for variations, `ca?e` for one character.

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
on_adapter_fail:
  - adapter_health_update: opencli eur-lex search -> suspect
  - the command raises COMMAND_EXECUTION when the page it lands on is not the
    results page (challenge, outage, redirect); it does NOT return an empty list
  - drive the same URL by hand, then action:list_results in pages/results.md:
      opencli browser <sess> open 'https://eur-lex.europa.eu/search.html?scope=EURLEX&text=%22facial+recognition%22&lang=en&type=quick'

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
- Reporting a total without reading it: `opencli eur-lex search` puts it in the footer, so use that rather than counting rows.
- Forgetting `--exact` on a multi-word query and then reporting the count: the OR-ed number is two to three times larger.
- Keeping `qid`/`rid` in a link you intend to save or cite.
- Concluding "the EU has not legislated on this" from a search that found nothing without having tried a wildcard and a synonym. `facial recognition` appears twice in the AI Act, `biometric identification` 57 times.

## State validation

Every harvested row yields a CELEX that `opencli eur-lex meta` resolves. If meta returns EMPTY_RESULT, the CELEX was misread from the href.

## Stale markers

If `search.html` starts refusing deep links without `qid`, or if `eur-lex.europa.eu` stops answering 202 to plain HTTP clients (the WAF removed), this workflow needs rewriting — the second case would allow a real search adapter.
