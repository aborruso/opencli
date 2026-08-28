---
schema_version: 1
last_verified: 2026-08-28
source: local
---

# law-tracker.europa.eu pitfalls

### pitfall:filters_ignored_with_free_text
trigger: `POST /search` with `quickSearch` or `title` set **together with** `status` or `stage`
symptom: the response contains rows that violate the filter — status `WIT` under an `ong` filter, current stage `EOP` under an `FR` filter. No error, no warning.
workaround: do not combine them. Use `--keyword` instead of free text — unlike status and stage it is not ignored: with `quickSearch` set the result narrows to zero rows rather than returning the text-only result — or filter downstream on the `status` and `currentStage` columns. `opencli law-tracker search` refuses the combination with an ARGUMENT error.
verified_at: 2026-08-28 (two probes: stage FR + "artificial intelligence" → rows at stage EOP; title "artificial intelligence" + status ong → a WIT procedure. On their own the filters work; `topics` and `procedure` do stay in AND.)

### pitfall:search_is_title_only
trigger: expecting free text to search the content of the acts, e.g. looking for a subject that is regulated but never named in a procedure title
symptom: zero results for a subject the EU has legislated on. `biometric`, `facial recognition`, `video surveillance` all return nothing, while `artificial intelligence` returns three procedures.
workaround: search the words that appear in procedure titles and short titles, not the subject matter. To reach a topic that titles do not name, come from the other side: `--eurovoc`/`--policyArea`, or the instrument you already know regulates it. For full text of the acts, this site is the wrong tool - go to EUR-Lex, covered by `sitemaps/eur-lex/`.
verified_at: 2026-08-28 (also checked against the raw API with `countResults:true`: `quickSearch:"biometric"` → `totalResults: 0`, so it is the backend, not the adapter)

### pitfall:total_results_zero
trigger: reading `totalResults` from a `/search` response with `countResults:false`
symptom: it reads `0` even when `searchResults` is populated
workaround: never use it as a count; the adapter maps it to no column
verified_at: 2026-08-28

### pitfall:sparse_search_body
trigger: sending `/search` only the fields you need
symptom: counts differ from the UI's for the same filter
workaround: always send the complete SearchCriteria envelope and overlay the active fields
verified_at: 2026-08-28 (origin: the eutrack project, reconfirmed here)

### pitfall:sort_date_is_docd
trigger: sorting `/search` by date with `sort:{order:"DATE"}`, as the results page's own `sort=DATE` URL parameter suggests
symptom: HTTP 400
workaround: in the body the value is `DOCD` (`{"order":"DOCD","direction":"DESC"}` → newest first). The only accepted values found are `REL` and `DOCD`; `DOCD_DESC` and `DATE_DESC` both 400. The adapter accepts `--sort DATE` and translates.
verified_at: 2026-08-28 (DOCD/DESC → 2026-07-29 on top; DOCD/ASC → 2004-07-07)

### pitfall:cookie_banner_intercepts_clicks
trigger: the first click on the homepage with a fresh browser profile
symptom: `Element is covered by <a … inside div#cookie-consent-banner>`; the click lands on the banner
workaround: dismiss the banner (`Accept only essential cookies`) before anything else, or skip the homepage entirely by navigating to a `/results?...` URL
verified_at: 2026-08-28

### pitfall:generic_page_title
trigger: using the document title as a state signature
symptom: `EU Law Tracker - European Union` is identical on the homepage and on a non-existent procedure. Only `/results` has a title of its own (`Search results`).
workaround: anchor on content instead — the `textbox "Quick search"` for the homepage, the reference link for a procedure
verified_at: 2026-08-28

### pitfall:silent_empty_procedure
trigger: navigating to `/procedure/<ref>` with a non-existent reference
symptom: HTTP 200, no error message, a page with header, menu and footer only
workaround: check that the reference link is present (`find --role link --text "<year>/<number>"`); over the API the signal is unambiguous (HTTP 400)
verified_at: 2026-08-28 (`/procedure/9999_1`: find answers `semantic_not_found`, while `/procedure/2021_106` returns 1 match)

### pitfall:reference_two_spellings
trigger: building a URL or calling the API with the display spelling of a reference
symptom: `/procedure/2021/0106(COD)` does not exist; `/notice/timeline?reference=2021/0106(COD)` answers 400
workaround: convert to the API form `2021_106` — year, underscore, number without leading zeros. The adapters accept both.
verified_at: 2026-08-28

### pitfall:timeline_400_not_404
trigger: `/notice/timeline` with an unknown or malformed reference
symptom: HTTP 400 with `ParseError at [row,col]:[1,1] Message: Content is not allowed in prolog` — a message about XML that says nothing about the reference
workaround: treat it as an argument error, not as an empty result
verified_at: 2026-08-28

### pitfall:eurovoc_code_is_compound
trigger: passing a EuroVoc code exactly as the vocabulary prints it, e.g. `52,DOM`
symptom: the `/search` response has no `searchResults` key at all
workaround: split it into `{"code":"52","type":"DOM"}`. The adapter accepts the `52,DOM` spelling and splits it itself.
verified_at: 2026-08-28

### pitfall:timeline_actor_fields_null
trigger: looking for the rapporteur, committee or responsible institution in timeline events
symptom: `committeeResponsible`, `rapporteur`, `responsibleBody`, `membersResponsible` are null on almost every event
workaround: do not rely on them; the adapter does not expose them, to avoid a permanently empty column
verified_at: 2026-08-28 (13 events of 2021/0106(COD): one `membersResponsible`, one `responsibleBody`)

### pitfall:site_name_alias
trigger: `opencli browser` resolving the site name in order to find this sitemap
symptom: with no adapter registered the name falls back to the SLD label, `europa`, which collides with every other europa.eu site
workaround: link the `law-tracker` name only. Verified at runtime: with the adapter registered, `opencli browser open` resolves `site: "law-tracker"`, not the fallback. An `europa` alias was tried and **rejected**: with it, `eur-lex.europa.eu` and `commission.europa.eu` were served this sitemap as navigation context. Better no sitemap than the wrong one.
verified_at: 2026-08-28
