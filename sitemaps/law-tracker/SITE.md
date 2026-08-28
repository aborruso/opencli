---
schema_version: 1
site: law-tracker.europa.eu
last_verified: 2026-08-28
source: local
login_required: false
auth_strategy: NONE
---

# EU Law Tracker

## Overview

Portale della Commissione europea per seguire l'iter delle procedure legislative dell'Unione: proposte, eventi, fasi, documenti. SPA Angular su API JSON pubblica, senza login e senza anti-bot.

## Regola d'ingaggio

Per **leggere dati** non aprire il browser: gli adapter `opencli law-tracker *` chiamano direttamente l'API e restituiscono righe strutturate. Il browser serve solo per ciò che gli adapter non coprono (facet della pagina risultati, esplorazione visiva, export XML) e per verificare che una pagina esista davvero.

## Top-level routes

- `/homepage` → `pages/homepage.md`
- `/results?...` → `pages/results.md` (ricerca rapida, per topic e avanzata: tutte finiscono qui, con URL deep-linkabile)
- `/procedure/<api-ref>` → `pages/procedure.md`
- `/legislative-priorities` → esiste, non coperta da questa sitemap: l'agente esplori da sé
- `/content/about`, `/content/help`, `/content/privacy-statement`, `/content/cookies`, `/content/accessibility` → pagine editoriali statiche, fuori scope
- `/advanced-search` → non è una route: il pannello avanzato è un accordion dentro `/homepage`, vedi `pages/homepage.md`

## Common goals

- Trovare le procedure su un tema → `workflows/find-procedures.md`
- Ricostruire l'iter di una procedura nota → `workflows/track-procedure.md`
- Sapere che novità ci sono → `workflows/whats-new.md`

## Comandi disponibili

`opencli law-tracker proposals | events | search | timeline | topics` — plugin in `~/git/idee/opencli/plugins/law-tracker`, tutti `browser:false`. Endpoint e contratti in `~/.opencli/sites/law-tracker/endpoints.json`.

## Site-wide pitfalls

Vedi `pitfalls.md`. I due che mordono per primi: il banner cookie intercetta i click sulla homepage, e il `<title>` della pagina è identico ovunque tranne che sui risultati - non usarlo come firma di stato.

## Nota di stato

Verificato con il Browser Bridge collegato: `opencli browser <sess> open https://law-tracker.europa.eu/homepage` restituisce `sitemap.site: "law-tracker"`, `available: true`, `source: local`. Il `domain` dichiarato dall'adapter batte il fallback SLD. L'alias su `europa` è stato scartato di proposito: servirebbe questa sitemap a tutti i siti `*.europa.eu`. Vedi `pitfalls.md#site_name_alias`.
