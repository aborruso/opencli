# albo-palermo — OpenCLI adapter

Five commands over the [Albo Pretorio of the Comune di Palermo](https://albopretorio.comune.palermo.it/albopretorio/jsp/home.jsp?modo=info&info=servizi.jsp), the register where the city publishes its acts with legal effect: deliberations, executive decisions, ordinances, notices, calls, marriage banns. No key, no auth, no browser.

The portal is a server-rendered JSP application by SISPI. Its "your browser does not support JavaScript" banner is cosmetic: the data is in the HTML. What the portal lacks is a stable handle in its lists. A row links to `row=N` of the current session, and the permanent link of an act, the one the "Copia" button copies, appears only on its detail page. So every row these commands return comes from the detail page, and carries that permanent link.

```bash
opencli plugin install github:aborruso/opencli/albo-palermo   # from the published repo
opencli plugin install "file://$PWD"                          # from a local clone
opencli validate albo-palermo      # expected: PASS, 5 commands
```

| Command | What it does | Browser |
|---|---|---|
| `types` | the 11 categories and 112 document types, with their TD codes; `--category`, `--filter` | no |
| `list <type>` | the acts of one type in publication, newest first; `--pages 1\|2` | no |
| `search <type>` | the portal's filter: `--text` in the subject, `--year` and `--number` of protocol, `--sector` | no |
| `get <permalink>` | one act, from its permanent link or from `ALBCOD` plus `--type` | no |
| `dump [types]` | every type, or a comma-separated list of TD codes and type names, as JSON Lines on stdout | no |

A document type is given by its exact name, case-insensitive (`"Avviso Pubblico"`), or by its TD code (`1041037357`). The codes are the portal's internal ones: `2024` is Delibera Di Giunta Comunale, not a year. Two names belong to two types each, Decreto Prefettizio and Rilascio Immobile, and for those the command refuses the name and lists both codes.

Every row has the same columns: `type`, `number`, `date` (of protocol), `subject`, `sector`, `published_from`, `published_to`, `attachments` (size, and whether the file is digitally signed), `permalink`. `dump` adds `category` and `td` in front. Dates are ISO.

## Examples

```console
$ opencli albo-palermo types --filter "avviso pubblico"
[
  {
    "category": "AVVISI ED ATTI DIVERSI",
    "type": "Avviso Pubblico",
    "td": "1041037357",
    "url": "https://albopretorio.comune.palermo.it/albopretorio/pu/push-tabella-delibere.do?nomeTabella=FO_SCEDELIBEREAP&AP=AP&TD=1041037357"
  }
]
```

```console
$ opencli albo-palermo dump "Avviso Pubblico" --pages 1 | head -1 | jq .
{
  "category": "AVVISI ED ATTI DIVERSI",
  "td": "1041037357",
  "type": "Avviso Pubblico",
  "number": "1070083",
  "date": "2026-09-22",
  "subject": "AVVISO PER ESTUMULAZIONE E RIUNIONE RESTI NELLA SEZ. 18BIS N. 4 CIMITERO CAPPUCCINI.",
  "sector": "AREA DEI SERVIZI CIMITERIALI, PROTEZ.CIV. E SICUR.",
  "published_from": "2026-09-22",
  "published_to": "2026-10-22",
  "attachments": "312,32 KB",
  "permalink": "https://albopretorio.comune.palermo.it/albopretorio/pu/push-tabella-delibere.do?nomeTabella=FO_SCEDELIBEREAP&TD=1041037357&ALBCOD=627163617E6B79766179&sportello=albopretorio"
}
```

```bash
opencli albo-palermo list "Avviso Pubblico"                     # the last 20
opencli albo-palermo list "Delibera Di Giunta Comunale" -f table
opencli albo-palermo search "Delibera Di Giunta Comunale" --text "variazione peg"
opencli albo-palermo search "Delibera Di Giunta Comunale" --sector segreteria --pages 1
opencli albo-palermo get "https://albopretorio.comune.palermo.it/albopretorio/pu/push-tabella-delibere.do?nomeTabella=FO_SCEDELIBEREAP&TD=2024&ALBCOD=6271636078667F75657B&sportello=albopretorio"
opencli albo-palermo dump > albo-$(date +%F).jsonl              # every type, about 4 minutes
opencli albo-palermo dump "Avviso Pubblico,Delibera Di Giunta Comunale,Determinazioni Dirigenziali" > watch.jsonl
```

To follow the register day by day, keep yesterday's dump and look for permanent links that were not in it:

```bash
opencli albo-palermo dump > today.jsonl
jq -c --slurpfile y yesterday.jsonl '($y | map(.permalink)) as $old | select(.permalink as $p | $old | index($p) | not)' today.jsonl
```

## Traps of this source

- **At most two pages per type, 20 acts, by design.** Each act costs one request for its detail, sequential within a type because the session is stateful. The register lists newest first, so the last 20 are what a daily follow-up needs. `list`, `search` and `dump` all stop there, and say what they left out: the footer of `list` and `search` gives the total and the page count, and `dump` writes on stderr every type it cut. On 2026-09-22 seven types went past 20 acts. The biggest was Determinazioni Dirigenziali (TD 2010), with 855 acts on 86 pages.
- **Only acts currently in publication.** The register has no archive. An act that ends its publication period drops out of every command, `get` included.
- **The session is the state.** `row=N` counts within the current page. The next page is a POST, and the filter is two POSTs on the same session. A `row` that does not fit the state answers HTTP 200 with "Servizio temporaneamente non disponibile", which the adapter turns into an error.
- **A search with one match skips the list** and opens the act directly, and so does a document type with one act in publication. `list`, `search` and `dump` handle both shapes.
- **`--year` and `--sector` accept only what the filter form offers** for that type, which means the years and sectors that have acts in publication. A wrong value gets the list of valid ones back. `--sector` takes a code or a piece of the name that picks one sector.
- **`ALBCOD` is the internal id `ALB_COD`, XORed with the fixed key `SISPISICUL` and hex-encoded.** `1800156607` ↔ `6271636078667F75657B`. The ids are dense, so a mistyped `ALBCOD` can open a different act rather than none: prefer the whole permanent link.
- **Attachments have no permanent link.** On the portal they are `viewDocument?col=ALLEGATI&idx=i`, an index into the session. So a row lists their size and signature, not a URL. There is no download command.
- **The portal rate-limits bursts with HTTP 429**, with no `Retry-After`. It happened on 2026-09-22 after about a dozen requests in parallel. The adapter keeps at most two requests in flight, and on a 429 it waits 3, 10 and 30 s before giving up with a clear message. The limit is per address, so it also blocks the portal in your own browser for a while.
- **`dump` prints its own JSON Lines.** OpenCLI's `-f` has no JSON Lines format, so `dump` writes one line per act as each type finishes, and returns nothing to the renderer. `-f` does not apply to it.
