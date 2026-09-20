# koboyo — OpenCLI adapter

Two commands over [Koboyo Icons](https://koboyo.com/icons), 261,740 free hand-drawn SVG icons. No key, no auth, no browser: both go through the local daemon.

The search box on the site needs JavaScript and produces no URL of its own, so there is nothing to curl and nothing to link to. What there is, is a **static, prefix-sharded JSON index** on the same origin and a scoring function that runs in the page. This adapter fetches the one and applies the other, so a query here returns the same icons, in the same order, as the same query typed into the box.

```bash
opencli plugin install github:aborruso/opencli/koboyo   # from the published repo
opencli plugin install "file://$PWD"                    # from a local clone
opencli validate koboyo             # expected: PASS, 2 commands
```

| Command | What it does | Browser |
|---|---|---|
| `search <query>` | the site search; `--style`, `--group`, `--limit` | no |
| `get <slug>` | name, taxonomy, keywords, description and URLs of one icon; `--svg` adds the markup | no |
| `groups` | the taxonomy `--group` accepts: 5 groups, 111 subgroups, with counts | no |

## Examples

```console
$ opencli koboyo search "dog run" --limit 3 -f plain
slug: dog-running
name: Dog running
group: object/animal
style: original
relevance: 508
url: https://koboyo.com/icons/dog-running
svg: https://koboyo.com/icons/svg/dog-running.svg
page: https://koboyo.com/icons?q=dog+run
...
```

```bash
opencli koboyo search "coffee mug" --style cartoon --limit 5
opencli koboyo search guitar --group object/entertainment
opencli koboyo groups --group people            # which branches exist under people
opencli koboyo get acoustic-guitar-folk
curl -s "$(opencli koboyo search "abacus" --limit 1 -f json | jq -r '.[0].svg')" -o abacus.svg
```

## What the columns are

- **`relevance`** is the site's own score, not an invention: exact slug 1000, a word of the name 120, a prefix of one 60, a keyword 40, a prefix of one 20, a bare substring 4, plus phrase and tightness bonuses and the icon's own base weight. **Every word has to score, or the icon is out** — the terms are ANDed, so fewer words find more.
- **`group`** is a `group/subgroup` pair, the second facet of the sidebar. The five groups are `face`, `mark`, `object`, `people` and `scene`; the 111 pairs under them are a controlled vocabulary nothing publishes as data, which is what `opencli koboyo groups` is for.
- **`style`** is one of `original`, `inkbrush`, `blockprint`, `cartoon`, `solid`. The index leaves the field empty for `original`; that is the site's default, not a missing value.
- **`page`** is the same search on the site, ready to hand to a person: a slug cannot show what an icon looks like, a page can. It repeats identically down the column because it belongs to the query rather than to the icon — it is here and not in the footer because the footer renders in `table` format only, and `table` downgrades to yaml in any pipe, which is exactly where a caller passing the link on would look for it. Both sidebar facets have a page of their own, they combine, and all of them carry the query: `/icons/inkbrush?q=`, `/icons/set/object/animal?q=`, `/icons/set/object/animal/inkbrush?q=`.

## Traps worth knowing

- **Names and keywords are English only.** An Italian query returns nothing, and the zero-result message says so rather than leaving a dead end.
- **The index shard can be capped.** A prefix that matches a lot of the library is served as a top slice, not in full, and says so with `truncated`. The footer then warns that rarer matches may be missing. It renders in `table` format only.
- **Words that are on most of the library cannot search.** `hand`, `person`, `cartoon`, `data` and about a hundred others are stop words: they select nothing. The site quietly falls back to the featured list in that case; this command refuses instead, because a featured list printed under a search that never ran is a wrong answer that looks like a right one. Same for words shorter than two characters, which is what the index is keyed on.

## No sitemap, and why

Same reason as `istatdata`, only stronger: the search page is the single page worth driving, and this adapter reproduces it exactly, ranking included. A navigation graph would describe a path nobody has a reason to walk.

## Koboyo already ships an MCP server

The site offers one, behind an account and an API key. This adapter exists beside it for the reason the rest of this repository exists: no key, no browser, and output that pipes into `jq`, `curl` and a shell script.

## Licence

[The icons are free](https://koboyo.com/icons/license) for personal and commercial use, with no attribution required. What the licence forbids is redistributing the library, or bundling it into an app where the icons are the feature and users pick and download them. This adapter does neither, and cannot: every command here is `access: read`, it returns URLs and metadata, prints markup to stdout only when asked, writes no file and caches nothing. A link back to <https://koboyo.com/icons> is never required and always appreciated.
