---
schema_version: 1
workflow_id: transposition
intent: find the national laws that transpose an EU directive, in one Member State or all of them
last_verified: 2026-10-08
source: local
---

# Find the national transposition of a directive

## Goal

From a directive (CELEX or ELI) to the national measures that transpose it, with type, date and title in the national language. Without a browser.

## State signature

The directive's CELEX number. The ELI works too and is resolved to CELEX first.

## Best path

```bash
opencli eur-lex meta 32016L0680                              # transposition = the deadline
opencli eur-lex transposition 32016L0680 --country ITA       # the Italian measure
opencli eur-lex transposition dir/2016/680/oj -f csv > nim.csv   # every Member State
```

Each national measure is a Cellar work pointing at the directive with `cdm:measure_national_implementing_implements_resource_legal`, the country in `cdm:measure_national_implementing_implemented_by_country`.

## Avoid

- Counting rows without the per-directive CELEX filter: a measure carries one CELEX per directive it transposes (a Czech act has more than 15), and a plain join returns 3764 rows instead of 333 for 2016/680. The command keeps only the CELEX that starts with `7` + the directive's number.
- Asking for a regulation: regulations apply directly, the answer is `EMPTY_RESULT`.
- Passing a consolidated CELEX (`0…`): measures point at the original directive.

## State validation

For 2016/680, `--country ITA` returns one row: `72016L0680ITA_259163`, Decreto legislativo, 2018-05-24, the D.Lgs. 51/2018. The whole list is 333 rows across 28 countries.

## Stale markers

If the `measure_national_implementing_*` predicates are renamed, or the sector-7 CELEX pattern changes, the command and this file go stale together.
