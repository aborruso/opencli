# EUR-Lex — sitemap and adapter

Site: <https://eur-lex.europa.eu>

The official repository of EU law: treaties, regulations, directives, decisions, case law, in every official language. Where the **text of the acts** lives, as opposed to [law-tracker](../law-tracker/README.md), which follows the process that produces them.

## The split that governs everything here

`eur-lex.europa.eu` is behind an **AWS WAF**. A non-browser client gets `HTTP 202` with a JavaScript challenge and an empty body:

```bash
curl -s -o /dev/null -w '%{http_code} %{size_download}\n' \
  'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32024R1689'
```

```
202 0
```

So the work is split, and the sitemap exists to say which half you are in:

- **full-text search → browser only**, through deep-linkable URLs
- **retrieving an act and its metadata → adapter, no browser**, against `publications.europa.eu` (Cellar REST and SPARQL), which is not challenged

No attempt is made to get around the WAF.

## Setup

From a published copy — this site only:

```bash
npm install -g @jackwener/opencli
opencli plugin install github:aborruso/opencli/eur-lex
bash ~/.opencli/monorepos/opencli/bin/sync-sitemaps.sh eur-lex
opencli validate eur-lex
```

Both sites at once: drop the `/eur-lex` and run the sync script with no arguments.

From a local clone of this repo:

```bash
opencli plugin install "file://$(pwd)/../../plugins/eur-lex"
bash ../../bin/sync-sitemaps.sh eur-lex
```

## Metadata of an act

```bash
opencli eur-lex meta 32024R1689 -f json | jq -r '.[] | "\(.date)  \(.type)  \(.title[0:60])\n\(.eurovoc)"'
```

```
2024-06-13  REG  Regulation (EU) 2024/1689 of the European Parliament and the C
single market; new technology; harmonisation of standards; market approval; innovation; artificial intelligence; smart technology
```

## Full text of an act

```bash
opencli eur-lex get 32024R1689 --chars 400 -f json | jq -r '.[] | "chars=\(.chars) truncated=\(.truncated)\n\(.text[0:260])"'
```

```
chars=588099 truncated=true
L_202401689EN.000101.fmx.xml

 Official Journal
of the European Union

 EN

 L series

 2024/1689

 12.7.2024

 REGULATION (EU) 2024/1689 OF THE EUROPEAN PARLIAMENT AND OF THE COUNCIL

 of 13 June 2024
```

`--as` picks the representation: `text` (default, plain text out of the XHTML), `xhtml`, `notice` (~5 KB of metadata), `branch` (~1.5 MB). `--lang` takes ISO 639-3 codes: `eng`, `ita`, `fra`.

Pull it once and work on it locally:

```bash
opencli eur-lex get 32024R1689 -f json | jq -r '.[0].text' > aiact.txt
for t in "facial recognition" "biometric identification" "biometric categorisation"; do
  printf '%-28s %s\n' "$t" "$(grep -o -i "$t" aiact.txt | wc -l)"
done
```

```
facial recognition           2
biometric identification     57
biometric categorisation     12
```

## Searching: the browser half

There is no search command, and that is deliberate — see above. The search itself is a deep link:

```bash
opencli browser ex open 'https://eur-lex.europa.eu/search.html?scope=EURLEX&text=%22facial+recognition%22&lang=en&type=quick'
opencli browser ex eval '[...document.querySelectorAll(".SearchResult h2 a.title")].slice(0,3).map(a=>a.textContent.trim().slice(0,60))'
```

```
Regulation (EU) 2024/1358 … on the establishment of 'Eurodac' for the comparison of biometric data
Regulation (EU) 2019/816 … establishing a centralised system for the identification of Member States
```

Ten results per page, `&page=2` for the next ten. Search syntax, as documented by the site: `"exact phrase"`, `term*` for variations, `ca?e` for a single character.

Harvest the CELEX numbers from the result hrefs, then leave the browser and use `meta`/`get`. `workflows/find-legislation.md` spells the whole loop out.

## Raw SPARQL

```bash
opencli eur-lex sparql 'PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>
  SELECT ?w WHERE { ?w cdm:resource_legal_id_celex "32019R0816"^^<http://www.w3.org/2001/XMLSchema#string> } LIMIT 2' -f csv
```

```
row,variable,value
0,w,http://publications.europa.eu/resource/cellar/d2837a44-7c5f-11e9-9f05-01aa75ed71a1
```

Output is long — one row per binding — because the variables are not known ahead of time.

## Traps

Seven, all reproduced live, in [`pitfalls.md`](pitfalls.md). The first one to internalise: HTTP 202 with an empty body is not an outage, it is the WAF. Then: Cellar's accept types are narrow and `Accept-Language` is mandatory; `qid`/`rid` in result links are session ids; the result total has no element of its own and must be read out of the page text.

API contracts: `~/.opencli/sites/eur-lex/endpoints.json`. Field notes: `~/.opencli/sites/eur-lex/notes.md`.
