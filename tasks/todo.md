# Piano — collezione di sitemap OpenCLI in un unico repo

Stato: bozza da approvare. Aggiornato 2026-08-28.

## Cosa ho verificato (fatti, non ipotesi)

Fonti: `docs/` mirrorati, DeepWiki su `jackwener/OpenCLI`, e soprattutto il codice della CLI installata (`dist/src/cli.js`, v1.8.6) + skill on-disk `~/.nvm/.../@jackwener/opencli/skills/opencli-sitemap-author/`.

1. **Sitemap ≠ sitemap SEO**: è un "task execution graph" per agenti - `SITE.md`, `pages/<page-id>.md`, `pages/_<partial>.md`, `workflows/<task-id>.md`, `pitfalls.md`, tutti Markdown con frontmatter (`schema_version`, `site`, `last_verified`, `source`, `login_required`, `auth_strategy`).
2. **Solo due path di discovery** (`sitemapPathsForSite`, cli.js:192):
   - locale: `~/.opencli/sites/<safeSite>/sitemap/` (oppure `sitemap.md`)
   - globale: `<packageRoot>/sitemaps/<safeSite>/` - dentro il pacchetto npm, quindi non nostro
   Nessun terzo path, nessuna env var (`OPENCLI_DIR` non entra qui: usa `os.homedir()`).
3. **I plugin non trasportano sitemap.** `opencli-plugin.json` registra comandi, non sitemap. Quindi un repo unico di sitemap si aggancia solo con symlink/sync verso `~/.opencli/sites/<site>/sitemap`.
4. **Il nome della cartella non è l'hostname** (`siteNameCandidatesFromUrl`, cli.js:156): prima i `site` degli adapter il cui `domain` combacia con l'host, poi come fallback **la sola etichetta SLD** dell'host. Verificato: con registry vuoto, `servizionline.asl.taranto.it` → `taranto`, `opendata.comune.palermo.it` → `palermo`. Con l'adapter `asl-taranto` caricato dovrebbe vincere `asl-taranto`, ma va confermato in esecuzione reale.
   → Conseguenza: **sito senza adapter = nome forzato all'SLD**, grossolano e soggetto a collisioni (`sanita.puglia.it` → `puglia`).
5. **Symlink**: la discovery usa `fs.existsSync`, che segue i symlink. Si linka **solo la sottocartella `sitemap`**, mai `sites/<site>` (lì vivono già `endpoints.json`, `notes.md`, `verify/` - per `asl-taranto` esistono).
6. Precedente già in casa: `~/.opencli/plugins/asl-taranto -> ~/git/idee/albo-asl-taranto` + `plugins.lock.json`. Stesso pattern, applicato alle sitemap.

## Fasi

### Fase 0 - decisioni
- [x] Repo = questa cartella. `git init` fatto 2026-08-28.
- [x] Sito pilota: **law-tracker.europa.eu** (EU Law Tracker).

### Fase 1 - impalcatura del repo
- [x] `sitemaps/` e `bin/sync-sitemaps.sh` creati. Lo script salta un `sites/<site>/sitemap` che sia cartella vera anziché link, per non sovrascrivere conoscenza già presente.
- [x] `CLAUDE.md` esteso: `sitemaps/`, `bin/`, `tasks/` sono a mano, non mirrorati.
- [x] Layout istanziato con `law-tracker`. `bash bin/sync-sitemaps.sh` stampa il link e l'alias `europa`.

### Fase 2 - test di accettazione — FATTA
- [x] `opencli browser lt open .../homepage` → `sitemap.available: true`, `source: local`, `paths.local` = `~/.opencli/sites/law-tracker/sitemap` (symlink al repo).
- [x] Nome risolto: **`law-tracker`**. Il `domain` dell'adapter batte il fallback SLD, come previsto.
- [x] Ancore riverificate con `opencli browser`: `/results` ha `title: Search results`; su `/procedure/2021_106` la find sul reference trova 1 match, su `/procedure/9999_1` risponde `semantic_not_found`.
- [x] Alias `europa` valutato e scartato: servirebbe questa sitemap a tutti i siti `*.europa.eu` (verificato su eur-lex e commission). Il meccanismo alias resta in `bin/sync-sitemaps.sh` per casi senza collisione.

### Fase 3 - prima sitemap vera (pilota) — FATTA
- [x] Recon con agent-browser: homepage, pagina risultati, pagina procedura, pannello Advanced Search, Browse by topic.
- [x] Contratti API riverificati con curl uno a uno (5 endpoint + vocabolari).
- [x] Plugin `plugins/law-tracker/` con 5 comandi; `opencli validate law-tracker` → PASS; tutti provati dal vivo.
- [x] Sitemap: SITE.md, pages/{homepage,results,procedure}.md, workflows/{find-procedures,track-procedure,whats-new}.md, pitfalls.md (11 voci).
- [x] Memoria di sito: `~/.opencli/sites/law-tracker/{endpoints.json,notes.md}`.
- [ ] `verify/<cmd>.json`: `opencli browser verify` non funziona sugli adapter installati come plugin (cerca solo `~/.opencli/clis/`). Da capire se ejectare o lasciar perdere.
- [ ] `SITE.md` + 2-3 `pages/` + 1 `workflows/` che punta come *best path* ai comandi del plugin e come *fallback* al browser; `pitfalls.md` recupera il già noto (WAF Radware sui POST, CSRF iniettato via JS, atti scaduti senza documenti).
- [ ] Ogni action nello schema compatto `pre/do/post/fail/recover/evidence`, senza evidenze inventate → verifica: rilettura, ogni action ha un `evidence`.

### Fase 4 - generalizzare
- [ ] Seconda sitemap con lo stesso stampo; solo allora si fissa il layout.
- [ ] `README.md` del repo: cosa c'è, come si sincronizza.
- [ ] `LOG.md` aggiornato a ogni passo.

### Fase 5 - allineare il mirror (coerenza col resto del repo)
- [ ] Aggiungere a `docs/meta.yml` + scaricare: `SKILL-opencli-browser-sitemap.md`, `SKILL-opencli-sitemap-author.md`, `references/sitemap-schema.md`. Oggi mancano, e il repo diventa sitemap-centrico → verifica: sha256/bytes rigenerati.

## Convenzioni da fissare
- `source:` nel frontmatter: il contenuto vive nel repo ma è montato sul path dell'overlay locale → per il runtime è `source: local`. Scelgo `local` ovunque, salvo diverso parere.
- ID stabili: `page_id`/`workflow_id`/`pitfall_id` unici per sito; `action:<id>` unico dentro la pagina.
- Dimensione file: la spec dice 800 token, la skill on-disk ammette fino a ~1500 naturali, >3000 va spezzato. Uso la skill.

## Domande aperte
1. Quale sito pilota (URL + task che deve risolvere)?
2. Serve il Browser Bridge acceso? Se il sito è pubblico e senza login, `opencli-bridge` (Xvfb) basta; se c'è login, `opencli-bridge-login` una volta.
3. Il repo resta privato/locale o va su GitHub? cambia solo il README, non il layout.
4. Sitemap solo per siti con adapter, o anche per siti senza? Nel secondo caso il nome cartella è l'SLD e le collisioni sono possibili - va accettato o gestito con alias.
