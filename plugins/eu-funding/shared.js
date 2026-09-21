// Shared helpers for the eu-funding adapters.
//
// These commands wrap the public REST APIs of the EU Funding & Tenders Portal,
// documented at
// https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/support/apis
// Two endpoints of the Commission's corporate search, no login, no browser:
//
//   POST search-api/prod/rest/search?apiKey=<KEY>&text=<TEXT>&pageSize=&pageNumber=
//   POST search-api/prod/rest/facet?apiKey=<KEY>&text=<TEXT>
//   GET  search-api/prod/rest/document/<PIC>?apiKey=SEDIA_PERSON
//
// The body is multipart: `query` (an Elasticsearch-style bool query), `languages`
// and `sort`, each part typed application/json. The apiKey is not a secret: it
// names the index. Verified live on 2026-09-21.
import { ArgumentError, CommandExecutionError } from '@jackwener/opencli/errors';

export const API = 'https://api.tech.ec.europa.eu/search-api/prod/rest';
export const PORTAL = 'https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen';

// One key per family of data. SEDIA_NONH2020_PROD is not written on the doc
// page: it is what the portal's own projects page calls.
export const KEYS = {
    calls: 'SEDIA',
    faqs: 'SEDIA_FAQ',
    partners: 'SEDIA_PERSON',
    projects: 'SEDIA_NONH2020_PROD',
};

// The server caps pageSize at 100 whatever is asked (500 and 1000 both come
// back as 100, and the response echoes `pageSize: 100`).
export const PAGE_MAX = 100;

// The status codes of calls and tenders. The facet API is the authority, and
// it says 31094501 is Forthcoming, not Open: the doc page's own sample titled
// "only open tenders" asks for 501+502 and so gets forthcoming ones too.
export const CALL_STATUS = {
    forthcoming: '31094501',
    open: '31094502',
    closed: '31094503',
};

// `type` is scoped to the index. These are the SEDIA values; the same field
// means something else under SEDIA_FAQ and SEDIA_PERSON, so there is no
// shared map on purpose.
export const CALL_TYPE = {
    tender: '0',
    grant: '1',
    proposals: '2',
    cascade: '8',
};
export const CALL_TYPE_LABEL = { 0: 'tender', 1: 'grant', 2: 'proposals', 8: 'cascade' };
export const UPDATE_TYPE = '6';

// SEDIA_FAQ's own vocabulary. The doc's "full FAQ list" asks for 0 and 1
// only, which is 1,697 records out of ~61,000. The facet API leaves 2 and 3
// unlabelled, but they are FAQs too, and they are 97% of the index: 2 is the
// Q&A of a single tender (with its `procedureId`), 3 the Q&A of a single call
// topic (checked 2026-09-21).
export const FAQ_TYPE = { tenders: '0', grants: '1', 'tender-qa': '2', 'topic-qa': '3' };
export const FAQ_STATUS = { active: '0', archived: '1' };

const TIMEOUT_MS = 90_000;

/** Every metadata value comes back as an array, even when it holds one scalar. */
export function first(v) {
    if (Array.isArray(v)) return v.length ? first(v[0]) : '';
    return v ?? '';
}

export function all(v) {
    if (!Array.isArray(v)) return v == null ? '' : String(v);
    return [...new Set(v.map(String).filter((s) => s !== ''))].join('; ');
}

/** `2027-04-06T00:00:00.000+0000` → `2027-04-06`. The FAQ index writes epoch milliseconds instead. */
export function day(v) {
    const s = String(first(v));
    if (/^\d{12,13}$/.test(s)) return new Date(Number(s)).toISOString().slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : s;
}

