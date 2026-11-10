# piao - OpenCLI adapter

Five commands over the [Portale PIAO](https://piao.dfp.gov.it/piao) of the Dipartimento della Funzione Pubblica: about 40,000 PIAO records (Piano Integrato di Attività e Organizzazione) of Italian public administrations, with links to the plan, the approving act and the attachments. No browser and no key: the commands read the same public JSON endpoints as the portal's page.

```bash
opencli plugin install github:aborruso/opencli/piao   # from the published repo
opencli plugin install "file://$PWD"                  # from a local clone
opencli adapter check piao     # expected: "ok": true, 5 commands
```

| Command | What it does | Browser |
|---|---|---|
| `enti <name>` or `enti --ipa <code>` | administrations known to the portal, to find an IPA code | no |
| `ente <ipa>` | every PIAO of one administration, by exact IPA code | no |
| `docs <ipa>` | every file of those PIAO, one row per file; `--download <folder>` saves them | no |
| `search <name>`, `--ipa`, `--anno` | PIAO by part of the name and/or of the IPA code | no |
| `recent` | the portal's default list | no |

## Read this before counting anything

- **One row is one version.** The same administration and triennium can have several versions: Palermo 2025-2027 has version 1 and 2. A count of rows is not a count of plans. `ente` and `docs` take `--latest`, which keeps the highest version of each triennium.
- **`recent` is not sorted by approval date.** The portal titles the list "Ultimi documenti approvati", but its first page reads 2026-10-23, 2026-03-30, 2026-10-21. It looks like most recently loaded first (a record added during testing appeared at the top); the portal does not say.
- **The name filter is a phrase.** `comune di palermo` matches, `palermo comune` does not. Spelling is the stored one: most names write `Citta'` with an apostrophe.
- **IPA codes are case-sensitive substrings on the server.** `C_G273` finds nothing, `g273` finds Palermo. `ente` and `docs` keep only the exact code; 349 codes contain uppercase letters.
- **Five IPA codes appear under two names** in `enti` (`apss`, `aou_ge`, `asl_na3s`, `ircs_ba`, `JZXL7734`).
- **`n_dipendenti` is the portal's raw `Sì`/`No`, without a label.** Do not read a meaning into it.
- **`--anno` is a local filter**, because the server has none: `2026` keeps every triennium covering that year, `2026-2028` only that one.
- **A command reads at most 200 portal pages of 6 records** and fails rather than returning a partial list. There is deliberately no command to download the whole archive.

The portal's page does not read parameters from its URL, so no link opens it on one administration. `pa_url` is the page on the administration's own site, when it gave one.

## Examples

```bash
opencli piao enti palermo -f csv
opencli piao ente c_g273 -f table
opencli piao ente c_g273 --anno 2025-2027 --latest
opencli piao search "comune di palermo" --anno 2026
opencli piao docs c_g273 --anno 2026-2028 --latest --download ./piao
```

`docs --download` writes `<folder>/<ipa code>/<triennium>_v<version>/<kind>-<n>_<file name>`, where kind is `piao`, `act` or `attachment`. Files already there are skipped, so a run that failed on some files can be repeated.
