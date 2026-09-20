// Shared helpers for the koboyo adapters.
//
// The search of koboyo.com/icons is not a server endpoint. It is a static,
// prefix-sharded JSON index served off the same origin, and the ranking runs in
// the browser. This file is a port of the site's own client
// (`/icons/_astro/IconBrowser.*.js`, read on 2026-09-20): the index is fetched
// as the page fetches it and scored by the same function, so a query here and
// the same query in the search box return the same icons in the same order.
//
// Verified live on 2026-09-20:
//   GET /icons/data/search/v1/_common.json   the stop words (a plain array)
//   GET /icons/data/search/v1/<prefix>.json  {split, truncated, entries} — 2 chars and deeper
//   GET /icons/data/slugmap/v1/<2 chars>.json  slug -> {name, group, subgroup, generality, keywords, style, description}
//   GET /icons/svg/<slug>.svg                the icon itself
import { ArgumentError, CommandExecutionError } from '@jackwener/opencli/errors';

export const BASE = 'https://koboyo.com';
const UA = 'opencli-koboyo/0.1';

// The five drawing styles the site offers. An icon whose `style` field is empty
// is an `original`: that is the site's own default, not a missing value.
export const STYLES = ['original', 'inkbrush', 'blockprint', 'cartoon', 'solid'];

/**
 * An index entry is a positional array, not an object:
 *   [slug, name, keywords, nameTokens, generality, group, subgroup, style]
 */
const SLUG = 0, NAME = 1, KEYWORDS = 2, NAME_TOKENS = 3, WEIGHT = 4, GROUP = 5, SUBGROUP = 6, STYLE = 7;

export function checkStyle(input) {
    const style = String(input ?? '').trim().toLowerCase();
    if (!style) return '';
    if (!STYLES.includes(style)) {
        throw new ArgumentError(`invalid --style "${input}": expected one of ${STYLES.join(', ')}`);
    }
    return style;
}

/** `--group` is a `group/subgroup` pair, e.g. `object/food` or `people/profession`. */
export function checkGroup(input) {
    const group = String(input ?? '').trim().toLowerCase();
    if (!group) return '';
    if (!/^[a-z0-9-]+\/[a-z0-9-]+$/.test(group)) {
        throw new ArgumentError(`invalid --group "${input}": expected group/subgroup, e.g. object/food`);
    }
    return group;
}

export function checkSlug(input) {
    const slug = String(input ?? '').trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
        throw new ArgumentError(`invalid slug "${input}": expected a lowercase slug, e.g. acoustic-guitar`);
    }
    return slug;
}

async function getJson(path, { optional = false } = {}) {
    let res;
    try {
        res = await fetch(`${BASE}${path}`, {
            headers: { accept: 'application/json', 'user-agent': UA },
        });
    } catch (e) {
        throw new CommandExecutionError(`koboyo.com is unreachable: ${e.message}`);
    }
    // A missing shard is a normal outcome of the prefix walk, not a failure: it
    // simply means the index does not split that far.
    if (res.status === 404 && optional) return null;
    if (!res.ok) throw new CommandExecutionError(`koboyo.com answered HTTP ${res.status} for ${path}`);
    try {
        return await res.json();
    } catch {
        throw new CommandExecutionError(`non-JSON response from koboyo.com for ${path}`);
    }
}

/** The stop-word list. Tokens on it match most of the library and cannot select a shard. */
export async function commonWords() {
    const body = await getJson('/icons/data/search/v1/_common.json');
    if (!Array.isArray(body)) {
        throw new CommandExecutionError('the stop-word index is not an array: the index shape changed');
    }
    return new Set(body);
}

/**
 * The shard holding a token, and whether it is capped.
 *
 * The index splits by prefix: `ca.json` declares in `split` which three-letter
 * shards exist below it, those declare four-letter ones, and so on. The site
 * fetches every prefix from 2 to the token's length in parallel and then walks
 * down; walking down sequentially reaches the same shard in about half the
 * requests, because the descent usually stops well before the full token.
 */
export async function shardFor(token) {
    let prefix = token.slice(0, 2);
    let shard = await getJson(`/icons/data/search/v1/${encodeURIComponent(prefix)}.json`, { optional: true });
    if (!shard) return { entries: [], truncated: false, prefix };
    while (shard.split && prefix.length < token.length) {
        const deeper = token.slice(0, prefix.length + 1);
        if (!shard.split.includes(deeper)) break;
        const next = await getJson(`/icons/data/search/v1/${encodeURIComponent(deeper)}.json`, { optional: true });
        if (!next) break;
        prefix = deeper;
        shard = next;
    }
    return {
        entries: Array.isArray(shard.entries) ? shard.entries : [],
        // The shard says so itself when it holds only the top slice of what
        // matches its prefix. The results below are then incomplete, and a
        // caller that is not told cannot know.
        truncated: shard.truncated === true,
        prefix,
    };
}

/**
 * The site's scoring function, ported verbatim.
 *
 * Every token has to score, or the row is out: the semantics are AND. The
 * bonuses at the end apply only when every token matched through the slug or
 * the name, never through the keyword fallback — that is what `viaName` tracks.
 */
