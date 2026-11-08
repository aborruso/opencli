# raindrop — OpenCLI adapter

Four read-only commands over the [official Raindrop API](https://developer.raindrop.io/). Search your own saved bookmarks, inspect one bookmark, and discover collections and tags. No browser, synchronization, local index, or writes to Raindrop.

## Install and authenticate

```bash
opencli plugin install github:aborruso/opencli/raindrop
# From this repository's working copy instead:
opencli plugin install "file://$PWD/plugins/raindrop"
opencli adapter check raindrop
```

The adapter reads **`RAINDROP_TOKEN` from the command's environment**. An existing exported variable works directly:

```bash
opencli raindrop search 'cli agents' --limit 5
```

For your own account, Raindrop supports a [Test token](https://developer.raindrop.io/v1/authentication/token) from an application's settings. Never put the literal token in a command argument, source file, README, or chat. This adapter performs only GET requests, but the token itself may have broader permissions: protect it accordingly.

### Optional dotenvx

Dotenvx is not an adapter dependency or an automatic fallback. It supplies the same standard environment variable, without loading it into the parent shell or the entire agent session. Other secret managers can do the same.

With dotenvx 2.38.2, which supports hidden interactive input and `--redact`:

```bash
mkdir -p ~/.config/secrets
dotenvx set RAINDROP_TOKEN \
  -f ~/.config/secrets/raindrop.env \
  -fk ~/.config/secrets/.env.keys \
  --no-native --no-armor
```

Choose **Local**, then the indicated **File `.env.keys`**, and enter the token at the hidden prompt. `raindrop.env` holds encrypted values; `.env.keys` holds private decryption keys. Keep the keys private and backed up outside git. Do not run `dotenvx get` to verify a secret: it prints its value.

Run any command with:

```bash
dotenvx run --quiet --redact --strict \
  -f ~/.config/secrets/raindrop.env \
  -fk ~/.config/secrets/.env.keys \
  -- opencli raindrop search 'cli agents' --limit 5
```

`--strict` refuses failed loading; `--redact` masks exact injected values in output; `--quiet` suppresses the dotenvx banner for machine-readable output. This is protection against accidents, not isolation from the program or an agent with access to the key files. The token is available in program memory and normally inherited by child processes. Existing shell variables win over dotenvx files unless dotenvx's `-o` is specified.

For the examples below, define this optional alias **in the current shell** (no startup file is changed):

```bash
alias rd='dotenvx run --quiet --redact --strict -f ~/.config/secrets/raindrop.env -fk ~/.config/secrets/.env.keys -- opencli raindrop'
```

If `RAINDROP_TOKEN` is already exposed by another mechanism, use `opencli raindrop` instead of `rd`.

## Commands

| Command | Purpose |
| --- | --- |
| `search [query]` | Native search; optional collection, nested collections, saved-date range, exact URL domain, sorting and limit |
| `get <id>` | One bookmark's title, URL, description, note, tags and metadata |
| `collections` | Root and nested collections, parent ids and bookmark counts; repeated ids are deduplicated |
| `tags` | Tag names and counts; `--collection` and case-insensitive substring `--grep` |

Bookmark columns: `id`, `title`, `url`, `excerpt`, `note`, `tags`, `collection_id`, `created`, `updated`, `type`, `important`. Tags stay arrays in JSON. Saved metadata is not a live read of the linked page or its thread.

## Search cookbook

The positional query is passed to the API unchanged. The [official search guide](https://help.raindrop.io/using-search/) and [filter reference](https://help.raindrop.io/filters/) describe its operators. The examples below illustrate supported syntax; they are not claims that every query has a match in your account.

### Words, phrases, exclusion and OR

```bash
rd search 'cli agents'                       # words, normally combined with AND
rd search '"Building CLIs for agents"'        # exact phrase: preserve inner quotes
rd search 'cli -mcp'                         # exclude a word
rd search 'cli agents match:OR'              # either term, using native OR
rd search '"command line" "agent native" match:OR'
```

`match:OR` changes native query combination, including native filters: do not assume SQL-style parentheses or operator precedence. The adapter's `--from`, `--to` and `--domain` are applied separately and remain AND conditions.

### Tags

```bash
rd tags --grep cli                          # discover tag names and counts
rd search '#cli'                            # one tag
rd search '#cli #reference'                  # both tags
rd search '#cli #mcp match:OR'               # either tag
rd search '#cli -#obsolete'                  # exclude a tag
rd search '#"machine learning"'             # a tag containing spaces
rd search 'notag:true'                       # bookmarks without tags
```

Always quote queries containing `#`, spaces or shell metacharacters.

### Search within a field

```bash
rd search 'title:agents'                     # title
rd search 'excerpt:tutorial'                 # description
rd search 'note:review'                      # your own notes
rd search 'link:github'                      # URL substring, not exact hostname
rd search 'info:duckdb'                      # title/description only
```

The service controls native matching and content indexing. Content search requires an indexed saved copy and, for relevant content types, a Pro plan. The adapter does not scrape external pages or implement its own semantic search.

### Exact domains and dates — adapter filters

```bash
rd search --domain github.com --limit 10
rd search --domain x.com,twitter.com --limit 0
rd search --from 2026-01-01 --to 2026-12-31 --domain x.com,twitter.com --limit 0
rd search '#cli' --from 2026-01-01 --domain x.com,twitter.com
rd search --from 2026-04-03 --to 2026-04-03  # one complete UTC day
```

- Dates are **bookmark save dates**, not dates when the linked article or tweet was published. Both ends are inclusive UTC calendar dates; impossible dates and reversed ranges are rejected.
- Domains are exact URL hostnames or their subdomains. `x.com` includes `mobile.x.com`, but not `notx.com`, `x.com.evil.example`, or a URL merely mentioning `x.com` in its path. Comma-separated domains are ORed.
- These filters are checked locally on real API rows, then the limit is applied. With no native query, narrow domains may require many API pages. `--from` permits an early stop with the default newest-first sort.
- Native date operators are also accepted, for example `rd search 'created:2026-04'`, `rd search 'created:>2026-01-01'`, and `rd search 'lastUpdate:2026-04'`. Prefer `--from`/`--to` for explicit inclusive save-date ranges; there is no separate local update-date filter.

### Content types and attributes — native API filters

```bash
rd search 'type:article'
rd search 'type:video #ai'
rd search 'type:document'
rd search 'type:image'
rd search 'type:audio'
rd search 'type:book'
rd search 'cli -type:video'
rd search '❤️'                              # favorites
rd search 'file:true'                       # uploaded files
rd search 'reminder:true'                   # bookmarks with reminders
rd search 'cache.status:ready'              # bookmarks with an archived copy
```

Types and attributes come from Raindrop's classification, not the URL suffix. Library-health filters and content-search features may depend on the account plan; do not interpret an empty result as proof that a feature or subject does not exist.

### Collections

```bash
rd collections                             # use a returned id in the next command
rd search '#cli' --collection 123456        # illustrative collection id
rd search '#cli' --collection 123456 --nested true
rd tags --collection 123456 --grep cli
rd search --collection -1 --limit 10        # Unsorted
rd search --collection -99 --limit 10       # Trash, explicitly requested
```

The default collection is `0`, all bookmarks **except Trash**. `collections` lists user collections; it does not invent system collection rows. `--nested true` includes child collections in a collection search; it is not a flag on the tags endpoint.

### Sorting, paging and output

```bash
rd search 'cli' --sort score --limit 5      # service relevance, requires a query
rd search '#cli' --sort created --limit 10 # oldest saved first
rd search '#cli' --sort title --limit 10
rd search '#cli' --sort=-title --limit 10
rd search --limit 10                       # newest saved first by default
rd search '#cli' --limit 0                 # exhaust pages; can be slow
rd search '#cli' --limit 5 -f table
rd search '#cli' --limit 5 -f csv
rd search '#cli' --limit 5 -f json | jq '.data[] | {title, url}'
```

Other API sort keys: `-sort` (Raindrop order), `domain`, `-domain`, `-created` (default). OpenCLI 2 returns `{"ok":true,"data":[...]}`. `--limit` counts filtered rows, not downloaded rows. Pages are fetched serially, up to 50 records each; there is no automatic rate-limit retry or silent page cap. A failure returns an error instead of partial success. No global result count is invented.

## Verified live

On 2026-11-08 with OpenCLI 2.0.2 and dotenvx 2.38.2:

- All four commands execute successfully through `dotenvx run`; token inheritance works on the real OpenCLI path without restarting a daemon.
- `search --from 2026-01-01 --to 2026-12-31 --domain x.com,twitter.com --limit 0` returned 16 bookmarks, matching an independent API scan. Counts can change as the archive changes.
- `search '"Building CLIs for agents"' --limit 5` returned one bookmark; `get` retrieved the same id and URL. Saved title: “Building CLIs for agents”; public link: https://x.com/ericzakariasson/status/2036762680401223946.
- Native `#cli`, `title:agents` and `cli agents match:OR` searches, inclusive one-day filtering, and Unsorted search with `--nested true` returned results.
- The child-collections endpoint repeated a root collection; deduplication by id produced three unique collections. No personal collection list is published here.
- Missing token: `AUTH_REQUIRED`, exit 77. A deliberately unmatched query: `EMPTY_RESULT`, exit 66. Invalid dates fail before a network request.

## Development checks

```bash
node --test plugins/raindrop/tests/*.test.js
opencli adapter check raindrop
```

Tests use synthetic records and mock fetch, never credentials. The adapter fixes the API origin, refuses redirects, applies a 25-second request timeout, validates payloads, and reports auth, rate-limit, network and malformed-response errors without echoing raw bodies or tokens. A token error is not an empty search.
