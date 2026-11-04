# opentender - OpenCLI adapter

Eight commands over [OpenTender](https://opentender.eu/), the European public procurement portal of the Government Transparency Institute: about 24.5 million tenders from 36 portals: 35 countries (the 27 EU member states, United Kingdom, Norway, Switzerland, Iceland, Georgia, North Macedonia, Serbia, Albania) and the EU institutions, taken from TED and from the national sources. No auth, no browser: every command goes through the local daemon.

The portal itself is behind a Cloudflare challenge and answers 403 to any script. The adapter talks to the data server the portal is built on, `api.opentender.eu`, which answers without a key. It is an undocumented API: routes from the backend code ([`yigit-serin/opentender-backend`](https://github.com/yigit-serin/opentender-backend), `server.js`, `lib/queries.js`) and the search fields from the frontend ([`arnese/opentender-frontend`](https://github.com/arnese/opentender-frontend), `src/app/model/filters.ts`), every contract checked live on 2026-11-04.

```bash
opencli plugin install github:aborruso/opencli/opentender   # from the published repo
opencli plugin install "file://$PWD"                         # from a local clone
opencli adapter check opentender     # expected: "ok": true, 8 commands
```

| Command | What it does | Browser |
|---|---|---|
| `stats` | the country portals with their number of tenders; the id is what `--country` takes | no |
| `sectors` | CPV divisions (2-digit market sectors) with their number of tenders | no |
| `tenders` | tender search by title, buyer, supplier (name or record id), CPV, year, bid amount | no |
| `tender <id>` | one tender, one row per bid of each lot | no |
| `companies <name>` | supplier records matching a name, one row per record | no |
| `company <id>` | one supplier record: address, identifiers, contracts, total value | no |
| `authorities <name>` | contracting authority records matching a name | no |
| `authority <id>` | one contracting authority record: address, identifiers, contacts | no |

Every command takes `--country` (a portal id such as `it`, `de`, `uk`, `eu`, or `all`, default `all`). On a search it restricts the results to that country; on `tender`, `company` and `authority` it only changes the portal link in `url`. Searches return 20 (`tenders`) or 50 rows by default, `--limit` up to 10000, the most the server returns for one search; the footer of a table says how many records match in all.

## Read this before counting anything

The data is the notices as published, and the notices are untidy. Four things change a count:

- **One organisation, many records.** A supplier gets one record per spelling of its name in the notices. `companies Palantir` returns 9 records: `Palantir Technologies UK, Ltd`, `Palantir Technologies UK, Ltd.`, `PALANTIR TECHNOLOGIES UK LTD`, the German GmbH, `PALANTIR TECHNOLOGIES INC.`, and a `Palantir Solutions` that may well be another company. The adapter never merges them: to count a company's tenders, collect the records that are really that company, say which ones, and use `tenders --supplier-id` on each. A name match alone is not proof that two records are the same company.
- **Local subsidiaries win, not the group.** In European procurement the winner is usually the national subsidiary (the UK Ltd, the GmbH), not the parent.
- **Amounts are partial and sometimes repeated.** Each tender has three amounts, kept apart: `final_eur` (final price), `estimated_eur` (estimate), and `winning_bids_eur`, the winning bid of every lot. They are not summed, because some sources repeat the whole tender value on every lot: TED notice 444671-2016 has two lots of 21.4 M EUR for a 21.4 M EUR tender. The server's own `total_value_eur` on a company record does sum them, and double counts: `Palantir Technologies UK, Ltd` shows 42.9 M EUR for that one 21.4 M EUR tender. Framework agreements list every supplier of the framework as a winner (one UK tender of a Palantir record has 30), and the amount is the framework's, not the supplier's share. There are outliers too: two Palermo tenders of 2025 for video cameras carry a winning bid of 2,684,420,249 EUR.
- **Identifiers are scarce.** Tax and VAT numbers appear on some records (`authority` shows them), often missing. Record ids (`EU_body_…`, `IT_body_…`) are OpenTender's, one per record, not per organisation.

### Italy

All 3,807,466 Italian tenders come from the open data of ANAC, the Italian anti-corruption authority (CIG dataset, `dataset: IT_data`, version `202607`): the `source` column links to the ANAC dashboard of the CIG. Italian tenders have **no final price and no CPV code**: `final_eur` is always empty, `--cpv` finds nothing, `sectors --country it` is empty, and `--sort final-price` returns the rows in the default order, having nothing to sort on. The money is in `winning_bids_eur` and `estimated_eur`, and `--sort bid-price` and `--min-bid` work.

## Examples

Country portals:

```bash
opencli opentender stats -f csv
```

```
id,name,tenders
al,Albania,444497
all,All Data,24525649
at,Austria,195422
be,Belgium,127131
```

Supplier records for a name, one per spelling:

```bash
opencli opentender companies Palantir
```

| name | country | contracts | total_value_eur | years |
|---|---|---|---|---|
| Palantir Technologies UK Ltd. | UK | 1 | 150000 | 2022 - 2022 |
| Palantir Technologies UK, Ltd | UK | 2 | 42897306.94 | 2016 - 2016 |
| PALANTIR TECHNOLOGIES INC. | | 1 | 49168.5 | 2013 - 2013 |
| Palantir Solutions | UK | 1 | 190472.62 | 2016 - 2016 |
| PALANTIR TECHNOLOGIES UK LTD | UK | 1 | 95014.01 | 2023 - 2023 |
| Palantir Technologies | UK | 1 | 16430125.63 | 2017 - 2017 |
| Palantir Technologies GmbH | DE | 1 | 14000000 | 2019 - 2019 |
| Palantir Technologies UK, Ltd. | UK | 1 | 9000000 | 2021 - 2021 |
| Palantir Technologies UK, Ltd | UK | 4 | 3900000 | 2020 - 2023 |

(`id`, `city` and `url` left out here.) The tenders of one record, by id rather than by name:

```bash
opencli opentender tenders --supplier-id EU_body_45bafcd580632a1e62134235bfedc241ff528e6e863887a0f661049f25c71a6a
```

returns 4 tenders, three in Lithuania and one UK framework agreement with 30 winners.

Tenders of a buyer, largest winning bid first:

```bash
opencli opentender tenders --buyer "Comune di Palermo" --country it --year-from 2025 --sort bid-price --limit 3
```

| year | title | winners | winning_bids_eur | estimated_eur |
|---|---|---|---|---|
| 2025 | POC LEGALITÀ - IMPIANTI DI VIDEOSORVEGLIANZA | GEMMO SPA | 2684420249 | 2684420249 |
| 2025 | SMART ENVIRONMENTS - APPROVIGIONAMENTO TELECAMERE PER COMPONENTE VDS | GEMMO SPA | 2684420249 | 2684420249 |
| 2025 | ADESIONE UTENZE ELETTRICHE 2026 | A2A ENERGIA S.P.A. | 27000000 | 27000000 |

(Other columns left out; `final_eur` is empty, as on every Italian tender.)

The bids and lots of one tender:

```bash
opencli opentender tender 73a431a7-0bcd-49c7-b7be-94c5146752da
```

| lot | lot_title | bidder | winning | bid_eur |
|---|---|---|---|---|
| 1 | PET-INTEL | Palantir Technologies UK, Ltd | true | 21448653.47 |
| 2 | POL-INTEL | Palantir Technologies UK, Ltd | true | 21448653.47 |

(Each row repeats the tender header: title, buyers Rigspolitiet, `final_eur` 21448653.47, TED sources.)

All the tenders of a supplier record, as JSON lines:

```bash
opencli opentender tenders --supplier-id <id> --limit 10000 -f json | jq -c '.data[]'
```

## Search filters

`tenders` needs at least one filter; they combine with AND.

| Option | Field on the server | Match |
|---|---|---|
| `--title` | `title` | phrase, the last word as a prefix |
| `--buyer` | `buyers.name` | phrase, the last word as a prefix |
| `--supplier` | `lots.bids.bidders.name` | phrase, the last word as a prefix; any bidder, winning or not |
| `--buyer-id`, `--supplier-id` | `buyers.id`, `lots.bids.bidders.id` | exact record id |
| `--cpv` | `cpvs.code.divisions` (2 digits), `cpvs.code` (8 digits) | exact; any other length is refused, the server would match nothing |
| `--year-from`, `--year-to` | `tenderYear` | inclusive |
| `--min-bid` | `lots.bids.price.netAmountEur` | at least one bid of that many EUR, winning or not |

`winning_bids_eur` is text, the winning bid of each lot joined with `; `, even when there is one lot; `final_eur` and `estimated_eur` are numbers.

`--sort` is `modified` (the server's default, last modified first), `year`, `final-price` or `bid-price`, always descending. A name search is a phrase from the start of a word: `--supplier Palantir` finds every name with the word Palantir, `--supplier "Palantir Tech"` only those followed by a word starting with Tech.

## Links

`url` points to the record's page on the portal, `https://opentender.eu/<portal>/tender|company|authority/<id>`, built from the frontend's routes. Not verified: the portal is behind Cloudflare and was not opened. `source` is the original notice (TED, or the ANAC dashboard for Italy).
