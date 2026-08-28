---
schema_version: 1
workflow_id: read-act
intent: read an act, or hand its text to something else, given its CELEX number
last_verified: 2026-08-28
source: local
---

# Read an act

## Goal

Given a CELEX number, get the metadata, the full text, or the official PDF — without a browser.

## State signature

The CELEX number is the whole state. `32024R1689` is the original act; `02024R1358-20240522` is a consolidated version, and Cellar treats it as a different work.

## Best path

```bash
opencli eur-lex meta 32024R1689                 # title, date, type, EuroVoc
opencli eur-lex get 32024R1689 --chars 4000     # first 4000 characters
opencli eur-lex get 32024R1689 -f json | jq -r '.[0].text' > act.txt
opencli eur-lex get 32024R1689 --as xhtml       # raw XHTML, markup kept
opencli eur-lex get 32024R1689 --lang ita       # the Italian expression
```

`--as` accepts `text`, `xhtml`, `notice` (a ~5 KB metadata notice) and `branch` (~1.5 MB). Language codes are ISO 639-3: `eng`, `ita`, `fra`.

For anything the three commands do not cover, query the graph directly:

```bash
opencli eur-lex sparql 'PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>
  SELECT ?w WHERE { ?w cdm:resource_legal_id_celex "32019R0816"^^<http://www.w3.org/2001/XMLSchema#string> } LIMIT 2'
```

Results come back long — one row per binding — because the variables are not known in advance.

## Fallback path

```yaml
on_adapter_fail:
  - adapter_health_update: opencli eur-lex get -> suspect
  - the failure is almost always a 404 from Cellar on that representation or language:
      try --as xhtml, then another --lang
  - only if Cellar itself is down: goto /legal-content/EN/TXT/?uri=CELEX:<celex> in the browser
    (action:read_act_text in pages/document.md), accepting that you are back behind the WAF
```

## Avoid

- Asking Cellar for `text/html`, `text/plain` or bare `application/xml`: all 404. See `pitfalls.md#cellar_accept_types_are_narrow`.
- Omitting `Accept-Language` when calling Cellar by hand: 400.
- Printing a whole act into a terminal or a context window without `--chars`: the AI Act is 588 099 characters.

## State validation

`meta` returns a `title` matching the act you expected and a `work` URI under `publications.europa.eu/resource/cellar/`. `get` returns a `chars` count in the hundreds of thousands for a full regulation; a few hundred means you got an error page rather than an act.

## Stale markers

If Cellar's accepted content types change, or `cdm:` predicate names shift, `~/.opencli/sites/eur-lex/endpoints.json` and this file go stale together.
