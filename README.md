# opencli — note e sitemap

Due cose in un repo solo, entrambe attorno a [OpenCLI](https://github.com/jackwener/OpenCLI):

- **`docs/`** — mirror verbatim della documentazione upstream (`meta.yml` è la provenienza) più `notes.md`, le note pratiche personali: setup del Browser Bridge su WSL2, modello a tre casi, trappole.
- **`sitemaps/`** e **`plugins/`** — grafi di navigazione per agenti e adapter, uno per sito.

## Sitemap

Una sitemap OpenCLI non è una sitemap SEO: è un grafo di esecuzione per agenti, cartella di Markdown che dice a chi guida `opencli browser` dove si trova, che azioni esistono, quale adapter preferire e come recuperare quando la pagina smentisce la memoria.

```
sitemaps/<sito>/
  SITE.md                 # scopo, auth, rotte top-level
  pages/<page-id>.md      # ancore, action (pre/do/post/fail/recover/evidence)
  workflows/<task-id>.md  # best path, fallback, avoid
  pitfalls.md             # modi di fallire durevoli
```

OpenCLI cerca le sitemap solo in `~/.opencli/sites/<sito>/sitemap/` (e dentro il pacchetto npm). Da qui si agganciano con symlink:

```bash
bash bin/sync-sitemaps.sh
```

Lo script linka solo la sottocartella `sitemap`, mai `sites/<sito>` — lì vivono già `endpoints.json`, `notes.md` e `verify/`. `sitemaps/aliases.txt` copre i casi in cui OpenCLI risolve un host su un nome di sito diverso.

## Plugin

Gli adapter stanno in `plugins/<sito>/` e si installano una volta:

```bash
opencli plugin install "file://$PWD/plugins/<sito>"
```

## Siti coperti

| Sito | Sitemap | Adapter |
|---|---|---|
| law-tracker.europa.eu (EU Law Tracker) | `sitemaps/law-tracker/` | `plugins/law-tracker/` — `proposals`, `events`, `search`, `timeline`, `topics` |

## Regola di editing

`docs/*.md` (tranne `notes.md`) sono copie verbatim upstream: non si toccano a mano, si rigenerano dal refresh. Tutto il resto è scritto a mano. Vedi `CLAUDE.md`.
