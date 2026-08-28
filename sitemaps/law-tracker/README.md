# EU Law Tracker — sitemap and adapter

Site: <https://law-tracker.europa.eu>

The European Commission's portal for following EU legislative procedures: proposals, events, stages, documents. An Angular SPA on top of an undocumented public JSON API — no login, no anti-bot.

- **Sitemap**: `SITE.md`, `pages/`, `workflows/`, `pitfalls.md` — navigation context for an agent driving `opencli browser`.
- **Adapter**: [`../../plugins/law-tracker/`](../../plugins/law-tracker/) — five `browser:false` commands that read the API directly.

## Setup

```bash
opencli plugin install "file://$(pwd)/../../plugins/law-tracker"
opencli validate law-tracker      # PASS, 5 commands
bash ../../bin/sync-sitemaps.sh   # link the sitemap into ~/.opencli/sites/
```

Output formats on every command: `-f table` (default), `json`, `csv`, `yaml`, `md`.

## What's new

```bash
opencli law-tracker proposals --limit 3 -f csv
```

```
reference,initiationDate,title,url
2026/0229(COD),2026-07-29,Proposal for a REGULATION … on the Farm Sustainability Data Network (codification),https://law-tracker.europa.eu/procedure/2026_229?lang=en
2026/0215(COD),2026-07-23,Proposal for a DIRECTIVE … on specific stability requirements for ro-ro passenger ships (codification),https://law-tracker.europa.eu/procedure/2026_215?lang=en
```

```bash
opencli law-tracker events --limit 5 -f json | jq -r '.[] | [.initiationDate,.reference,.event] | @tsv'
```

```
2026-09-16	2025/0590(COD)	Vote in EP plenary
2026-09-15	2025/0176(COD)	Debate in EP plenary
2026-09-15	2025/0380(COD)	Vote in EP plenary
```

Both feeds paginate with `--limit` and `--offset`.

## Browsing by topic

The 21 tiles behind "Browse by topic" on the homepage are the top-level EuroVoc domains. Their codes are what the search filter wants:

```bash
opencli law-tracker topics eurovoc -f json | jq -r '.[] | "\(.code)\t\(.label)"'
```

```
04,DOM	(04) POLITICS
08,DOM	(08) INTERNATIONAL RELATIONS
10,DOM	(10) EUROPEAN UNION
12,DOM	(12) LAW
16,DOM	(16) ECONOMICS
```

Other vocabularies: `policy-area`, `procedure-types`, `document-types`, `legal-basis-treaties`, `agent-names`, `activity-types`, `activities-agents`.

## Searching

```bash
opencli law-tracker search --eurovoc "52,DOM" --status ong --size 4 -f json \
  | jq -r '.[] | "\(.reference)  \(.status)  \(.currentStage)  \(.title[0:58])"'
```

```
2023/0134(COD)  ONG  FR  Proposal for a DIRECTIVE … CO2 emission class of heavy
2025/0391(COD)  ONG  FR  Simplification of administrative burden in environmenta
2023/0413(COD)  ONG  FR  EU forests – new EU Framework for Forest Monitoring and
2025/0097(COD)  ONG  FR  Vehicle safety – revising the EU's roadworthiness packa
```

More shapes of the same command:

```bash
opencli law-tracker search "artificial intelligence"            # free text
opencli law-tracker search --title "artificial intelligence"    # title only
opencli law-tracker search --procedure "2021/0106(COD)"         # one procedure
opencli law-tracker search --keyword climate --size 5           # structured keyword filter
opencli law-tracker search --status ong --stage FR --size 20    # ongoing, first reading
opencli law-tracker search --policyArea 01 --size 5
opencli law-tracker search --status ong --sort DATE --direction DESC --size 3
```

```
2026-07-29 2026/0229(COD)
2026-07-23 2026/0215(COD)
2026-07-17 2026/0203(COD)
```

Status codes: `ong` ongoing, `ado` adopted, `nad` not adopted, `wit` withdrawn. Stage codes: `PR` proposal, `FR` first reading, `SR` second reading, `CTR` conciliation and third reading, `EOP` end of procedure.

**Free text and `--status`/`--stage` cannot be combined.** The backend silently ignores those two filters when it receives free text, and returns rows that violate them. The command refuses the combination instead:

```bash
opencli law-tracker search "artificial intelligence" --status ong
```

```
ok: false
error:
  code: ARGUMENT
  message: free text makes the backend ignore status and stage: use --keyword instead of the query, or drop --status/--stage
```

To narrow a text search, use `--keyword`, which is a structured filter and stays in AND.

## One procedure's history

Both spellings of a reference work — display `2021/0106(COD)` and API `2021_106`:

```bash
opencli law-tracker timeline 2021/0106\(COD\) -f json \
  | jq -r '.[] | "\(.date)  \(.stage)  docs=\(.documents)  \(.event[0:52])"'
```

```
22/04/2021  PR  docs=4  Adoption of legislative proposal by the Commission
22/09/2021  FR  docs=1  European Economic and Social Committee opinion
06/12/2022  FR  docs=1  General approach by the Council
13/03/2024  FR  docs=1  EP position at first reading
21/05/2024  EOP  docs=7  Approval of the EP's first reading position by t
12/07/2024  EOP  docs=0  Publication in the Official Journal
```

## Pipelines

```bash
# how the 20 most recent ongoing procedures split across stages
opencli law-tracker search --status ong --size 20 -f json \
  | jq -r 'group_by(.currentStage)[] | "\(.[0].currentStage)\t\(length)"'
```

```
FR	18
PR	2
```

```bash
# citable links only
opencli law-tracker search --eurovoc "12,DOM" --status ong --size 5 -f json \
  | jq -r '.[] | "\(.reference)\t\(.url)"'

# the latest event on a procedure
opencli law-tracker timeline 2021_106 -f json | jq -r '.[-1] | "\(.date)  \(.stage)  \(.event)"'

# everything recent into a spreadsheet
opencli law-tracker proposals --limit 50 -f csv > proposals.csv
```

## When the browser is needed

The adapter covers reading. The browser is for what it does not return — the facet counts in the results sidebar, visual exploration, the XML export. Result pages are deep-linkable, so navigate straight to the URL instead of filling forms:

```bash
opencli browser lt open 'https://law-tracker.europa.eu/results?quickSearch=climate&sort=REL&page=0&pageSize=10&lang=en'
```

```json
{
  "url": "https://law-tracker.europa.eu/results?quickSearch=climate&…",
  "sitemap": { "site": "law-tracker", "available": true, "source": "local",
               "paths": { "local": "/home/…/.opencli/sites/law-tracker/sitemap" } }
}
```

`available: true` is the sitemap being picked up. From there, `workflows/` say which path to take.

## Traps

Eleven of them, all reproduced live, in [`pitfalls.md`](pitfalls.md). The ones that bite first: filters silently ignored next to free text, `totalResults` reading 0 while results are populated, a non-existent procedure returning HTTP 200 with an empty page, and a `<title>` that is identical on every page except the results one.

API contracts: `~/.opencli/sites/law-tracker/endpoints.json`. Field-level notes: `~/.opencli/sites/law-tracker/notes.md`.
