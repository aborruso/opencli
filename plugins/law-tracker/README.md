# law-tracker — OpenCLI adapter

Five commands over the public JSON API of [EU Law Tracker](https://law-tracker.europa.eu). No auth, no browser: all `browser:false`.

```bash
opencli plugin install "file://$PWD"
opencli validate law-tracker      # expected: PASS, 5 commands
```

| Command | What it does |
|---|---|
| `proposals` | latest Commission legislative proposals |
| `events` | latest legislative events across all files |
| `search` | search procedures: free text, or the Advanced Search filters |
| `timeline` | the events of one procedure, oldest first |
| `topics` | controlled vocabularies (EuroVoc domains, policy areas, procedure types…) |

Example commands with real output, plus the site's traps: [`../../sitemaps/law-tracker/README.md`](../../sitemaps/law-tracker/README.md).

API contracts live in `~/.opencli/sites/law-tracker/endpoints.json`, field-level notes in `~/.opencli/sites/law-tracker/notes.md`.
