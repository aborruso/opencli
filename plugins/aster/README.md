# aster - OpenCLI adapter

Five commands over [ASTER](https://aster.istat.it/), the ISTAT Statistical Atlas of the Territory. No auth, no browser: every command goes through the local daemon.

ASTER is a set of atlases - territory, municipalities, museums and libraries, infrastructures, urban peripheries, the population census - each one a node of the same Data Browser product that runs [IstatData](../istatdata/README.md), with its own hub. The adapter walks it the way the site does: atlas, dataset, its dimensions, the codes of a dimension, the data. The data comes out as rows, one per observation, with the code and the label of every dimension.

ASTER has no public SDMX REST, and its ids and territorial codelist are its own (`26_29`: `TERRITORIO` on `CL_AST_ITTER` here, `REF_AREA` on `CL_ITTER107` on the ISTAT SDMX endpoint). Much of its data is on that endpoint too, and where compared the numbers are the same: see [ASTER or SDMX?](#aster-or-sdmx) before choosing.

```bash
opencli plugin install github:aborruso/opencli/aster   # from the published repo
opencli plugin install "file://$PWD"                   # from a local clone
opencli adapter check aster          # expected: "ok": true, 5 commands
```

| Command | What it does | Browser |
|---|---|---|
| `atlases` | the atlases, with the code to pass as `--atlas` | no |
| `datasets` | the datasets of one atlas: id, title, theme path, link to the table; `--grep`; `--tree` for the themes | no |
| `dataset <id>` | the dimensions of a dataset: label, codelist, role, default filter of the web table | no |
| `values <id> <DIM>` | the codes of one dimension that have data, with label and parent | no |
| `data <id>` | the data, one row per observation; `--filter`, `--last`, `--from`/`--to` | no |

Every command takes `--lang it|en` (default `it`); all but `atlases` take `--atlas` (code or id, default `AST`).

<a id="aster-or-sdmx"></a>
## ASTER or SDMX?

The same ISTAT data is often on both ASTER and the ISTAT SDMX endpoint (`esploradati.istat.it/SDMXWS`, reachable with [opensdmx](https://pypi.org/project/opensdmx/)). Checked on 2026-10-20, full analysis in [`docs/evaluation.md`](../../docs/evaluation.md#aster-vs-sdmx):

| ASTER datasets vs SDMX dataflows | Datasets |
|---|---|
| Same id | 113 |
| Same name with a suffix, or with the domain numbers moved: one ASTER dataset groups a family of SDMX tables | 38 |
| Same theme, other names (urban environment, daily life survey, BES of the territories, museums, schools, labour force, projections) | ~140, not matched one to one |
| No counterpart found | ~30 |

- **Same numbers**: 170 values compared on three datasets (`26_29`, the composite fragility index, population in the municipal identity card), all identical.
- **ASTER can be behind**: population on 1 January stops at 2024 here and reaches 2026 on SDMX (`22_289`); household projections are the 2023-2043 edition here and 2025-2050 on SDMX (`165_1167`).
- **Found only on ASTER**: the sub-municipal areas of the metropolitan capitals (708 neighbourhoods, atlas `PERIFERIE`); the infrastructure indicators (atlas `ASTI`); the yearly area of every municipality (`DF_CARTA_IDENTITA`); one territorial hierarchy from Italy down to the neighbourhood, with `parent` on every code (`CL_AST_ITTER` does not exist on the SDMX endpoint).
- **Ready-made tables**: where SDMX splits a topic into many dataflows, ASTER serves one dataset. ICT in enterprises (`DF_DCSP_ICT_6_39`) is one dataset with 448 indicators here, 20 dataflows on SDMX (`6_39_DF_DCSP_ICT_1…`): there, the whole picture takes 20 queries and a union. Every dataset also comes with the default view of the web table.

In practice: for a figure that is on SDMX, prefer opensdmx, which has the newer editions and the full catalog (4953 dataflows against 313). Use `aster` for what is only here, for ready-made tables when you do not want to merge, and as an entry point to find the theme; then check the year coverage on SDMX before relying on an ASTER series that exists there too.

Limits: values compared on 3 datasets of 313, about 140 matched by theme only, SDMX titles in English and ASTER titles in Italian, so some of the ~30 "only on ASTER" may be on SDMX under names not tried.

## Examples

Not sure what is in there? Start from the themes. `--tree` lists the theme tree of an atlas, one row per theme, with how many datasets it holds:

```bash
opencli aster datasets --tree -f table
opencli aster datasets --tree --atlas PERIFERIE -f table
```

On 2026-10-20 AST had 117 themes, 16 at the top level (`Popolazione e famiglie` 37 datasets, `Offerta di lavoro` 26, ...). A dataset is counted once, under its theme and every theme above it, so the top-level counts add up to the 279 datasets of the atlas, and the count of a theme is the number of rows of `datasets` whose `category` starts with its path. `--tree` combines with `--grep`: the themes of the datasets that match.

| level | theme | datasets | category |
|---|---|---|---|
| 1 | Agricoltura | 20 | Agricoltura |
| 2 | Agriturismo | 2 | Agricoltura > Agriturismo |
| 2 | Censimento dell'Agricoltura 2020 | 9 | Agricoltura > Censimento dell'Agricoltura 2020 |

Then the datasets of one theme, with `--grep` on its name.

From a topic to a figure, in four steps:

```bash
opencli aster datasets --grep decessi
opencli aster dataset "IT1,26_29,1.0"
opencli aster values "IT1,26_29,1.0" DATA_TYPE
opencli aster data "IT1,26_29,1.0" --filter "SEX=9 DATA_TYPE=LIFEEXP0 TERRITORIO=19+20" --last 2 -f csv
```

`datasets --grep decessi` (2026-10-20):

| id | title | category | atlas | table |
|---|---|---|---|---|
| IT1,26_29,1.0 | Decessi | Popolazione e famiglie > Mortalità | AST | https://aster.istat.it/#/it/ast/IT1,26_29,1.0 |

`dataset "IT1,26_29,1.0"`, some of its nine rows:

| dimension | label | codelist | role | default_count | default |
|---|---|---|---|---|---|
| DATA_TYPE | Indicatore | IT1+CL_TIPO_DATO15+1.0 | | 3 | DEATHRATE+LIFEEXP0+MEANAGEDH |
| TERRITORIO | Territorio | IT1+CL_AST_ITTER+1.0 | territory | 22 | |
| SEX | Sesso | IT1+CL_SEXISTAT1+1.0 | | 3 | 1+2+9 |
| TIME_PERIOD | Tempo | MA+CL_TIME_PERIOD+1.0 | time | | last 1 |

`default` is spelled out up to 20 codes; above that only `default_count` is filled (the 22 regions here, ~5,500 municipalities on a municipal dataset).

`data` with the filter above, the code columns of the constant dimensions cut for width:

| data_type | data_type_label | territorio | territorio_label | sex | sex_label | time_period | value |
|---|---|---|---|---|---|---|---|
| LIFEEXP0 | speranza di vita alla nascita | 19 | Sicilia | 9 | totale | 2023 | 81.6 |
| LIFEEXP0 | speranza di vita alla nascita | 19 | Sicilia | 9 | totale | 2024 | 82.4 |
| LIFEEXP0 | speranza di vita alla nascita | 20 | Sardegna | 9 | totale | 2023 | 82.5 |
| LIFEEXP0 | speranza di vita alla nascita | 20 | Sardegna | 9 | totale | 2024 | 83 |

On 2026-10-20 the 18 values of Sicilia and Piemonte that `data` returns with the default filter were checked against the table of the site: they match.

## What to know before using it

- **`--grep` matches words, not a phrase.** Every word of the query must be in the id, title or theme path, in any order; accents and case are ignored, and so is the final vowel, so singular and plural meet: `decesso` finds `Decessi`, `reddito comuni` finds "Reddito delle persone fisiche (Irpef) - comuni". A word matches the start of a word (`comun` also matches `comunitari`). Datasets with the words in the title come first. Indicators inside a dataset are not searched: life expectancy is in `Decessi`, and `--grep "speranza vita"` finds nothing. Browse with `--tree` for those.
- **`data` starts from the web table's own filter**, the one `dataset` shows in `default`. `--filter` changes only the dimensions it names: `DIM=a+b` for those codes, `DIM=*` for every value. A dimension with no default takes every value. Codes come from `values`.
- **Time:** `--last N` for the last N periods, `--from`/`--to` with `YYYY` or `YYYY-MM-DD`; the time dimension is not accepted in `--filter`. The hub takes full dates only, so a bare year is turned into the first or last day of that year.
- **A request that is too large fails rather than coming back short.** The hub cuts the answer at 500,000 values and says so with HTTP 206; the adapter reports that as an error and asks for a narrower filter, instead of printing a partial table as if it were whole.
- **No observation is `EMPTY_RESULT`, not a zero.** The hub answers HTTP 204 with an empty body when the filter matches nothing, for example a municipality that is not in the dataset (Palermo `082053` on `IT1,101_1039,1.0`).
- **`data` has no fixed columns.** They are the dimensions of the dataset, lower-cased, each with a `_label` column, then `value`. Every row has the same keys.
- **`values` lists only codes with data** (`partial`). Territories come with their `parent`; the aggregates above the level of the data (Italy, macro-areas, regions on a municipal dataset) are `selectable: false`. The time dimension comes as two rows, start and end of the period covered.
- **An unknown dataset id answers HTTP 500**, the same as a real failure: the error says both, and points to `datasets`.
- **The table link** is the short form `#/{lang}/{atlas}/{id}`. The IstatData form with the category path (`#/it/ast/categories/<group>/.../<id>`) gives "La pagina richiesta non è disponibile" here.
- **The `it` and `en` catalogs differ slightly**: on 2026-10-20 AST listed 279 datasets in Italian and 280 in English, the extra one a test dataset (`IT1,PROVA_IMPORT_POP,1.0`).
- **Not wrapped:** the boundaries the atlas draws its maps with (`api/geoglossary/geometry`), news, indicators.

## The hub

Public, no authentication, no cookie. Base `https://aster.istat.it/api/core/` (from `config/config.json`). Verified live on 2026-10-20.

```
GET  nodes                                         the atlases
GET  nodes/{n}/catalog                             titles and theme tree
GET  nodes/{n}/datasets/{agency,id,version}/structure
GET  nodes/{n}/datasets/{id}/column/{DIM}/partial/values
POST nodes/{n}/datasets/{id}/data                  JSON-stat
UserLang: it
```

The data body is a JSON array with one filter per dimension:

```json
[{"id":"SEX","filterValues":["9"],"type":"CodeValues","period":0},
 {"id":"TIME_PERIOD","filterValues":[],"type":"TimePeriod","period":2},
 {"id":"TIME_PERIOD","type":"TimeRange","from":"2020-01-01","to":"2024-12-31"}]
```

(one of the two time filters, not both). Things that are easy to get wrong, all handled in `shared.js` and `data.js`:

- **`UserLang` is the language switch**, not `Accept-Language`. Without it the hub answers in English.
- **An empty `filterValues` selects nothing**, it does not mean "all". A dimension meant to take every value is left out of the array.
- **The IstatData hub reports some errors in the body** with HTTP 200 (`{"errorCode": ..., "message": ...}`). The same product runs here, so the guard is on the body as well as on the status, although no such body was seen on aster during the tests.
- **The hub declares no rate limit.** The commands call it serially.
