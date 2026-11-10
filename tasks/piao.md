# Plan: `piao` adapter

Portale PIAO (piao.dfp.gov.it, Dipartimento della Funzione Pubblica): 40,171 PIAO records. Read-only adapter over the two public JSON endpoints behind the portal's React view. No browser, no key. No `dump` command (user decision, 2026-11-10).

## API facts (live, 2026-11-10)

- `GET /api/piao?page=N[&administrationName=][&ipaCode=]`: 6 rows per page, page size not settable (`limit`, `perPage`, `size` ignored). Empty result has `count: 0` and no `total`.
- `GET /api/administrations?[administrationName=|ipaCode=]&limit=N`: 9,881 administrations; 5 IPA codes appear under two names.
- Name filter: case-insensitive substring, phrase in the given word order. `ipaCode` filter: case-sensitive substring (349 codes carry uppercase letters).
- No server-side triennium filter (`year`, `years` ignored).
- Default order is not by approval date (page 0: 2026-10-23, 2026-03-30, 2026-10-21, ...).
- `nDipendenti` is unlabelled in the frontend bundle: passed through raw.

## Phases

- [x] `plugins/piao/`: `shared.js`, `search`, `enti`, `ente`, `docs`, `recent` → verify: `opencli adapter check` clean on all commands. Done 2026-11-10, 5 commands, 0 errors.
- [x] Unit tests with mocked fetch (paging, empty result, exact IPA, triennium, latest, scan cap, download failure, file name safety) → verify: `npm test` passes. Done 2026-11-10, 16 of 16.
- [x] Install from the working copy and run live → verify: Palermo counts match the raw API; one real PDF download; human and JSON help expose syntax and limits. Done 2026-11-10: `ente c_g273` 6 rows = API total 6; 3 PDFs downloaded, rerun skips them.
- [x] Docs: plugin README, root `README.md`, `AGENTS.md`, `opencli-plugin.json`, `LOG.md` → verify: `opencli plugin list` shows `piao`. Done 2026-11-10.

## Review

Five commands as agreed, no dump. `--latest` is on `ente` and `docs` only, where every version of an administration is read.

## Unresolved questions

- `nDipendenti` meaning: not labelled by the portal.
- Data licence: not stated on the pages read.
