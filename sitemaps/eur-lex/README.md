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

So the work is split:

- **`opencli eur-lex search`** drives the site's own search page in your Chrome through the Browser Bridge. It is the only command here that needs a browser, because EUR-Lex full-text search exists nowhere else.
- **`get`, `meta`, `transposition`, `sparql`** need no browser: they go to `publications.europa.eu` (Cellar REST and SPARQL), which is not challenged.

No attempt is made to get around the WAF.

## Setup

From a published copy — this site only:

```bash
npm install -g @jackwener/opencli
opencli plugin install github:aborruso/opencli/eur-lex
bash ~/.opencli/monorepos/opencli/bin/sync-sitemaps.sh eur-lex
opencli validate eur-lex
opencli doctor            # only needed for `search`, which drives a real browser
```

Both sites at once: drop the `/eur-lex` and run the sync script with no arguments.

From a local clone of this repo:

```bash
opencli plugin install "file://$(pwd)/../../plugins/eur-lex"
bash ../../bin/sync-sitemaps.sh eur-lex
```

## Metadata of an act

```bash
opencli eur-lex meta 32024R1689 -f json | jq -r '.[] | "\(.date)  \(.type)  \(.title[0:60])\n\(.eli)\n\(.eurovoc)"'
```

```
2024-06-13  REG  Regulation (EU) 2024/1689 of the European Parliament and of 
http://data.europa.eu/eli/reg/2024/1689/oj
single market; new technology; harmonisation of standards; market approval; innovation; artificial intelligence; smart technology
```

`eli` is the [European Legislation Identifier](https://eur-lex.europa.eu/eli-register/what_is_eli.html) of the act, the EU-wide standard URI for legislation: readable (`reg/2024/1689/oj`) and shared with national registers that adopt ELI. Adopted acts and consolidated versions have one; proposals (`52021PC0206`) do not, and the column is `null`.

`meta` and `get` take an ELI wherever they take a CELEX number, as a full URI or as its path:

```bash
opencli eur-lex meta reg/2016/679/oj -f json | jq -r '.[] | "\(.celex)  \(.eli)"'
```

```
32016R0679  http://data.europa.eu/eli/reg/2016/679/oj
```

`meta` also carries the legal dates: `in_force` (true/false), `entry_into_force`, `transposition` (the deadline for Member States, directives only) and `end_of_validity`, `null` when the act has no end date. Acts that apply in stages have several entry-into-force dates, joined with `; ` (the AI Act has five).

```bash
opencli eur-lex meta 32019L1024 -f json | jq -r '.[] | "in_force=\(.in_force) entry_into_force=\(.entry_into_force) transposition=\(.transposition) end_of_validity=\(.end_of_validity)"'
```

```
in_force=true entry_into_force=2019-07-16 transposition=2021-07-17 end_of_validity=null
```

## National transposition of a directive

The measures each Member State notified to transpose a directive, from Cellar. `--country` takes an ISO 3166 alpha-3 code.

```bash
opencli eur-lex transposition dir/2019/1024/oj --country ITA -f json | jq -r '.[] | [.date, .type, .title[0:70]] | @tsv'
```

```
2021-11-30	Decreto legislativo	Attuazione della direttiva (UE) 2019/1024 del Parlamento europeo e del
```

Without `--country` you get every measure, one row each: 333 for directive 2016/680, 842 for the services directive 2006/123. Count them by country:

```bash
opencli eur-lex transposition 32016L0680 -f json | jq -r 'group_by(.country) | map("\(.[0].country)\t\(length)") | .[]' | sort -k2 -nr | head -5
```

```
CZE	73
HRV	62
SVN	52
DEU	40
FIN	24
```

A measure often transposes several directives, so the count reflects how each country spreads a directive across its laws, not how well it transposed it. Some countries publish a `link` to the national text or a national `eli` (60 and 3 of the 333 for 2016/680); Italy, so far, neither. Regulations apply directly and return `EMPTY_RESULT`.

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

## Searching

```bash
opencli eur-lex search "facial recognition" --exact -f csv
```

```
celex,date,form,act,title,url
32024R1358,14/05/2024,Regulation,Regulation (EU) 2024/1358,"Regulation (EU) 2024/1358 …",https://…
32019R0816,17/04/2019,Regulation,Regulation (EU) 2019/816,"Regulation (EU) 2019/816 …",https://…
32019R2144,27/11/2019,Regulation,Regulation (EU) 2019/2144,"Regulation (EU) 2019/2144 …",https://…
32024R1689,13/06/2024,Regulation,Regulation (EU) 2024/1689,"Regulation (EU) 2024/1689 …",https://…
```

The result total is in the footer: `10 items · eur-lex/search · 356 results in total`. Ten results per page, `--page 2` for the next ten.

**Use `--exact` for a phrase.** Without it the words are OR-ed, and the count roughly triples: `facial recognition` → 904, `"facial recognition"` → 356. Wildcards work as the site documents them: `biometr*` for variations, `ca?e` for a single character.

This is the one command that needs the Browser Bridge connected. If it is not, `opencli doctor` says so and the command cannot run — there is no HTTP fallback, because a plain client gets the WAF challenge.

Then take the CELEX numbers and leave the browser behind:

```bash
opencli eur-lex search "facial recognition" --exact -f json | jq -r '.[].celex' | while read c; do
  opencli eur-lex meta "$c" -f json | jq -r '.[] | "\(.celex)  \(.date)  \(.title[0:60])"'
done
```

`workflows/find-legislation.md` spells the whole loop out, including what to do when the command fails.

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
