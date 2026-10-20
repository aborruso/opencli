// Shared helpers for the aster adapters.
//
// aster.istat.it (ISTAT Statistical Atlas of the Territory) runs the same Data
// Browser product as IstatData, with its own hub. The hub is public: no
// authentication, no cookie, no browser. It is an undocumented product-internal
// API, so every contract below was verified live rather than read from a spec.
//
// Verified live on 2026-10-20:
//   GET  .../nodes                       the atlases, one node each
//   GET  .../nodes/{n}/catalog           titles and category paths
//   GET  .../nodes/{n}/datasets/{id}/structure
//   POST .../nodes/{n}/datasets/{id}/data   JSON-stat
//
// The hub declares no rate limit. The commands call it serially, never in
// parallel.
import { ArgumentError, CommandExecutionError } from '@jackwener/opencli/errors';

export const HUB = 'https://aster.istat.it/api/core';
export const BROWSER_BASE = 'https://aster.istat.it/';
export const DEFAULT_ATLAS = 'AST';
const UA = 'opencli-aster/0.1';

export function checkLang(input) {
    const lang = String(input ?? 'it').toLowerCase();
    if (lang !== 'it' && lang !== 'en') {
        throw new ArgumentError(`invalid --lang "${input}": the hub serves it and en only`);
    }
    return lang;
}

/**
 * The hub answers HTTP 200 even when it fails, with `{"errorCode": ..., "message": ...}`
 * in the body, so `res.ok` alone is not enough.
 *
 * `UserLang` is the language switch, not `Accept-Language`: without it the hub
 * answers in English, so it is always sent.
 */
export async function hubFetch(path, { lang, ...init } = {}, what = 'the aster hub') {
    let res;
    try {
        res = await fetch(`${HUB}/${path}`, {
            ...init,
            headers: { accept: 'application/json', 'user-agent': UA, UserLang: lang, ...(init.headers ?? {}) },
        });
    } catch (e) {
        throw new CommandExecutionError(`${what} is unreachable: ${e.message}${e.cause?.code ? ` (${e.cause.code})` : ''}`);
    }
    if (res.status === 429) {
        throw new CommandExecutionError('the aster hub refused the request for rate limiting (HTTP 429): retry later, serially');
    }
    if (!res.ok) throw new CommandExecutionError(`${what} answered HTTP ${res.status}`);
    // 206 is the data endpoint cutting the answer at its cell limit (500,000
    // values on 2026-10-20). Returning it would print a truncated table as if
    // it were whole.
    if (res.status === 206) {
        throw new CommandExecutionError(`${what} answered HTTP 206: the hub truncated the result at its size limit`);
    }
    // 204 with an empty body is how the data endpoint says "no observation"
    // for a filter that matches nothing (a municipality without data, say).
    if (res.status === 204) return null;
    let body;
    try {
        body = await res.json();
    } catch {
        throw new CommandExecutionError(`non-JSON response from ${what}`);
    }
    if (body && body.errorCode) {
        const detail = body.message ? `: ${body.message}` : '';
        throw new CommandExecutionError(`the aster hub rejected the request with ${body.errorCode}${detail} (HTTP ${res.status}, the hub reports its errors in the body)`);
    }
    return body;
}

export async function fetchAtlases(lang) {
    const body = await hubFetch('nodes', { lang }, 'the atlas list');
    if (!Array.isArray(body)) {
        throw new CommandExecutionError('the atlas list is not an array: the response shape changed');
    }
    return body;
}

/**
 * `--atlas` takes the node code (AST, ATLANTE_COMUNI, ...) in any case, or the
 * numeric node id. An unknown value is a bad argument: the list is short, so
 * the error spells it out.
 */
export async function resolveAtlas(input, lang) {
    const atlases = await fetchAtlases(lang);
    const wanted = String(input ?? DEFAULT_ATLAS).trim();
    const atlas = /^\d+$/.test(wanted)
        ? atlases.find((a) => a.nodeId === Number(wanted))
        : atlases.find((a) => String(a.code).toUpperCase() === wanted.toUpperCase());
    if (!atlas) {
        const known = atlases.map((a) => `${a.code} (${a.nodeId})`).join(', ');
        throw new ArgumentError(`unknown atlas "${input}". Known atlases: ${known}`);
    }
    return atlas;
}

export async function fetchCatalog(nodeId, lang) {
    const body = await hubFetch(`nodes/${nodeId}/catalog`, { lang }, `the catalog of node ${nodeId}`);
    if (!body?.datasetMap) {
        throw new CommandExecutionError('the atlas catalog answered without a datasetMap: the response shape changed');
    }
    return body;
}

/**
 * Map dataset id -> {title, categoryLabels}.
 */
export function buildIndex(catalog) {
    const index = new Map();
    const entry = (id) => {
        if (!index.has(id)) index.set(id, { categoryLabels: [] });
        return index.get(id);
    };

    const walk = (categories, labelPath) => {
        for (const cat of categories ?? []) {
            const labels = [...labelPath, cat.label || cat.id];
            for (const datasetId of cat.datasetIdentifiers ?? []) {
                const e = entry(datasetId);
                // First path wins: a dataset listed under several themes
                // shows one of them.
                if (e.categoryLabels.length === 0) e.categoryLabels = labels;
            }
            walk(cat.childrenCategories, labels);
        }
    };

    // The group label is the name of the theme tree, the same for every
    // dataset of the atlas: it is left out of the path.
    for (const group of catalog.categoryGroups ?? []) walk(group.categories, []);
    for (const [datasetId, meta] of Object.entries(catalog.datasetMap ?? {})) {
        entry(datasetId).title = meta?.title || '';
    }
    return index;
}

