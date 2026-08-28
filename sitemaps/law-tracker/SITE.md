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

European Commission portal for following EU legislative procedures: proposals, events, stages, documents. Angular SPA over a public JSON API, no login and no anti-bot.

## Rule of engagement

To **read data**, do not open the browser: the `opencli law-tracker *` adapters call the API directly and return structured rows. The browser is for what the adapters do not cover — the sidebar facet counts, visual exploration, the XML export — and for proving that a page actually exists.

## Top-level routes

- `/homepage` → `pages/homepage.md`
- `/results?...` → `pages/results.md` (quick search, topic search and advanced search all land here, with a deep-linkable URL)
- `/procedure/<api-ref>` → `pages/procedure.md`
- `/legislative-priorities` → exists, not covered by this sitemap: explore it yourself
- `/content/about`, `/content/help`, `/content/privacy-statement`, `/content/cookies`, `/content/accessibility` → static editorial pages, out of scope
- `/advanced-search` → not a route: the advanced panel is an accordion inside `/homepage`, see `pages/homepage.md`

## Common goals

- Find the procedures on a topic → `workflows/find-procedures.md`
- Reconstruct the history of a known procedure → `workflows/track-procedure.md`
- See what moved recently → `workflows/whats-new.md`

## Available commands

`opencli law-tracker proposals | events | search | timeline | topics` — plugin at `~/git/idee/opencli/plugins/law-tracker`, all `browser:false`. Endpoints and contracts in `~/.opencli/sites/law-tracker/endpoints.json`.

## Site-wide pitfalls

See `pitfalls.md`. The two that bite first: the cookie banner intercepts clicks on the homepage, and the page `<title>` is identical everywhere except on the results page — never use it as a state signature.

## Site-name note

Verified with the Browser Bridge connected: `opencli browser <sess> open https://law-tracker.europa.eu/homepage` returns `sitemap.site: "law-tracker"`, `available: true`, `source: local`. The `domain` declared by the adapter beats the SLD fallback. An alias on `europa` was deliberately rejected: it would serve this sitemap to every `*.europa.eu` site. See `pitfalls.md#site_name_alias`.
