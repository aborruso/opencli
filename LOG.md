# LOG

## 2026-08-28 (sera)

- Primo sito coperto: **law-tracker.europa.eu** (EU Law Tracker). Sitemap in `sitemaps/law-tracker/` (SITE + 3 pages + 3 workflow + pitfalls) e plugin in `plugins/law-tracker/` con 5 comandi PUBLIC (`proposals`, `events`, `search`, `timeline`, `topics`). `opencli validate law-tracker` → PASS, tutti e 5 provati dal vivo.
- Contratti API ripresi dal progetto `eutrack` (printing-press) e **riverificati uno a uno** con curl. Recon delle pagine con agent-browser.
- Scoperta che vale da sola la sessione: **con testo libero (`quickSearch`/`title`) il backend ignora i filtri `status` e `stage`** e restituisce righe che non li rispettano, senza errore. Due prove indipendenti (stage FR + "artificial intelligence" → righe EOP; title + status ong → una WIT). Da soli i filtri funzionano; `topics` e `procedure` restano in AND. L'adapter rifiuta la combinazione con ARGUMENT invece di consegnare dati sbagliati.
- Altre trappole verificate e documentate: `totalResults` = 0 con risultati popolati; titoli con markup `<em>`; codice EuroVoc composto (`52,DOM` va spezzato in code+type); reference in due grafie (`2021/0106(COD)` ⇄ `2021_106`); timeline risponde **400** e non 404 su reference inesistente; procedura inesistente = HTTP 200 con pagina vuota; banner cookie che intercetta i click; `<title>` identico su tutte le pagine tranne i risultati.
- Le pagine risultati sono deep-linkabili (`/results?quickSearch=…`, `?searchType=topics&eurovoc=…`, `?searchType=advanced&statusType=…&stage=…`): la sitemap mette la navigazione diretta come strada principale e i form come fallback.
- Aggiunto `sitemaps/aliases.txt` + gestione alias nel sync. L'alias `europa` (fallback SLD) è stato **provato e poi respinto**: verificato che con quell'alias anche `eur-lex.europa.eu` e `commission.europa.eu` si vedono servire la sitemap di law-tracker. Meglio non trovarla che darne una sbagliata. Resta da verificare col Browser Bridge che a runtime il nome risolto sia `law-tracker` (`opencli doctor` → estensione non connessa).
- Rimosso uno stub vuoto `~/.opencli/sites/asl-taranto/sitemap` lasciato da un test.

## 2026-08-28

- Il repo diventa anche una **collezione di sitemap OpenCLI** (non un repo per sitemap). `git init` fatto, aggiunti `sitemaps/`, `bin/sync-sitemaps.sh`, `tasks/todo.md`; `CLAUDE.md` esteso (queste cartelle sono a mano, non mirrorate).
- Verificato nel codice della CLI (`dist/src/cli.js`, v1.8.6): le sitemap si cercano **solo** in `~/.opencli/sites/<site>/sitemap` e in `<packageRoot>/sitemaps/<site>`. Nessuna env var, i plugin non le trasportano → un repo esterno si aggancia per forza via symlink sulla sola sottocartella `sitemap`.
- Il nome cartella non è l'hostname: `siteNameCandidatesFromUrl` prova prima i `site` degli adapter con `domain` combaciante, poi ripiega sulla **sola etichetta SLD** dell'host. Provato con registry vuoto: `servizionline.asl.taranto.it` → `taranto`, `opendata.comune.palermo.it` → `palermo`. Per un sito senza adapter il nome è quindi grossolano e può collidere.

## 2026-07-05 (sera 2)

- `openalex trends`: fix titoli duplicati. Causa: OpenAlex indicizza come lavori distinti (id diversi) le versioni di un deposito (Zenodo/figshare `.v1/.v2`, DOI consecutivi), i mirror arXiv↔DOI (`arxiv.org/abs/X` vs `10.48550/arxiv.X`), osf/github+DOI. La dedup per `w.id` non li vedeva. Aggiunta `dedupByTitle()` (titolo minuscolo + spazi compressi), applicata a **tutti** i profili tenendo il primo per data. Le liste arrivano ordinate per data desc → tiene il più recente. Over-fetch a 200 anche per i profili singoli (la dedup può scartare righe) poi `slice(limit)`.
- Tradeoff noto: due lavori genuinamente diversi con titolo identico (es. "Comment on egusphere-…" rc1/rc2) vengono collassati in uno. Accettabile per un feed di novità.
- Verifica: `all --days 30 --limit 200` → 0 gruppi di titoli duplicati (prima decine), righe 200→163.

## 2026-07-05 (sera)

- `openalex trends`: aggiunta opzione `--year YYYY` (anno solare esatto via `publication_year`), **alternativa** e con precedenza su `--days` (finestra mobile via `from_publication_date`). `buildFilter` ora riceve un `windowFilter` già pronto (`from_publication_date:...` o `publication_year:...`). Validato PASS, testati `--year 2026/2024`, `--days 10`, default.
- Verificato il sort di default OpenAlex: con una search → `relevance_score:desc`; senza search → `cited_by_count:desc`. Entrambi inutili per un feed di novità (in cima escono lavori vecchi/citati) → l'adapter forza `publication_date:desc`.

## 2026-07-05

