---
schema_version: 1
page_id: document
url_patterns:
  - https://eur-lex.europa.eu/legal-content/
purpose: one act — text, metadata, language versions, consolidated versions
last_verified: 2026-08-28
source: local
---

# Act page

URL: `/legal-content/<LANG>/TXT/?uri=CELEX:<celex>`, e.g. `/legal-content/EN/TXT/?uri=CELEX:32024R1689`.

**Usually you should not be here.** Everything this page shows about an act is available without the browser through `opencli eur-lex get` and `meta`, which read Cellar. Come here for the human view: cross-references, the document tree, related case law.

## Visual anchors

- text: the document title is informative and act-specific, e.g. `Regulation - EU - 2024/1689 - EN - EUR-Lex` — unlike most of the site, this one is a usable state signature
- the CELEX number appears in the URL, not necessarily in the page chrome

## Actions on this page

### action:read_act_text
pre: you know the CELEX
do: `opencli eur-lex get <celex>` (default `--as text`, plain text out of the XHTML)
post: one row with `chars` and `text`; 588 099 characters for the AI Act
fail: ARGUMENT on a 404 from Cellar — that representation or language does not exist
recover: try `--as xhtml`, or another `--lang` (ISO 639-3: eng, ita, fra…). See `pitfalls.md#cellar_accept_types_are_narrow`
evidence: opencli eur-lex get 32024R1689 --chars 400 → chars=588099, truncated=true, text starting "L_202401689EN.000101.fmx.xml … REGULATION (EU) 2024/1689"

### action:read_metadata
pre: you know the CELEX
do: `opencli eur-lex meta <celex>`
post: `celex, date, type, title, eurovoc, work, url`
fail: EMPTY_RESULT — no work with that CELEX in Cellar
recover: check the CELEX; a consolidated version (`02024R1358-20240522`) is a different work from the original act
evidence: opencli eur-lex meta 32024R1689 → date 2024-06-13, type REG, eurovoc "single market; new technology; …; artificial intelligence; smart technology"

### action:open_pdf
pre: you know the CELEX
do: `GET https://publications.europa.eu/resource/celex/<celex>` with `Accept: application/pdf` and `Accept-Language: eng`
post: the PDF of the act (2.5 MB for the AI Act)
fail: 400 without `Accept-Language`
recover: see `pitfalls.md#cellar_needs_accept_language`
evidence: curl with those two headers → 200, application/pdf, 2 583 319 bytes

## Linked APIs

Cellar REST and the SPARQL endpoint. Contracts in `~/.opencli/sites/eur-lex/endpoints.json`.
