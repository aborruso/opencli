# eu-funding — OpenCLI adapter

Nine commands over the [public APIs](https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/support/apis) of the [EU Funding & Tenders Portal](https://ec.europa.eu/info/funding-tenders/opportunities/portal/): calls for proposals and tenders, topic details, grant updates, FAQs, organisations, partner searches, funded projects, and the reference codes behind all of them. No key, no login, no browser.

The APIs are the Commission's corporate search, and they speak in codes: a call is `status 31094502`, a programme is `43108390`, a country is `20000883`. The doc page tells you to build a filter in the portal and copy the query out of the browser's developer tools. These commands take names instead (`--status open`, `--programme "horizon europe"`) and label the codes in their output. When a filter is missing, `--query` accepts the raw JSON and `codes` tells you what to put in it.

```bash
opencli plugin install github:aborruso/opencli/eu-funding   # from the published repo
opencli plugin install "file://$PWD"                        # from a local clone
opencli validate eu-funding          # expected: PASS, 9 commands
```

| Command | What it does | API service |
|---|---|---|
| `calls [text]` | calls for proposals and tenders; `--type`, `--status`, `--programme`, `--call`, `--period`, `--deadline-after`, `--sort` | Grants & Tenders |
| `topic <identifier>` | one topic or tender in full: dates, description, conditions | Topic Details |
| `updates [text]` | news posted on calls (extensions, clarifications, results), newest first | Grant Updates |
| `faqs [text]` | FAQs with their short answer, general ones and the Q&A of single tenders and topics; `--type`, `--status`, `--programme` | FAQ Index |
| `faq <nid>` | one FAQ with its full answer | FAQ Details |
| `org <pic>` | public data of an organisation, by its 9-digit PIC | Organisation Public Data |
| `partners [topic]` | partner searches published for a topic | Partner Search |
| `projects [text]` | funded projects: budget, EU contribution, coordinator, countries | Projects & Results |
| `codes [field]` | the codes of an index and their labels | Facet API |

Every command defaults to `-f json`. `-f table`, `-f csv`, `-f yaml`, `-f md` and `-f plain` work as elsewhere. The result total of a search goes in the table footer, so it appears in `-f table` only.

## Examples

```bash
opencli eu-funding calls "artificial intelligence" --type grant --programme "horizon europe" --limit 5
opencli eu-funding calls --type tender --status open --deadline-after 2026-10-01 --sort deadline -f csv > tenders.csv
opencli eu-funding topic HORIZON-CL5-2026-10-D6-03 | jq -r '.[0].conditions'
opencli eu-funding updates --programme "horizon europe" --limit 10
opencli eu-funding faqs "lump sum" --programme "horizon europe"
opencli eu-funding faq 55257 | jq -r '.[0].answer'
opencli eu-funding faqs --type tender-qa --limit 3              # questions asked on single tenders
opencli eu-funding org 999991722
opencli eu-funding partners HORIZON-CL4-2022-RESILIENCE-01-08 --limit 10
opencli eu-funding projects "digital twin" --programme "horizon europe" --status ongoing
```

From a topic to who is looking for partners on it, to the organisations behind them:

```bash
opencli eu-funding partners HORIZON-CL4-2022-RESILIENCE-01-08 --limit 50 | jq -r '.[].pic | select(. != "")' | sort -u | head -3 |
  while read pic; do opencli eu-funding org "$pic" | jq -c '.[0] | {name, country, projects}'; done
```

Any filter the flags do not cover, through the raw query. `codes` lists the fields of an index, then the codes of one field:

```bash
opencli eu-funding codes --index calls                          # every field and how many codes it has
opencli eu-funding codes crossCuttingPriorities --filter digital
opencli eu-funding calls --type grant --query '{"bool":{"must":[{"terms":{"crossCuttingPriorities":["DigitalAgenda"]}}]}}'
```

The clauses in `--query` are ANDed with the ones the flags build.

## What to know before using it

- **`open` is `31094502`, not `31094501`.** The facet API labels `31094501` "Forthcoming". The doc page's sample titled "To get only open tenders" asks for both, and so returns forthcoming ones too. Here `--status` takes names.
- **The status is not always current.** Some calls marked open have their only deadline in 2014. The adapter does not hide them, because that is what the index says. `--deadline-after YYYY-MM-DD` keeps the calls with at least one deadline on or after the date. A call with several cut-offs passes if any one of them does.
- **A bare date in a range filter does not compare anything.** `{"range":{"deadlineDate":{"gte":"2026-09-21"}}}` returns the same count as `"gte":"2099-01-01"`: the records that have a deadline at all, whatever its value (open tenders: 1001 → 755 with either date). Only the index's own format compares: `"2026-09-21T00:00:00.000+0000"` gives 178, and 2099 gives 0. `--deadline-after` writes it that way. Keep it in mind when writing a range into `--query`: the count does drop, so it looks as if it worked.
- **`languages` is always sent** (`["en"]`). Without it every record comes back once per translation: one topic becomes a dozen rows.
- **One identifier is several records.** The exact-phrase search the doc prescribes for topic details also returns the grant updates about that topic and a copy from another datasource (`SEDIA_PRD_CENTRICITY`). `topic` keeps the call record and fails if it cannot find exactly one.
- **The API serves at most 100 results a page**, whatever `pageSize` asks. `--limit` pages through as needed. There is no "all" option: projects alone are 88,322.
- **`type` means something different in each index.** In calls, `0` is a tender and `1` a grant. In FAQs, `0` is tenders and `1` grants. In partner searches the types are words. Projects have no type at all. Each command carries its own vocabulary.
- **The calls index is shared.** Unfiltered, the `SEDIA` index also holds organisations, announcements and project statuses such as `Ended`. `codes --index calls` is scoped to calls, tenders and grant updates.
- **`partners` returns the announcements, not the publishers.** The doc's sample asks for records of type `ORGANISATION` and `PERSON`: that gives the organisations and people who published a partner search, each carrying its whole project history. On 2026-09-21, 40 records for one topic weighed 51 MB. The announcements themselves are records of type `ANNOUNCEMENT`, about 2 kB each, with the text of the offer. They are the default here, and `--type organisation,person` still returns the publishers: 40 of them took 37 s, and far beyond that the request can hit the 90 s timeout. For publishers, `date`, `topic` and `topic_title` are empty, and `summary` holds their keywords. Announcements published by individuals carry their name, as on the portal.
- **Grant-topic URLs in the index are dead.** A grant topic's own `url` points to a JSON file under `/data/topicDetails/` that answers 404. `topic` and `updates` return the portal page (`topic-details/<id>`) instead.
- **The doc's "full FAQ list" is 3% of the FAQs.** It asks for `type` 0 and 1, the general FAQs on tenders and on grants: 1,697 records. The index holds about 61,000. The rest are `type` 2, the questions asked on a single tender (46,672, each with the tender's id in `procedure`, which `topic` opens), and `type` 3, the questions asked on a single call topic (12,718). The facet API gives these two types no label. `faqs` searches all four by default. `--type tenders,grants` gives the doc's list.
- **The doc page's FAQ example does not exist.** `nid 755` returns nothing, while the numbers from `faqs` do.
- **Speed.** A search takes 2 to 10 s. The code labels come from a filtered facet call made in parallel, about 1.5 s. Naming a programme (`--programme "horizon europe"`) costs one more facet call before the search, to find its code. Passing the code (`--programme 43108390`) skips it.
- **Out of scope:** the "previous version" APIs, which the doc page still links.