export function score(entry, tokens) {
    const nameTokens = String(entry[NAME_TOKENS] ?? '').split(' ');
    const keywords = String(entry[KEYWORDS] ?? '').split(' ');
    const slug = entry[SLUG];
    let total = 0;
    let viaName = true;
    for (const token of tokens) {
        let point = 0;
        if (slug === token) point = 1000;
        else if (nameTokens.includes(token)) point = 120;
        else if (nameTokens.some((t) => t.startsWith(token))) point = 60;
        else {
            viaName = false;
            if (keywords.includes(token)) point = 40;
            else if (keywords.some((k) => k.startsWith(token))) point = 20;
            else if (slug.includes(token) || String(entry[KEYWORDS] ?? '').includes(token)) point = 4;
        }
        if (!point) return 0;
        total += point;
    }
    if (viaName) {
        if (tokens.length > 1 && String(entry[NAME_TOKENS] ?? '').includes(tokens.join(' '))) total += 200;
        if (nameTokens.length === tokens.length) total += 80;
        total += Math.max(0, 40 - (nameTokens.length - tokens.length) * 8);
    }
    return total + (entry[WEIGHT] ?? 0);
}

/** An icon's style, with the site's own convention that an empty field means `original`. */
export function styleOf(entry) {
    return entry[STYLE] || 'original';
}

export function matchesStyle(entry, style) {
    return style ? styleOf(entry) === style : true;
}

export function matchesGroup(entry, group) {
    return group ? `${entry[GROUP]}/${entry[SUBGROUP]}` === group : true;
}

export function iconUrl(slug) {
    return `${BASE}/icons/${slug}`;
}

export function svgUrl(slug) {
    return `${BASE}/icons/svg/${slug}.svg`;
}

/**
 * The same search, on the site. Handing this back is the point of the column:
 * the person who asked can open it and see the icons, which a slug cannot show.
 *
 * `q` is read by the browser page whatever path it sits on, and the two facets
 * of the sidebar are both paths: a drawing style is `/icons/<style>`, a
 * taxonomy branch is `/icons/set/<group>/<subgroup>`, and the two combine as
 * `/icons/set/<group>/<subgroup>/<style>`. Verified in a browser on 2026-09-20
 * on all four shapes.
 */
export function searchPageUrl(query, group, style) {
    let path = '/icons';
    if (group) path = `/icons/set/${group}${style ? `/${style}` : ''}`;
    else if (style) path = `/icons/${style}`;
    return `${BASE}${path}?${new URLSearchParams({ q: query })}`;
}

/**
 * The taxonomy, read from the sidebar of the browse page. There is no JSON
 * index of it: `/icons/data/groups/v1/<group>--<subgroup>.json` answers for a
 * pair you already know, and nothing lists the pairs. The sidebar is rendered
 * on the server, so this needs no browser either.
 */
export async function taxonomy() {
    let res;
    try {
        res = await fetch(`${BASE}/icons`, { headers: { 'user-agent': UA } });
    } catch (e) {
        throw new CommandExecutionError(`koboyo.com is unreachable: ${e.message}`);
    }
    if (!res.ok) throw new CommandExecutionError(`koboyo.com answered HTTP ${res.status} for the browse page`);
    const html = await res.text();
    const rows = [];
    const seen = new Set();
    const link = /<a[^>]+href="\/icons\/set\/([a-z0-9-]+)\/([a-z0-9-]+)"[^>]*>([\s\S]*?)<\/a>/g;
    for (const m of html.matchAll(link)) {
        const [, group, subgroup, inner] = m;
        const key = `${group}/${subgroup}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const count = inner.match(/<em[^>]*>([\d,]+)<\/em>/);
        rows.push({ group, subgroup, count: count ? Number(count[1].replace(/,/g, '')) : null });
    }
    if (rows.length === 0) {
        throw new CommandExecutionError('no taxonomy link found on the browse page: the markup changed');
    }
    return rows;
}

export function rowFromEntry(entry, relevance, page) {
    return {
        slug: entry[SLUG],
        name: entry[NAME],
        group: `${entry[GROUP]}/${entry[SUBGROUP]}`,
        style: styleOf(entry),
        relevance,
        url: iconUrl(entry[SLUG]),
        svg: svgUrl(entry[SLUG]),
        // A property of the query, not of the icon, so it repeats identically
        // down the column. It lives here anyway: the footer renders in `table`
        // format only, and `table` downgrades to yaml in any pipe, so a link
        // put there would be gone in every machine-readable format - which is
        // exactly where a caller passing it on would look for it.
        page,
    };
}

/** Metadata of one slug. The slugmap is sharded on the first two characters. */
export async function slugMeta(slug) {
    const shard = await getJson(`/icons/data/slugmap/v1/${encodeURIComponent(slug.slice(0, 2))}.json`, { optional: true });
    return shard?.[slug] ?? null;
}

export async function fetchSvg(slug) {
    let res;
    try {
        res = await fetch(svgUrl(slug), { headers: { 'user-agent': UA } });
    } catch (e) {
        throw new CommandExecutionError(`koboyo.com is unreachable: ${e.message}`);
    }
    if (!res.ok) throw new CommandExecutionError(`koboyo.com answered HTTP ${res.status} for the SVG of "${slug}"`);
    return (await res.text()).trim();
}
