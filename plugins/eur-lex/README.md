# eur-lex — OpenCLI adapter

Four commands over EU law. No auth. Three of them need no browser at all.

`get`, `meta` and `sparql` deliberately do **not** call `eur-lex.europa.eu`, which is behind an AWS WAF and answers HTTP 202 to non-browser clients. They call `publications.europa.eu` — Cellar REST and the SPARQL endpoint — the official machine-readable interface.

`search` is the exception: EUR-Lex full-text search exists nowhere else, so the command drives the site's own search page in your Chrome through the Browser Bridge. It fails loudly if the page it lands on is not the results page, rather than quietly returning nothing.

```bash
opencli plugin install github:aborruso/opencli/eur-lex   # from the published repo
opencli plugin install "file://$PWD"                     # from a local clone
opencli validate eur-lex          # expected: PASS, 3 commands
```

| Command | What it does | Browser |
|---|---|---|
| `search <text>` | full-text search across EU law; `--exact` for a phrase, `--page` for more | yes |
| `get <celex\|eli>` | full text of an act (plain text, XHTML, or a metadata notice) | no |
| `meta <celex\|eli>` | title, date, act type, ELI, EuroVoc concepts | no |
| `sparql <query>` | any SPARQL query against Cellar, results in long format | no |

`get` and `meta` accept a CELEX number (`32024R1689`) or an [ELI](https://eur-lex.europa.eu/eli-register/what_is_eli.html), full (`http://data.europa.eu/eli/reg/2024/1689/oj`) or short (`reg/2024/1689/oj`).

Examples with real output: [`../../sitemaps/eur-lex/README.md`](../../sitemaps/eur-lex/README.md).
