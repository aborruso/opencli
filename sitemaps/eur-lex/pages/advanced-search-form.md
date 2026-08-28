---
schema_version: 1
page_id: advanced-search-form
url_patterns:
  - https://eur-lex.europa.eu/advanced-search-form.html
  - https://eur-lex.europa.eu/advanced-search-form.html?locale=en
purpose: the full search form — text, CELEX, dates, document type, author, EuroVoc
last_verified: 2026-08-28
source: local
---

# Advanced search form

A long form with many collapsed sections. **Do not fill it in when a URL will do**: `pages/results.md` documents the deep links, which cost one navigation instead of a dozen.

Fill in the form only for criteria the URL cannot express — the date, author and document-type pickers that build their own opaque parameters.

## Visual anchors

- text: document title `Advanced search - EUR-Lex`
- a11y: `button "Text search"` and `button "Search by Celex number"` — the two entry points of the form
- ⚠️ the page carries several unlabelled `input[type=text]` elements; never target them by position

## Search syntax (documented by the site itself)

- `"exact phrase"` — double quotes for an exact phrase
- `transp*`, `32019R*` — an asterisk for variations of a term
- `ca?e` — a question mark for a single character, matching case, cane, care

Worth knowing: on `"facial recognition"` versus `facial recognition` versus `biometr*` the first page returned 10 results in each case, so quoting cannot be told apart from a page count alone. Trust the documented behaviour, verify on the actual rows.

## Actions on this page

### action:open_form
pre: none; the page is public
do: navigate to `/advanced-search-form.html?locale=en`
post: document title `Advanced search - EUR-Lex`
fail: HTTP 202 with an empty body — you are not in a real browser
recover: see `pitfalls.md#waf_answers_202`; there is no HTTP-client path to this page
evidence: opencli browser <sess> open https://eur-lex.europa.eu/advanced-search-form.html?locale=en → state reports `title: Advanced search - EUR-Lex`; the same URL over curl → 202, 0 bytes

### action:search_by_url
pre: you know the search terms
do: skip the form and navigate to `/search.html?scope=EURLEX&text=<urlencoded>&lang=en&type=quick`
post: document title `Search results - EUR-Lex`, `pages/results.md` applies
fail: the results page loads with no `.SearchResult` element
recover: check `text` is URL-encoded (quotes become `%22`, spaces `+`) and that `lang=en` is present
evidence: opencli browser <sess> open '…/search.html?scope=EURLEX&text=%22facial+recognition%22&lang=en&type=quick' → 10 `.SearchResult` rows, the first being Regulation (EU) 2024/1358 (Eurodac)

## Linked APIs

None reachable: the search endpoint lives behind the WAF. Data retrieval happens on `publications.europa.eu` instead — see `pages/document.md`.
