# palermo-delibere — OpenCLI adapter

Seven commands over [Delibere e Ordinanze](https://servizionline.comune.palermo.it/portcitt/jsp/home.jsp?modo=info&info=servizi.jsp&SERCOD=60&SERCODROOT=60), the section of the Comune di Palermo's online services portal that keeps the city's deliberations, determinations and ordinances. No key, no auth, no browser.

It is the same SISPI application as the [Albo Pretorio](../albo-palermo/), and it holds the same records: an act has the same internal id and the same `ALBCOD` in both. The difference is time. The Albo shows an act while it is in publication, then drops it. This portal keeps it, going back to 2018 for the executive determinations. So a permanent link from here keeps working, and `from-albo` turns an Albo link into one.

```bash
opencli plugin install github:aborruso/opencli/palermo-delibere   # from the published repo
opencli plugin install "file://$PWD"                              # from a local clone
opencli validate palermo-delibere      # expected: PASS, 7 commands
```

| Command | What it does | Browser |
|---|---|---|
| `sections` | the eight sections, their codes and how each is reached | no |
| `list <section>` | the newest acts of one section; `--pages 1\|2` | no |
| `search <section>` | the portal's filter: `--text` in the subject, `--year`, `--number`, `--date`, `--sector`, as far as the section's form offers them | no |
| `get <permalink>` | one act, from its permanent link or from `ALBCOD` plus `--section` | no |
| `attachments <permalink>` | downloads the attachments of one act into `./<section>-<year>-<number>/`, or `--dir`, with `act.json` and `act.html`; files already there are skipped | no |
| `dump [sections]` | the acts each section gives for one day (`--date`, default yesterday in Rome), as JSON Lines on stdout | no |
| `from-albo <albo link>` | the same act in this archive, from a permanent link of the Albo Pretorio | no |

The sections:

| Code | Section | Reached through |
|---|---|---|
| `DGC` | Delibere di Giunta Comunale | its list |
| `DCC` | Delibere di Consiglio Comunale | its list |
| `DCCIR` | Delibere di Consiglio di Circoscrizione | the filter: year (its form has no date) |
| `DCS` | Delibere del Comitato dei Sindaci | its list |
| `OS` | Determinazioni e Ordinanze Sindacali | its list |
| `DCO` | Determinazioni e Ordinanze Commissariali | its list |
| `DDI` | Determinazioni e Ordinanze Dirigenziali | the filter: protocol date |
| `ODT` | Determinazioni e Ordinanze Dirigenziali Ufficio Traffico | the filter: protocol date |

Every row has the same columns: `section`, `type`, `number`, `date` (of protocol), `subject`, `sector`, `published_to` (end of the publication on the Albo), `attachments` (size, and whether the file is digitally signed), `permalink`. `type` is the portal's own label where the detail has one (OS, DDI, ODT), else the section's name. `sector` is filled on DDI only, the one section whose detail names it. Dates are ISO.

## Examples

```bash
opencli palermo-delibere sections -f table
opencli palermo-delibere list DGC -f table
opencli palermo-delibere search DGC --text "stadio"
opencli palermo-delibere search DDI --date 2026-09-22
opencli palermo-delibere search DGC --number 302 --year 2026
opencli palermo-delibere get "https://servizionline.comune.palermo.it/portcitt/pu/push-tabella-delibere.do?nomeTabella=FO_SCEDELIBERE&TD=DGC&ALBCOD=627E6A627A607C716675&sportello=portcitt"
opencli palermo-delibere attachments 627E6A637B647F72637F --section DCS    # 2 PDFs into ./DCS-2026-9/
opencli palermo-delibere dump --date 2026-09-22 > delibere.jsonl         # 8 sections, about 150 acts, under a minute
opencli palermo-delibere from-albo "https://albopretorio.comune.palermo.it/albopretorio/pu/push-tabella-delibere.do?nomeTabella=FO_SCEDELIBEREAP&TD=2024&ALBCOD=6271636279617070677D&sportello=albopretorio"
```

A daily archive is published as a release asset, rebuilt every morning by `.github/workflows/palermo-delibere-daily.yml`: `dump` for the previous day appended to the archive, sorted, identical lines dropped, so acts accumulate over time. The file is replaced each day, and past versions of it are not kept. The job stops without touching the archive if the dump fails or is empty, if a row has fields other than the nine above, all strings, or if the archive would have fewer rows than the day before (`bin/jsonl-merge.sh`).

```bash
curl -sL https://github.com/aborruso/opencli/releases/download/palermo-delibere-data/palermo-delibere.jsonl | head -1 | jq .
```

## Traps of this source

- **The filter refuses broad queries.** "I criteri di filtro impostati corrispondono ad un numero eccessivo di elementi: 12.493" is what the year 2026 alone gets on DDI. A single protocol date passes (22/09/2026: 28 acts). The same filter accepts a year of DCCIR (1,248 acts in 2026) or of ODT (2,627 in 2025). `search` passes the refusal on with the count.
- **Three sections have no list.** DDI, ODT and DCCIR open on the filter form. `list` reaches ODT and DCCIR through the current year, whose result is newest first, and refuses DDI.
- **Each section has its own form.** Only DDI and ODT have a date, only DDI a sector, OS and DCO have no number. A flag the section lacks is refused by name, not ignored.
- **At most two pages per section, 20 acts, by design.** Each act costs one request for its detail. `dump` reads, per section: the list (DGC, DCC, DCS, OS, DCO), the year of the day (DCCIR), the protocol date of the day (DDI, ODT). A day with more than 20 acts in DDI is cut; `dump` says per section how many it read and of how many on stderr.
- **The "Copia" link of the portal cannot be trusted.** On ODT it names the DDI table with an empty `TD`, and opens "Nessun record presente". On six DCO deliberations of 2024-12-30 it is only the portal's base URL. So the adapter builds every permanent link from the act's internal id, with the section's own code and table. Checked on one act per section with `get`.
- **`ALBCOD` is the internal id `ALB_COD`, XORed with the key `SISPISICUL` and hex-encoded**, as on the Albo: `627E6A627A607C716675` ↔ `1792335239`, which is also the prefix of that act's attachment names.
- **The Albo and this archive share their records.** The same `ALBCOD` opens the act here once the link names the right section: Albo TD 2024 → DGC, 2022 → DCC, 1037940907 → DCCIR, 2010 → DDI, 2001 and 2011 → OS, 2012 → ODT. An Ordinanza Dirigenziale of an office other than traffic may be in DDI, so `from-albo` tries both. The other Albo types (notices, calls, marriage banns, building permits, convocations and so on) are not archived here.
- **The text search is literal.** `--text` matches the subject as it was typed, and subjects break words with hyphens: the adoption of the barrier-removal plan (DGC 272 of 2026) reads "ARCHI-TETTONICHE", so "barriere architettoniche" misses it.
- **`date` is the date of protocol, not of the act.** A district council deliberation "del 15.09.2026" was protocolled on 24/09, and that is its `date`.
- **Numbers restart every year.** A number alone does not name an act: pair `search --number` with `--year`. `attachments` puts the year in the folder name.
- **The subject is a `<div>` here, a `<textarea>` on the Albo.** Same application, different template.
- **Attachments have no permanent link.** As on the Albo, `viewDocument?col=ALLEGATI&idx=i` is an index into the detail last opened in the session; `attachments` opens the act and downloads on the same session. The file name is in `content-disposition`; the [userscript](../../userscripts/) shows it on the page.
- **The portal rate-limits bursts with HTTP 429.** Requests are sequential, and on a 429 the adapter waits 3, 10 and 30 s before giving up.
- **`dump` prints its own JSON Lines**, one line per act, and returns nothing to the renderer: `-f` does not apply to it.