/** Strip HTML tags and collapse whitespace: answers and descriptions are HTML. */
export function text(v) {
    return String(first(v))
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(p|li|div|h\d)>/gi, '\n')
        // Quote-aware: the portal writes attributes such as class="eui-u-mt-l>",
        // with a '>' inside the quotes, and a plain <[^>]+> would stop there.
        .replace(/<(?:[^>"']|"[^"]*"|'[^']*')*>/g, '')
        .replace(/\uFEFF/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/[ \t]+/g, ' ')
        .replace(/\n\s*\n+/g, '\n')
        .trim();
}

/** Some metadata fields hold a JSON document serialised as a string. */
export function parseJson(v) {
    const s = first(v);
    if (typeof s !== 'string' || !s) return null;
    try {
        return JSON.parse(s);
    } catch {
        return null;
    }
}

/** Split a comma-separated option into trimmed, lower-cased values. */
export function list(v) {
    return String(v ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
}

/** Map names to codes through a vocabulary, refusing anything unknown. */
export function codes(option, input, vocabulary) {
    return list(input).map((name) => {
        if (!(name in vocabulary)) {
            throw new ArgumentError(`invalid ${option} "${name}": use ${Object.keys(vocabulary).join(', ')}`);
        }
        return vocabulary[name];
    });
}

export function checkLimit(v) {
    const n = Number(v);
    if (!Number.isInteger(n) || n < 1) throw new ArgumentError('limit must be an integer >= 1');
    return n;
}

/** `--query` is the raw bool query, as the doc suggests copying it from the portal. */
export function rawQuery(v) {
    const s = String(v ?? '').trim();
    if (!s) return null;
    let q;
    try {
        q = JSON.parse(s);
    } catch (e) {
        throw new ArgumentError(`--query is not valid JSON: ${e.message}`);
    }
    if (!q || typeof q !== 'object' || Array.isArray(q)) {
        throw new ArgumentError('--query must be a JSON object, e.g. {"bool":{"must":[{"terms":{"type":["1"]}}]}}');
    }
    return q;
}

/**
 * Build a bool query out of a list of clauses, merged with the raw `--query`
 * when there is one: its `must` clauses are added to ours, anything else in it
 * (`should`, `must_not`, `filter`) is kept as given.
 */
export function boolQuery(clauses, raw) {
    const must = clauses.filter(Boolean);
    if (!raw) return must.length ? { bool: { must } } : null;
    if (!raw.bool) return must.length ? { bool: { must: [...must, raw] } } : raw;
    const rawMust = Array.isArray(raw.bool.must) ? raw.bool.must : raw.bool.must ? [raw.bool.must] : [];
    return { bool: { ...raw.bool, must: [...must, ...rawMust] } };
}

export function terms(field, values) {
    return values && values.length ? { terms: { [field]: values } } : null;
}

/**
 * The free-text part of the URL. `***` is the API's own "match everything".
 * A phrase in double quotes is an exact match, as `topic` uses it.
 */
function textParam(t) {
    const s = String(t ?? '').trim();
    return encodeURIComponent(s || '***');
}

function form({ query, languages, sort }) {
    const fd = new FormData();
    const part = (name, value) => fd.append(name, new Blob([JSON.stringify(value)], { type: 'application/json' }), 'blob');
    if (query) part('query', query);
    // Without `languages` every record comes back once per translation.
    part('languages', languages ?? ['en']);
    if (sort) part('sort', sort);
    return fd;
}

async function call(url, init, what) {
    let res;
    try {
        res = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch (e) {
        const why = e.name === 'TimeoutError' ? `no answer in ${TIMEOUT_MS / 1000} s` : e.message;
        throw new CommandExecutionError(`${what} is unreachable: ${why}`);
    }
    if (!res.ok) {
        const body = await res.text().catch(() => '');
        // An unknown document id is not a failure of the service: it answers
        // 400 with {"type":"businessError","message":"No result found"}.
        if (res.status === 400 && /"No result found"/.test(body)) return null;
        throw new CommandExecutionError(`${what} answered HTTP ${res.status}${body ? `: ${body.slice(0, 200)}` : ''}`);
    }
    try {
        return await res.json();
    } catch {
        throw new CommandExecutionError(`non-JSON response from ${what}`);
    }
}

/** One page of the search API. */
export async function searchPage({ key, text: t, query, sort, languages, pageSize = PAGE_MAX, pageNumber = 1 }) {
    const url = `${API}/search?apiKey=${key}&text=${textParam(t)}&pageSize=${pageSize}&pageNumber=${pageNumber}`;
    const body = await call(url, { method: 'POST', body: form({ query, languages, sort }) }, `the search API (${key})`);
    if (!Array.isArray(body.results)) {
        throw new CommandExecutionError(`the search API (${key}) answered without a results list`);
    }
    return body;
}

/**
 * As many results as `limit` asks, paging over the server's cap of 100.
 * Returns the results and the total the server reports for the whole query.
 */
export async function search({ limit, ...opts }) {
    const results = [];
    let total = 0;
    for (let page = 1; results.length < limit; page++) {
        const pageSize = Math.min(PAGE_MAX, limit);
        const body = await searchPage({ ...opts, pageSize, pageNumber: page });
        total = Number(body.totalResults ?? 0);
        results.push(...body.results);
        if (body.results.length < pageSize || results.length >= total) break;
    }
    return { results: results.slice(0, limit), total };
}

/** The facet API: every filterable field of an index, with each code's label and count. */
export async function facets({ key, text: t, query, languages }) {
    const url = `${API}/facet?apiKey=${key}&text=${textParam(t)}`;
    const body = await call(url, { method: 'POST', body: form({ query, languages }) }, `the facet API (${key})`);
    if (!Array.isArray(body.facets)) {
        throw new CommandExecutionError(`the facet API (${key}) answered without a facets list`);
    }
    return body.facets;
}

/** GET a single document by id (the organisation service); null when there is none. */
export async function document(id, key) {
    return call(`${API}/document/${encodeURIComponent(id)}?apiKey=${key}`, { method: 'GET' }, `the document API (${key})`);
}

/**
 * Resolve `--programme` to codes. A value that is all digits is taken as a
 * code already; anything else is matched, case-insensitively, against the
 * labels the facet API gives for `field` (e.g. "horizon europe" →
 * 43108390). Costs one facet call, about 15 s on SEDIA.
 */
export async function programmeCodes(input, key, field) {
    const wanted = String(input ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    if (!wanted.length) return [];
    if (wanted.every((w) => /^\d+$/.test(w))) return wanted;
    const facet = (await facets({ key })).filter((f) => f.name === field).flatMap((f) => f.values);
    const out = [];
    for (const w of wanted) {
        if (/^\d+$/.test(w)) {
            out.push(w);
            continue;
        }
        const needle = w.toLowerCase();
        const hits = facet.filter((v) => String(v.value).toLowerCase().includes(needle));
        if (!hits.length) {
            throw new ArgumentError(`no programme matches "${w}". List them with: opencli eu-funding codes ${field} --index ${Object.keys(KEYS).find((k) => KEYS[k] === key)}`);
        }
        out.push(...hits.map((v) => String(v.rawValue)));
    }
    return [...new Set(out)];
}

/**
 * A facet label as a person reads it. The FAQ categories come as
 * `Proposal submission %26 evaluation;1`: URL-encoded, with the FAQ type
 * appended after a semicolon.
 */
export function cleanLabel(v) {
    let s = String(v);
    try {
        s = decodeURIComponent(s);
    } catch {
        // not encoded
    }
    return s.replace(/;\d+$/, '');
}

/** Labels of every field of a facet list, as field → Map raw code → label. */
export function labelMaps(facetList) {
    const out = new Map();
    for (const f of facetList) {
        const m = out.get(f.name) ?? new Map();
        for (const v of f.values ?? []) m.set(String(v.rawValue), cleanLabel(v.value));
        out.set(f.name, m);
    }
    return out;
}

/** Codes → labels, deduplicated, joined. Unknown codes are kept as they are. */
export function decode(values, map) {
    const arr = Array.isArray(values) ? values : values == null ? [] : [values];
    return [...new Set(arr.map((c) => (map?.get(String(c)) ?? String(c))).filter(Boolean))].join('; ');
}

/** Labels of one facet field, as a Map raw code → label. */
export async function labels(key, field, query) {
    const facet = (await facets({ key, query })).filter((f) => f.name === field).flatMap((f) => f.values);
    return new Map(facet.map((v) => [String(v.rawValue), cleanLabel(v.value)]));
}
