---
schema_version: 1
last_verified: 2026-08-28
source: local
---

# eur-lex.europa.eu pitfalls

### pitfall:waf_answers_202
trigger: any HTTP request to `eur-lex.europa.eu` from something that is not a real browser — curl, fetch, an adapter
symptom: `HTTP 202`, `content-type: text/html`, an empty or ~2 KB body containing `window.awsWafCoo…`. Not a 403, so naive code reads it as success and parses nothing.
workaround: use a real browser (`opencli browser`) for the site itself, and `publications.europa.eu` for data. Do not attempt to defeat the challenge.
verified_at: 2026-08-28 (`/advanced-search-form.html` and `/legal-content/EN/TXT/?uri=CELEX:32024R1689` both 202, with and without a browser User-Agent; the same pages load normally in `opencli browser`)

### pitfall:cellar_accept_types_are_narrow
trigger: assuming Cellar negotiates any content type
symptom: 404 or 400 on types that look reasonable
workaround: the verified working set for `https://publications.europa.eu/resource/celex/<CELEX>` is `application/xhtml+xml` (the act, ~1.2 MB for the AI Act), `application/pdf`, `application/xml;notice=object` (~5 KB) and `application/xml;notice=branch` (~1.5 MB). Bare `application/xml`, `text/html` and `text/plain` answer **404**; `application/zip` answers **400**.
verified_at: 2026-08-28

### pitfall:cellar_needs_accept_language
trigger: calling Cellar without an `Accept-Language` header
symptom: `HTTP 400` — `Invalid content type BRANCH for WORK ['cellar:…'] without language`
workaround: always send `Accept-Language: eng` (ISO 639-3, three letters — not `en`)
verified_at: 2026-08-28

### pitfall:qid_rid_are_session_ids
trigger: copying a result link straight out of the page, `…?uri=CELEX:32024R1358&qid=1787924198046&rid=1`
symptom: the URL carries a query id tied to a search session and rots
workaround: keep only `uri=CELEX:<celex>`. Search deep links also work without `qid`: `search.html?scope=EURLEX&text=…&lang=en&type=quick` was verified to load results on its own.
verified_at: 2026-08-28

### pitfall:result_metadata_labels_are_localised
trigger: parsing a result row's `dt`/`dd` metadata by position, or matching English labels on a page loaded in another language
symptom: fields shift or match nothing
workaround: parse `dt`/`dd` pairs by label, and pin `lang=en` in the URL. The labels seen are `Latest consolidated version:`, `CELEX number:`, `Languages:`, `Form:`, `Author:`.
verified_at: 2026-08-28

### pitfall:result_total_is_in_the_page_text
trigger: looking for the result total in an element with a class of its own
symptom: no `.SearchResultsCount` or similar; a naive selector finds nothing and you conclude there is no total
workaround: the total lives in the page text as `Results 1 - 10 of 356`. Read it with a regex over `document.body.innerText`: `/Results\s+(\d+)\s*-\s*(\d+)\s+of\s+([\d\s.,]+)/`. Ten results per page, `page=N` for the next.
verified_at: 2026-08-28 (`"facial recognition"` → 356, `biometr*` → 3246)

### pitfall:celex_is_not_in_law_tracker
trigger: trying to jump from a Law Tracker procedure to its CELEX number, or the reverse
symptom: neither side carries the other's identifier. A SPARQL probe for a procedure property on the AI Act work (`FILTER CONTAINS(?o, "2021/0106")`) returned nothing.
workaround: bridge on the title or the act number (`Regulation (EU) 2024/1689` ⇄ CELEX `32024R1689`), and say that the link is inferred, not asserted by either source.
verified_at: 2026-08-28
