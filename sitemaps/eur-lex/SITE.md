---
schema_version: 1
site: eur-lex.europa.eu
last_verified: 2026-08-28
source: local
login_required: false
auth_strategy: NONE
---

# EUR-Lex

## Overview

The official repository of EU law: treaties, regulations, directives, decisions, case law, consolidated versions, in all official languages. Where the **text of the acts** lives.

## The split that governs everything here

`eur-lex.europa.eu` sits behind an **AWS WAF**: to a non-browser HTTP client it answers `HTTP 202` with a JavaScript challenge and an empty body. So:

- **Searching full text → browser only.** No adapter can do it. `workflows/find-legislation.md` drives it through deep-linkable URLs.
- **Retrieving an act and its metadata → adapter, no browser.** The commands go to `publications.europa.eu` (Cellar REST and SPARQL), which are the Publications Office's official machine-readable interfaces and are not challenged.

Never try to get around the WAF. The browser is the sanctioned way through the front door; Cellar is the sanctioned back door for data.

## Top-level routes

- `/advanced-search-form.html?locale=en` → `pages/advanced-search-form.md`
- `/search.html?...` → `pages/results.md` (both quick and advanced searches land here, deep-linkable)
- `/legal-content/<LANG>/TXT/?uri=CELEX:<celex>` → `pages/document.md`
- `/homepage.html` → exists, adds nothing over a direct search: not covered
- `/collection/eu-law/*`, `/content/*` → editorial and browse pages, out of scope
- `/legal-content/<LANG>/TXT/PDF/?uri=CELEX:<celex>` → the PDF of an act; prefer Cellar, which serves the same thing without the WAF

## Common goals

- Find the acts that mention a subject → `workflows/find-legislation.md`
- Read an act, or feed it to something else → `workflows/read-act.md`

## Available commands

`opencli eur-lex get | meta | sparql` — plugin at `~/git/idee/opencli/plugins/eur-lex`, all `browser:false`, all against `publications.europa.eu`.

## Related sitemap

EUR-Lex holds the **text of the law**; `sitemaps/law-tracker/` follows the **legislative process** that produced it. They complement each other, and neither can do the other's job: law-tracker's search only matches procedure titles, EUR-Lex searches the full text. Going from a procedure to its act means matching on the title or the act number — the Law Tracker API exposes no CELEX number.

## Site-wide pitfalls

See `pitfalls.md`. The first one to internalise: HTTP 202 with an empty body is not an outage, it is the WAF.
