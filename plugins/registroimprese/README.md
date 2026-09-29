# registroimprese — OpenCLI adapter

Two commands over the [free search of the Registro Imprese](https://registroimprese.infocamere.it/web/guest/ricerca-libera-e-acquisto), the Italian business register run by InfoCamere for the Chambers of Commerce: companies by name, in one province or in all of Italy, with the free detail of each one (address, PEC, ATECO code), and the suggestions of the search box.

The search form is guarded by reCAPTCHA Enterprise, scored on the server, so `search` drives the site's own page in your Chrome through the OpenCLI Browser Bridge. `suggest` is a plain JSON endpoint and needs no browser.

```bash
opencli plugin install github:aborruso/opencli/registroimprese   # from the published repo
opencli plugin install "file://$PWD"                             # from a local clone
opencli validate registroimprese      # expected: PASS, 2 commands
opencli doctor                        # `search` needs: Extension: connected
```

| Command | What it does | Browser |
|---|---|---|
| `search <name>` | companies whose name matches, or with `--activity <text>` the companies of one activity or ATECO description (an entry of `suggest`, by its text or a piece that picks one); `--province BA` (code, or a piece of the name that picks one), `--all` for every related result, `--limit` up to 75, `--detail` for address, province, phone, PEC, ATECO | yes |
| `suggest <text>` | the search box's suggestions for the start of a name or activity: up to 10 names, activities and activity descriptions, the last two with their ATECO code; `--kind name\|activity\|description` | no |

## Data schema

One row per company office (a company with a registered office and local units gives one row each). Every value is a string or null.

| Field | Portal field | Meaning |
|---|---|---|
| `name` | "Nome impresa" | The company name as the register prints it |
| `kind` | the row's badge | `Sede Legale` (registered office) or `Unità Locale` (local unit) |
| `city` | the row | Municipality of the office |
| `legal_form` | "Forma giuridica (generico)" | Generic legal form, e.g. `Societa' Di Capitale`; the full one is behind login |
| `activity` | "Descrizione Attività" | Activity as declared, with its start date in the list row |
| `status` | the status badge | `Registrata`, or the other states the register shows (`--all` may include cancelled ones only when the site does) |
| `address` | hidden fields of the detail | Street and number, plus hamlet and postcode when present. `--detail` only |
| `province` | hidden field of the detail | Two-letter code. `--detail` only |
| `phone` | hidden field of the detail | Often empty. `--detail` only |
| `pec` | "Domicilio digitale/PEC" | The certified e-mail, behind the page's "MOSTRA" button. `--detail` only |
| `ateco` | "Classificazione ATECO" | ATECO code, e.g. `62.90.09`. `--detail` only |
| `ateco_label` | "Classificazione ATECO" | The label of that code. `--detail` only |
| `id` | `_id` in the detail link | The site's opaque id of the row: valid only in the session that ran the search, kept for reference |

REA number, tax code and the full legal form are behind login on the site and out of scope.

## Examples

```bash
opencli registroimprese suggest infocam
opencli registroimprese search infocamere --province RM --detail
opencli registroimprese search infocamere --province padova
opencli registroimprese search infocamere --all --limit 30 -f table
opencli registroimprese suggest "edizione di sof"                          # descriptions with their ATECO code
opencli registroimprese search --activity "edizione di software" --province EN
```

## Traps of this source

- **reCAPTCHA Enterprise, scored on the server.** The page executes the captcha, puts the token in a hidden field and submits; the server checks the score. A rejected search gets the same page back with the results block empty and no message, and tokens are single use, so no HTTP client can replay it. `search` runs in your Chrome through the bridge. Headless Chrome never passed. In Xvfb (`opencli-bridge`) the first submit usually fails and the score drops after a few dozen searches; **in a visible Chrome window (`opencli-bridge-login`, X410 on WSL) two searches in a row passed at the first submit, with the same profile that Xvfb had just got blocked.** Use the visible bridge for this site.
- **The first submit often comes back empty, the second works**, also for a person clicking: in a recorded session two identical POSTs, same cookies and same token flow, the first answered the empty block and the second the results. `search` resubmits up to 3 times when the block is empty, and says how many submits it took in the footer. Three empty answers in a row are reported as a captcha problem, distinct from "no company matches", which the site says in words.
- **The site never says a search was rejected.** There is no "too many attempts" message and no counter: the server gets a score from Google and, under its threshold, answers the same page with the results block empty. The page's code has no branch for a rejected captcha. The same silence hits a person: the first click of a session is often empty with no explanation. The 3-submits error of the adapter is the only place this is said.
- **The score drops with use.** On 2026-09-26, after about thirty searches in half an hour from one Chrome, every submit came back empty, by hand in that Chrome too, and `--limit` above 20 (a second captcha token for the page-size change) went first. Keep a session to a few searches, and when the 3-submits error appears leave the site alone for a while rather than retrying in a loop. Once, in that phase, a `rossi --all --limit 50` returned 7 rows instead of 50, not explained.
- **The detail is session-bound.** Its link carries an opaque id that the results portlet resolves from the search it holds in memory, so there is no `get <id>`: `--detail` opens each row's page in the same session, one page per row.
- **Searching by activity is what the autocomplete does.** An activity or description picked in the search box sets its ATECO code in a hidden field (`filtroPldSuggest`) with the list it came from (`filtroTipoSugg`), and the server searches by code; the code typed as a name is searched as text. `--activity` reproduces the pick, so it needs an entry of the suggester, not a bare code.
- **One page per command.** The site paginates (20 to 75 rows) and every further page needs a new captcha token. The adapter reads the first page only, by design: walking the pages token after token to extract a whole category is not what this free search is for, and it was left out. For a category in a province look at the open data of the Chambers of Commerce or at InfoCamere's paid access.
- **"Primi risultati" by default.** The site ranks and cuts the list (`filtroScore=S`) and prints "Vedi tutti i risultati correlati (N)" underneath; `--all` asks for those (`filtroScore=N`). The site's own count in the footer can differ from the rows shown.
- **The suggester's WAF (F5) rejects Node's `fetch`** with "Request Rejected" whatever the headers, and answers a JavaScript challenge to a request without `Origin`. `suggest` uses `node:https` with the headers the search page sends (`Origin`, `Referer`, `Accept-Language`, a browser `User-Agent`).
