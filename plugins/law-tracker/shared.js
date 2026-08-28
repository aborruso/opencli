// Shared helpers for the law-tracker adapters (public JSON API, no auth).
// Contract verified live on 2026-08-28; see ~/.opencli/sites/law-tracker/endpoints.json.
import { CommandExecutionError, ArgumentError } from '@jackwener/opencli/errors';

export const BASE = 'https://law-tracker.europa.eu';
const UA = 'opencli-law-tracker/0.1';

/** `lang` is mandatory on every endpoint: injected here so no caller can omit it. */
export async function apiGet(path, params = {}, lang = 'en') {
    const url = new URL(path, BASE);
    for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }
    url.searchParams.set('lang', lang);
    return request(url, { method: 'GET' });
}

export async function apiPost(path, body, lang = 'en') {
    const url = new URL(path, BASE);
    url.searchParams.set('lang', lang);
    return request(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
    });
}

async function request(url, init) {
    let res;
    try {
        res = await fetch(url, { ...init, headers: { accept: 'application/json', 'user-agent': UA, ...(init.headers ?? {}) } });
    } catch (e) {
        throw new CommandExecutionError(`law-tracker is unreachable: ${e.message}`);
    }
    if (res.status === 400) {
        // The backend answers 400 for an unknown or malformed reference too.
        throw new ArgumentError('parameter rejected by the backend (HTTP 400): check the reference, codes or filters');
    }
    if (!res.ok) throw new CommandExecutionError(`law-tracker answered HTTP ${res.status}`);
    try {
        return await res.json();
    } catch {
        throw new CommandExecutionError('non-JSON response from the backend');
    }
}

/** Titles from /search come back with <em> highlight markup: strip it. */
export function stripHighlight(s) {
    return typeof s === 'string' ? s.replace(/<\/?em>/g, '').replace(/\s+/g, ' ').trim() : s;
}

/**
 * A reference has two spellings: display `2021/0106(COD)` and API `2021_106`
 * (leading zeros of the number dropped). Both are accepted here.
 */
export function toApiRef(input) {
    const raw = String(input ?? '').trim();
    let m = raw.match(/^(\d{4})_(\d+)$/);
    if (m) return `${m[1]}_${String(Number(m[2]))}`;
    m = raw.match(/^(\d{4})\/(\d+)(?:\([A-Z]+\))?$/);
    if (m) return `${m[1]}_${String(Number(m[2]))}`;
    throw new ArgumentError(`invalid reference: "${raw}". Expected 2021/0106(COD) or 2021_106`);
}

export function procedureUrl(apiRef, lang = 'en') {
    return `${BASE}/procedure/${apiRef}?lang=${lang}`;
}

/**
 * Procedure URL from a reference returned by the backend.
 * Does not throw: a row with an unexpected reference form loses its url
 * instead of bringing the whole listing down.
 */
export function procedureUrlFor(reference, lang = 'en') {
    try {
        return procedureUrl(toApiRef(reference), lang);
    } catch {
        return null;
    }
}

export function parseIntArg(value, name, { min = 0, max = Infinity } = {}) {
    const n = Number(value);
    if (!Number.isInteger(n)) throw new ArgumentError(`${name} must be an integer`);
    if (n < min || n > max) throw new ArgumentError(`${name} must be between ${min} and ${max}`);
    return n;
}

export function splitList(value) {
    if (value === undefined || value === null || value === '') return [];
    return String(value).split(',').map((s) => s.trim()).filter(Boolean);
}
