# eur-lex — OpenCLI adapter

Three commands over the Publications Office's public interfaces for EU law. No auth, no browser: all `browser:false`.

The commands deliberately do **not** call `eur-lex.europa.eu`, which is behind an AWS WAF and answers HTTP 202 to non-browser clients. They call `publications.europa.eu` — Cellar REST and the SPARQL endpoint — which is the official machine-readable interface.

```bash
opencli plugin install "file://$PWD"
opencli validate eur-lex          # expected: PASS, 3 commands
```

| Command | What it does |
|---|---|
| `get <celex>` | full text of an act (plain text, XHTML, or a metadata notice) |
| `meta <celex>` | title, date, act type, EuroVoc concepts |
| `sparql <query>` | any SPARQL query against Cellar, results in long format |

Full-text search is not here: it only exists behind the WAF, so it is a browser workflow. See [`../../sitemaps/eur-lex/README.md`](../../sitemaps/eur-lex/README.md).
