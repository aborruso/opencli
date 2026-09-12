// Shared helpers for the istatdata adapters.
//
// These commands wrap the AI search form of the ISTAT Data Browser
// (esploradati.istat.it/databrowser/#/it/dw/search?ai=true). The form's own XHR
// is a public endpoint of the Data Browser hub: no authentication, no cookie,
// no browser. The hub is an undocumented product-internal API, so every
// contract below was verified live rather than read from a spec.
//
// Verified live on 2026-09-12:
//   POST .../nodes/1/AI/ExecuteSearch   the search itself
//   GET  .../nodes/1                    the node's own AI settings (13 kB)
//   GET  .../nodes/1/catalog            titles and category paths (1.48 MB, ~2 s)
import { ArgumentError, CommandExecutionError } from '@jackwener/opencli/errors';

export const HUB = 'https://esploradati.istat.it/databrowserhub/api/core';
export const BROWSER_BASE = 'https://esploradati.istat.it/databrowser/';
export const SDMX_BASE = 'https://esploradati.istat.it/SDMXWS/rest/';
export const NODE_CODE = 'dw';
const UA = 'opencli-istatdata/0.1';

// What the node declared on 2026-09-12. Used only if `GET nodes/{node}` is
// unreachable: the payload below is mandatory, so there has to be a fallback.
const RATE_LIMITING_FALLBACK = { limit: 10, seconds: 60, maxMessageLength: 204800 };
const MAX_RESULTS_FALLBACK = 20;

export function checkLang(input) {
    const lang = String(input ?? 'it').toLowerCase();
    if (lang !== 'it' && lang !== 'en') {
        throw new ArgumentError(`invalid --lang "${input}": the node serves it and en only`);
    }
    return lang;
}

/**
 * A dataset id is `agency,id,version`, e.g. IT1,30_1008_DF_MEF_REDDITIIRPEF_COM_2,1.0
 */
export function splitId(datasetId) {
    const parts = String(datasetId ?? '').split(',');
    return parts.length === 3 ? parts : null;
}

export function checkDatasetId(input) {
    const id = String(input ?? '').trim();
    if (!splitId(id)) {
        throw new ArgumentError(`invalid dataset id "${input}". Expected agency,id,version, e.g. IT1,41_287_DF_DCIS_INDINCIDENT_1,1.0`);
    }
    return id;
}

/**
 * The hub answers HTTP 200 even when it fails, with `{"errorCode": ..., "message": ...}`
 * in the body. Checking `res.ok` alone is not enough: the caller would then read
 * an absent `chatContext` and report zero results for a request that never ran.
 */
async function hubFetch(url, init = {}, what = 'the hub') {
    let res;
    try {
        res = await fetch(url, {
            ...init,
            headers: { accept: 'application/json', 'user-agent': UA, ...(init.headers ?? {}) },
        });
    } catch (e) {
        throw new CommandExecutionError(`${what} is unreachable: ${e.message}`);
    }
    if (res.status === 429) {
        throw new CommandExecutionError('the node refused the request for rate limiting (HTTP 429). It declares 10 requests every 60 seconds: ask serially');
    }
    if (!res.ok) throw new CommandExecutionError(`${what} answered HTTP ${res.status}`);
    let body;
    try {
        body = await res.json();
    } catch {
        throw new CommandExecutionError(`non-JSON response from ${what}`);
    }
    if (body && body.errorCode) {
        const detail = body.message ? `: ${body.message}` : '';
        if (/rate|limit/i.test(body.errorCode)) {
            throw new CommandExecutionError(`the node refused the request for rate limiting (${body.errorCode}${detail}). It declares 10 requests every 60 seconds: ask serially`);
        }
        throw new CommandExecutionError(`the hub rejected the request with ${body.errorCode}${detail} (HTTP ${res.status}, the hub reports its errors in the body)`);
    }
    return body;
}

/**
 * The node's own AI settings. `aiRateLimiting` is mandatory in the search
 * payload and simply echoes the node's `AIRateLimiting` extra: reading it here
 * costs 13 kB and cannot drift, hardcoding it would drift silently.
 */