- Aggiunto adapter `openalex trends` (PUBLIC) in `~/.opencli/clis/openalex/trends.js`: feed dei lavori recenti su "open data" per tema, con **finestra mobile** (`from_publication_date` = oggi − N giorni) + `sort=publication_date:desc`. Complementare al built-in `openalex search` (in `node_modules`, non editabile, senza filtri topic/data né sort). Include retry+backoff sui 5xx/429 (assente nel built-in).
- **Topic fissati** (interrogato l'endpoint `/topics`, scelti i più vicini, non tutti): `T10953` E-Government, `T11937` Research Data Management, `T11719` Data Quality, `T10799` Data Visualization, `T11675` Open Source Software. L'AI **non** ha un topic pulito in OpenAlex (è tassonomizzata per dominio: sanità/legge/business) → canale `ai` via ricerca testuale keyword.
- Profili: `topics` (default, 4 temi + gov), `tools`, `quality`, `sharing`, `viz`, `ai`, `all` (unione topic+ai, deduplicata per id). Opzioni: `--days` (default 30), `--limit` (max 200), `--oa` (solo Open Access).
- Chiave API letta da `process.env.OPENALEX_API_KEY` (premium pool); fallback a `mailto` (polite pool) se assente. Regola di sicurezza: la chiave non finisce mai nei messaggi d'errore (loggo solo lo status HTTP, come `sec`).
- `opencli validate openalex/trends` → PASS. Testati end-to-end tutti i profili + `--oa` + `-f json/table` + path d'errore (ARGUMENT su profile sconosciuto).
- Motivazione: il custom search di OpenAlex con `publication_year:2024` fisso + `sort=relevance_score` non serve a restare aggiornati (finestra statica). La finestra mobile + sort per data sì.
- Colonne output: `date, title, oa, venue, doi, pdf, url`. `pdf` = full-text OA diretto (vuoto se non-OA); `url` = pagina da aprire per leggere (landing editore → risolutore DOI → scheda OpenAlex come fallback), sempre valorizzata. Campi da `select`: aggiunto `best_oa_location` oltre a `primary_location`/`open_access`.

## 2026-07-04 (sera 2)

- Aggiunto adapter `sec proxy` (PUBLIC): fetch documento (URL o ultimo DEF 14A per ticker) → HTML→testo pulito. `--section` best-effort (aggancia PLTR/AAPL, manca MSFT: gli slicer regex sono fragili perché ogni DEF 14A ha HTML diverso → l'estrazione è lavoro dell'AI).
- Retry+backoff sui 5xx/429 aggiunto a `search`/`company`/`proxy` (efts.sec.gov dà 500 transitori).
- **Prova end-to-end PRD** (Palantir DEF 14A 2026): opencli fornisce testo pulito (257k char) → estrazione AI → JSON strutturato delle 3 sezioni (7 board, 5 exec, 10 owner + BlackRock). Auto-verifica: membri comitati ⊆ indipendenti ✓, gruppo=10 persone ✓. Conferma architettura: opencli=dati deterministici, agente AI=estrazione+sanity check.

## 2026-07-04 (sera)

- Adapter `sec` (PUBLIC, browser:false) in `~/.opencli/clis/sec/`:
  - `search` — full-text EDGAR (`efts.sec.gov`), ordinato per **rilevanza**.
  - `company <ticker|CIK|nome>` — filing via **submissions API** (`data.sec.gov`), ordinati per **data** (dal più recente), filtrabili `--forms`. Deterministico per "ultimo DEF 14A per azienda". Risolve ticker→CIK via `company_tickers.json`.
- Applicata skill `opencli-usage`: `opencli validate sec/company` + `sec/search` → PASS; verificati `-f json` e presenza in `opencli list`.
- Caso d'uso: PRD `~/git/idee/re_documenti_sec` (proxy DEF 14A). `sec company` copre lo step di *discovery* deterministico; estrazione delle 3 sezioni resta lavoro a valle, tool-agnostico.

## 2026-07-04

- Creata cartella note personali `~/git/idee/opencli`.
- Creato bundle `docs/` stile `ai-specs/specs/okf`: mirror verbatim upstream + `meta.yml` (provenienza + sha256) + `notes.md` (note a mano).
- Mirror scope "Completo": README + SKILL (browser, usage, adapter-author) + guide (extending, exit-codes, plugins). CLI upstream v1.8.6, estensione v1.0.22.
- `notes.md` cattura il setup non ovvio: Browser Bridge su WSL2 richiede l'estensione caricata nel Chrome di WSL via X410 (CDP non basta); Chrome va lanciato da shell utente persistente (sandbox → exit 144).
- Scoperto che `--headless` non pilota le tab (chrome.debugger attach_failed); soluzione = Xvfb (schermo virtuale) → Chrome invisibile. Confermato da test + CI del repo + DeepWiki. notes.md riscritto col modello a 3 casi (A=no browser, B=Xvfb invisibile, C=X410 login). Funzioni `opencli-bridge` / `opencli-bridge-login` / `opencli-bridge-stop` aggiunte a `~/.zshrc` (backup `~/.zshrc.bak-2026-07-04`).
- Aggiunti al README 20 esempi pronti all'uso (browser:false, tutti collaudati) e `list.txt` con l'inventario completo (1275 comandi, 173 siti).
