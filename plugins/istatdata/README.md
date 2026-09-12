# istatdata — OpenCLI adapter

Two commands over [IstatData](https://esploradati.istat.it/databrowser/), the ISTAT Data Browser. No auth, no browser: both go through the local daemon.

`ask` is the AI search form of the Data Browser — the one at `#/it/dw/search?ai=true` — on the command line. Ask a question in plain Italian and you get the ISTAT datasets that answer it. It is a **dataset finder, not an oracle**: "what is the average income in Bagheria" returns the table that holds the figure, never the figure.

The endpoint answers with dataset ids and not much else, so every row is joined against the node catalog: that is where the title, the category path and the deep link to the table come from. With `--lang en` the endpoint sends an empty title, which makes the join load-bearing rather than decorative.

```bash
opencli plugin install github:aborruso/opencli/istatdata   # from the published repo
opencli plugin install "file://$PWD"                       # from a local clone
opencli validate istatdata          # expected: PASS, 2 commands
```

| Command | What it does | Browser |
|---|---|---|
| `ask <question>` | which datasets answer a question; `--session-id` for a follow-up | no |
| `dataset <id>` | title, category path and download URLs of one dataset, from the catalog | no |

## Examples

```bash
opencli istatdata ask "qual è il reddito medio del comune di Bagheria" --limit 3
opencli istatdata ask "incidenti stradali in Sicilia" -f json | jq -r '.[].data'
opencli istatdata dataset "IT1,41_287_DF_DCIS_INDINCIDENT_1,1.0"
```

A follow-up question, in the same context as the previous one:

```bash
SID=$(opencli istatdata ask "quanti sono gli occupati in Sicilia" -f json | jq -r '.[0].sessionId')
opencli istatdata ask "e per le donne?" --session-id "$SID"
```

The `data` column is an SDMX-CSV URL. Download it first, then read it — do not hand the URL straight to DuckDB, which asks for a byte range and gets `HTTP 416` back:

```bash
curl -s "$(opencli istatdata dataset 'IT1,41_287_DF_DCIS_INDINCIDENT_1,1.0' -f json | jq -r '.[0].data')" -o inc.csv
duckdb -c "select REF_AREA, TIME_PERIOD, OBS_VALUE from read_csv('inc.csv') limit 5"
```

That was 1 MB in 14 s for a small table. To filter by dimension, restrict the period or resolve the codes to labels, hand the job to an SDMX client instead. [`opensdmx`](https://pypi.org/project/opensdmx/) carries ISTAT as a built-in provider and takes the **middle segment** of the id this adapter returns — `IT1,24_84_DF_DCIS_MATRIND_4,1.0` becomes `24_84_DF_DCIS_MATRIND_4`:

```bash
opensdmx -o csv get 24_84_DF_DCIS_MATRIND_4 --provider istat --start-period 2020 --labels -y
```

231 rows in 22 s, with a `<DIM>_label` column beside every code. Note `-o csv` goes before `get`, not after: it is a global option.

## What to know before using it

- **The AI search is throttled.** The node declares 10 requests every 60 seconds. Ask serially. `dataset` costs nothing against that budget: it only reads the catalog.
- **Every call downloads the catalog**, 1.5 MB and about two seconds, and it is not cached. A question therefore takes ~5 s end to end. `ask` fetches it only after the search returned at least one dataset.
- **The `data` URL downloads the whole dataflow.** On a medium table that is ~10 s; on a large one it can exceed two minutes. Narrow it with an SDMX key or with `startPeriod`/`endPeriod`:
  `.../data/IT1,30_1008_DF_MEF_REDDITIIRPEF_COM_2,1.0/A.082006...?format=csv&startPeriod=2022` (082006 is Bagheria).
- **`sessionId` repeats on every row.** It belongs to the answer, not to a dataset, and `footerExtra` would have been the tidy place for it — but the runtime renders the footer only in `table` format, so in `json`, `csv`, `yaml` and in any pipe the value would be gone, and `--session-id` would be an option whose input you cannot obtain.
- **Both commands default to `-f plain`**, not to the usual table. Nine columns, one of them a 400-character description, make a table that is unreadable in any terminal; `plain` prints one `key: value` block per dataset and skips the empty fields. `-f table`, `-f csv`, `-f json`, `-f yaml` and `-f md` all still work exactly as elsewhere.
- **`--lang` takes `it` or `en` only**, and it is the node's `UserLang`, not `Accept-Language`.
- **Not surfaced:** the endpoint's `motivation` field, a single letter (`I`, `S`, `T`, `A`) for which no legend exists anywhere in the application, and `suggested_questions`, which comes back as unresolved i18n keys (`ISTAT1`, `ISTAT2`) rather than questions. Also unwrapped: `AI/GeneratePreview`, the data preview shown beside a result in the web app.

## The endpoint

Public, no authentication, no cookie. Verified live on 2026-09-12.

```
POST https://esploradati.istat.it/databrowserhub/api/core/nodes/1/AI/ExecuteSearch
UserLang: it
{"session_id": null, "request": "...", "aiSearchMaxResults": 20,
 "aiRateLimiting": {"limit": 10, "seconds": 60, "maxMessageLength": 204800},
 "action": {"type": "query"}}
```

Three things are easy to get wrong, and all three are handled in `shared.js`:

- **`aiRateLimiting` is mandatory.** Omit it and the request fails. Its values simply echo the node's own `AIRateLimiting` extra, so the adapter reads them from `GET nodes/{node}` (13 kB) instead of hardcoding them, and falls back to the known values only if that call fails.
- **`UserLang` is the language switch.** Without it descriptions come back in English and both `title` and `ai_title` come back empty.
- **The hub reports its errors in the body.** `{"errorCode": "INTERNAL_ERROR_SERVER", "message": ""}` — historically with HTTP 200, which is why the guard is written on the body and not on the status. On 2026-09-12 that same case answered HTTP 500, so both paths are covered: a missing `chatContext` on an otherwise clean response is an error too, not an empty result set.

The hub is an undocumented product-internal API: there is no spec to read, and everything above was verified by observation. The full reverse engineering, including how the table deep link is built, is written up in `andy-tools/tools/istatdata-ai/agent-harness/ISTATDATA_AI.md`, whose Python CLI covers the same endpoint.
