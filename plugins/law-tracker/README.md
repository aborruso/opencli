# law-tracker — adapter OpenCLI

Cinque comandi sull'API JSON pubblica di [EU Law Tracker](https://law-tracker.europa.eu). Nessuna auth, nessun browser: tutti `browser:false`.

```bash
opencli plugin install "file://$PWD"     # da questa cartella
opencli validate law-tracker             # atteso: PASS, 5 comandi
```

Formati: `-f table` (default), `json`, `csv`, `yaml`, `md`.

## Novità recenti

```bash
opencli law-tracker proposals --limit 10                      # ultime proposte della Commissione
opencli law-tracker events --limit 10                         # ultimi eventi su tutti i fascicoli
opencli law-tracker events --limit 20 --offset 20             # pagina successiva
opencli law-tracker events --limit 5 -f json | jq -r '.[] | [.initiationDate,.reference,.event] | @tsv'
```

## Cercare procedure

```bash
opencli law-tracker search "artificial intelligence"          # testo libero
opencli law-tracker search --title "artificial intelligence"  # solo nel titolo
opencli law-tracker search --procedure "2021/0106(COD)"       # una procedura precisa
opencli law-tracker search --keyword climate --size 5         # parola chiave (filtro strutturato)
opencli law-tracker search --status ong --stage FR --size 20  # aperte, in prima lettura
opencli law-tracker search --status ong --sort DATE --direction DESC --size 10
opencli law-tracker search --eurovoc "12,DOM" --status ong    # dominio EuroVoc "LAW"
opencli law-tracker search --policyArea 01 --size 5
```

Stati: `ong` in corso, `ado` adottata, `nad` non adottata, `wit` ritirata. Fasi: `PR` proposta, `FR` prima lettura, `SR` seconda lettura, `CTR` conciliazione e terza lettura, `EOP` fine procedura.

**Testo libero e `--status`/`--stage` non si combinano**: il backend ignora quei due filtri quando riceve testo, e restituirebbe righe che non li rispettano. Il comando rifiuta la combinazione. Per restringere una ricerca testuale usare `--keyword`.

## Vocabolari

```bash
opencli law-tracker topics eurovoc            # i 21 domini di "Browse by topic", con i codici
opencli law-tracker topics policy-area
opencli law-tracker topics procedure-types
```

Gli altri: `document-types`, `legal-basis-treaties`, `agent-names`, `activity-types`, `activities-agents`.

## Iter di una procedura

```bash
opencli law-tracker timeline 2021/0106\(COD\)                 # AI Act
opencli law-tracker timeline 2021_106                         # stessa cosa, forma API
opencli law-tracker timeline 2021_106 -f json | jq -r '.[-1] | "\(.date)  \(.stage)  \(.event)"'
```

## Qualche pipeline

```bash
# quante procedure per fase, sulle ultime 20 aperte
opencli law-tracker search --status ong --size 20 -f json \
  | jq -r 'group_by(.currentStage)[] | "\(.[0].currentStage)\t\(length)"'

# da un dominio EuroVoc alle procedure aperte, solo reference e link citabile
opencli law-tracker search --eurovoc "12,DOM" --status ong --size 5 -f json \
  | jq -r '.[] | "\(.reference)\t\(.url)"'

# tutte le proposte recenti in un CSV
opencli law-tracker proposals --limit 50 -f csv > proposte.csv
```

## Trappole

Le trappole del sito e dell'API stanno in `../../sitemaps/law-tracker/pitfalls.md`; i contratti degli endpoint in `~/.opencli/sites/law-tracker/endpoints.json`.