## The API

Public, no authentication. The `apiKey` names an index and is not a secret. Verified live on 2026-09-21.

```
POST https://api.tech.ec.europa.eu/search-api/prod/rest/search?apiKey=<KEY>&text=<TEXT>&pageSize=<N>&pageNumber=<P>
POST https://api.tech.ec.europa.eu/search-api/prod/rest/facet?apiKey=<KEY>&text=<TEXT>
GET  https://api.tech.ec.europa.eu/search-api/prod/rest/document/<PIC>?apiKey=SEDIA_PERSON
```

The body is `multipart/form-data` with up to three parts, each typed `application/json`: `query` (an Elasticsearch-style `bool` query), `languages` (`["en"]`) and `sort` (`{"field":"deadlineDate","order":"ASC"}`). `text=***` matches everything. A phrase in double quotes is an exact match.

| Index (`apiKey`) | Holds | Commands |
|---|---|---|
| `SEDIA` | calls, tenders, topics, grant updates | `calls`, `topic`, `updates` |
| `SEDIA_FAQ` | FAQs | `faqs`, `faq` |
| `SEDIA_PERSON` | organisations, people, partner-search announcements | `org`, `partners` |
| `SEDIA_NONH2020_PROD` | funded projects | `projects` |

`SEDIA_NONH2020_PROD` is not written on the doc page, which shows it only in a screenshot. It is what the portal's own projects page calls.

An unknown PIC answers HTTP 400 with `{"type":"businessError","message":"No result found"}`. `org` reports it as an empty result, not as a failure.
