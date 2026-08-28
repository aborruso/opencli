---
schema_version: 1
page_id: results
url_patterns:
  - https://eur-lex.europa.eu/search.html
purpose: search results, ten per page, each carrying its CELEX number
last_verified: 2026-08-28
source: local
---

# Search results

## URL shape

```
/search.html?scope=EURLEX&text=<urlencoded>&lang=en&type=quick
/search.html?scope=EURLEX&text=<urlencoded>&lang=en&type=quick&page=2
```

`page` is one-based and page 2 was verified to return a different first row. Keep `lang=en`: the row metadata labels follow it. Ignore `qid` and `rid` when you see them in links — they are session ids, see `pitfalls.md#qid_rid_are_session_ids`.

## Visual anchors

- text: document title `Search results - EUR-Lex`
- css: `.SearchResult` — one per result, ten per page
- css: `.SearchResult h2 a.title` — the title, with `href` `./legal-content/AUTO/?uri=CELEX:<celex>&qid=…&rid=N`

## Actions on this page

### action:list_results
pre: a `/search.html?...` URL is loaded
do: read `.SearchResult` elements; take the title from `h2 a.title` and the CELEX from the `uri=CELEX:` parameter of its href
post: up to ten rows, each with a title and a CELEX number
fail: zero `.SearchResult` elements | HTTP 202 with an empty body
recover: on 202 see `pitfalls.md#waf_answers_202`; on zero results widen the query or drop the quotes
evidence: opencli browser <sess> eval '[...document.querySelectorAll(".SearchResult")].length' → 10; first href `./legal-content/AUTO/?uri=CELEX:32024R1358&qid=…&rid=1`

### action:read_row_metadata
pre: a result row in hand
do: read the row's `dt`/`dd` pairs **by label**, never by position
post: `CELEX number:`, `Form:`, `Author:`, `Languages:`, `Latest consolidated version:`
fail: fields shifted or empty
recover: the page is probably not in English; pin `lang=en`. See `pitfalls.md#result_metadata_labels_are_localised`
evidence: opencli browser <sess> eval over the first row's dt/dd → `CELEX number: 32024R1358`, `Form: Regulation`, `Author: European Parliament, Council of the European Union`

### action:leave_for_the_adapter
pre: you have the CELEX numbers
do: stop using the browser — `opencli eur-lex meta <celex>` and `opencli eur-lex get <celex>`
post: metadata and full text without the WAF, in a structured form
fail: ARGUMENT on a malformed CELEX
recover: check the CELEX read off the href; consolidated versions look like `02024R1358-20240522`
evidence: opencli eur-lex meta 32024R1689 → title, date 2024-06-13, type REG, 7 EuroVoc concepts

## Do not count

There is no reliable total on this page. Report what you paged through. See `pitfalls.md#no_reliable_result_total`.