export async function nodeSettings(node, lang) {
    let extras;
    try {
        const body = await hubFetch(`${HUB}/nodes/${encodeURIComponent(node)}`, {
            headers: { UserLang: lang },
        }, `node ${node}`);
        extras = body?.extras;
    } catch {
        return { rateLimiting: RATE_LIMITING_FALLBACK, maxResults: MAX_RESULTS_FALLBACK, fromNode: false };
    }
    const get = (key) => (Array.isArray(extras) ? extras.find((e) => e?.key === key)?.value : undefined);
    let rateLimiting = RATE_LIMITING_FALLBACK;
    try {
        const raw = get('AIRateLimiting');
        if (raw) rateLimiting = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch { /* keep the fallback: a malformed extra must not block the search */ }
    const declared = Number(get('AISearchMaxResults'));
    return {
        rateLimiting,
        maxResults: Number.isInteger(declared) && declared > 0 ? declared : MAX_RESULTS_FALLBACK,
        fromNode: true,
    };
}

/**
 * The one call the search form makes. `UserLang` is the language switch, not
 * `Accept-Language`: without it descriptions come back in English and both
 * `title` and `ai_title` come back empty.
 */
export async function executeSearch({ node, lang, request, sessionId, maxResults, rateLimiting }) {
    const body = await hubFetch(`${HUB}/nodes/${encodeURIComponent(node)}/AI/ExecuteSearch`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', UserLang: lang },
        body: JSON.stringify({
            session_id: sessionId ?? null,
            request,
            aiSearchMaxResults: maxResults,
            aiRateLimiting: rateLimiting,
            action: { type: 'query' },
        }),
    }, 'the AI search endpoint');
    // No errorCode and still no chatContext means the shape changed under us.
    // Saying so is better than printing an empty table.
    if (!body || typeof body !== 'object' || !body.chatContext) {
        throw new CommandExecutionError('the AI search endpoint answered without a chatContext: the response shape changed');
    }
    return body;
}

export async function fetchCatalog(node, lang) {
    const body = await hubFetch(`${HUB}/nodes/${encodeURIComponent(node)}/catalog`, {
        headers: { UserLang: lang },
    }, 'the node catalog');
    if (!body?.datasetMap) {
        throw new CommandExecutionError('the node catalog answered without a datasetMap: the response shape changed');
    }
    return body;
}

/**
 * Map dataset id -> {title, categoryIds, categoryLabels, ...}.
 *
 * `categoryIds` is the path the Data Browser deep link needs: the category
 * group id first, then the chain of category ids down to the leaf.
 */
export function buildIndex(catalog) {
    const index = new Map();
    const entry = (id) => {
        if (!index.has(id)) index.set(id, { categoryIds: [], categoryLabels: [] });
        return index.get(id);
    };

    const walk = (categories, idPath, labelPath) => {
        for (const cat of categories ?? []) {
            const ids = [...idPath, cat.id];
            const labels = [...labelPath, cat.label || cat.id];
            for (const datasetId of cat.datasetIdentifiers ?? []) {
                const e = entry(datasetId);
                // First path wins: a dataset listed under several categories
                // still gets one deep link, and it is a working one.
                if (e.categoryIds.length === 0) {
                    e.categoryIds = ids;
                    e.categoryLabels = labels;
                }
            }
            walk(cat.childrenCategories, ids, labels);
        }
    };

    for (const group of catalog.categoryGroups ?? []) {
        walk(group.categories, [group.id], [group.label || group.id]);
    }
    for (const [datasetId, meta] of Object.entries(catalog.datasetMap ?? {})) {
        const e = entry(datasetId);
        e.title = meta?.title || '';
        e.referenceMetadata = meta?.referenceMetadata || '';
        e.datasetType = meta?.datasetType || '';
    }
    return index;
}

/**
 * Deep link to the table inside the Data Browser. The category path is
 * required: without it the app answers "the requested page is not available".
 */
export function tableUrl(datasetId, categoryIds, lang) {
    if (!categoryIds?.length) return null;
    return `${BROWSER_BASE}#/${lang}/${NODE_CODE}/categories/${[...categoryIds, datasetId].join('/')}`;
}

/** Structure and SDMX-CSV data URLs on the ISTAT SDMX web service. */
export function sdmxUrls(datasetId) {
    const ref = splitId(datasetId);
    if (!ref) return { structure: null, data: null };
    const [agency, flow, version] = ref;
    return {
        structure: `${SDMX_BASE}dataflow/${encodeURIComponent(agency)}/${encodeURIComponent(flow)}/${encodeURIComponent(version)}?references=all`,
        data: `${SDMX_BASE}data/${datasetId}/?format=csv`,
    };
}

export function categoryPath(labels) {
    return labels?.length ? labels.join(' > ') : null;
}