/**
 * Link to the table in the atlas web app. The short form `#/{lang}/{atlas}/{id}`
 * opens the table (verified 2026-10-20) and needs no theme path. The
 * IstatData form with the category group id first does not work here: the
 * app answers "the requested page is not available".
 */
export function tableUrl(atlasCode, datasetId, lang) {
    return `${BROWSER_BASE}#/${lang}/${String(atlasCode).toLowerCase()}/${datasetId}`;
}

export function categoryPath(labels) {
    return labels?.length ? labels.join(' > ') : null;
}

/**
 * A dataset id is `agency,id,version`, e.g. IT1,26_29,1.0
 */
export function checkDatasetId(input) {
    const id = String(input ?? '').trim();
    if (id.split(',').length !== 3) {
        throw new ArgumentError(`invalid dataset id "${input}". Expected agency,id,version, e.g. IT1,26_29,1.0: list them with opencli aster datasets`);
    }
    return id;
}

/**
 * The hub answers an unknown dataset id with HTTP 500 and a generic message,
 * the same it would give for a real failure: the error says both.
 */
export async function fetchStructure(nodeId, atlasCode, datasetId, lang) {
    let body;
    try {
        body = await hubFetch(`nodes/${nodeId}/datasets/${datasetId}/structure`, { lang }, `the structure of ${datasetId}`);
    } catch (e) {
        if (e instanceof CommandExecutionError && /HTTP 500/.test(e.message)) {
            throw new CommandExecutionError(`${e.message}. The hub answers 500 also for a dataset id that is not in the atlas: check it with opencli aster datasets --atlas ${atlasCode}`);
        }
        throw e;
    }
    if (!Array.isArray(body?.criteria)) {
        throw new CommandExecutionError('the dataset structure answered without criteria: the response shape changed');
    }
    return body;
}

/**
 * Values of one dimension that have data (`partial`; `full` is the whole
 * codelist). An unknown dimension answers `{}`, so the caller checks the
 * dimension against the structure first. Territories come with `parentId`;
 * the time dimension comes as two rows, start and end of the period covered.
 */
export async function fetchValues(nodeId, datasetId, dimension, lang) {
    const body = await hubFetch(
        `nodes/${nodeId}/datasets/${datasetId}/column/${encodeURIComponent(dimension)}/partial/values`,
        { lang }, `the values of ${dimension}`,
    );
    const crit = body?.criteria?.find((c) => c?.id === dimension);
    if (!Array.isArray(crit?.values)) {
        throw new CommandExecutionError(`the hub answered without values for ${dimension}: the response shape changed`);
    }
    return crit.values;
}

/**
 * The data query: a JSON array with one filter per dimension, answered with
 * JSON-stat. An empty `filterValues` selects nothing, so a dimension meant to
 * take every value is left out of the array.
 */
export async function fetchData(nodeId, datasetId, filters, lang) {
    let body;
    try {
        body = await hubFetch(`nodes/${nodeId}/datasets/${datasetId}/data`, {
            lang,
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(filters),
        }, `the data of ${datasetId}`);
    } catch (e) {
        if (e instanceof CommandExecutionError && /HTTP 206/.test(e.message)) {
            throw new CommandExecutionError(`${e.message}. Narrow it with --filter, --last or --from/--to`);
        }
        throw e;
    }
    if (body === null) return { id: [], size: [], value: {} };
    if (typeof body !== 'object' || !('size' in body)) {
        throw new CommandExecutionError('the data endpoint answered without JSON-stat: the response shape changed');
    }
    return body;
}

/**
 * JSON-stat dataset -> one row per observation: for each dimension its code
 * and its label, then the value. `value` comes as a sparse object keyed by
 * the row-major position; missing cells are not rows.
 */
export function flattenJsonStat(js) {
    const ids = js.id ?? [];
    const sizes = js.size ?? [];
    const dims = ids.map((id) => {
        const cat = js.dimension?.[id]?.category ?? {};
        const index = Array.isArray(cat.index)
            ? cat.index
            : Object.entries(cat.index ?? {}).sort((a, b) => a[1] - b[1]).map(([code]) => code);
        return { id, key: id.toLowerCase(), codes: index, labels: cat.label ?? {} };
    });
    const values = Array.isArray(js.value)
        ? js.value.map((v, i) => [i, v])
        : Object.entries(js.value ?? {}).map(([k, v]) => [Number(k), v]).sort((a, b) => a[0] - b[0]);

    const rows = [];
    for (const [pos, value] of values) {
        if (value === null || value === undefined) continue;
        const row = {};
        let rest = pos;
        const at = new Array(ids.length);
        for (let d = ids.length - 1; d >= 0; d--) {
            at[d] = rest % sizes[d];
            rest = Math.floor(rest / sizes[d]);
        }
        dims.forEach((dim, d) => {
            const code = dim.codes[at[d]];
            row[dim.key] = code ?? null;
            row[`${dim.key}_label`] = dim.labels[code] ?? null;
        });
        row.value = value;
        rows.push(row);
    }
    return rows;
}
