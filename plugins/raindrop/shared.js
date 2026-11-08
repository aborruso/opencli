// Official Raindrop API. Authentication belongs to the invoking process:
// RAINDROP_TOKEN may come from the shell, dotenvx, or another secret manager.
import { ArgumentError, AuthRequiredError, CommandExecutionError, EmptyResultError } from '@jackwener/opencli/errors';

const BASE = 'https://api.raindrop.io/rest/v1';
export const BOOKMARK_COLUMNS = ['id', 'title', 'url', 'excerpt', 'note', 'tags', 'collection_id', 'created', 'updated', 'type', 'important'];
export const SORTS = ['-created', 'created', 'score', '-sort', 'title', '-title', 'domain', '-domain'];

export function shapeError(label) {
    return new CommandExecutionError(`Unexpected Raindrop ${label} response shape`, 'The API contract may have changed; no partial result was returned.');
}

export async function apiGet(path, params = {}) {
    if (!/^\/[a-z0-9/-]+$/i.test(path)) throw new ArgumentError('Invalid Raindrop API path');
    const token = process.env.RAINDROP_TOKEN?.trim();
    if (!token) {
        throw new AuthRequiredError('raindrop.io', 'RAINDROP_TOKEN is missing from the command environment',
            'Set RAINDROP_TOKEN, or run: dotenvx run --redact --strict -f ~/.config/secrets/raindrop.env -fk ~/.config/secrets/.env.keys -- opencli raindrop <command>');
    }
    const url = new URL(BASE + path);
    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== '') url.searchParams.set(key, String(value));
    }
    let response;
    try {
        response = await fetch(url, {
            method: 'GET', headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
            signal: AbortSignal.timeout(25000), redirect: 'error',
        });
    } catch {
        // Do not echo arbitrary fetch messages: they may contain credentials.
        throw new CommandExecutionError('Raindrop request failed: network error, timeout, or refused redirect',
            'Check connectivity and try again. No automatic retry was attempted.');
    }
    if (response.status === 401 || response.status === 403) {
        throw new AuthRequiredError('raindrop.io', `Raindrop authentication failed (HTTP ${response.status})`,
            'Check RAINDROP_TOKEN and the token permissions; never paste the token into a command argument or chat.');
    }
    if (response.status === 429) {
        throw new CommandExecutionError('Raindrop rate limit reached (HTTP 429)',
            'Wait for the rate-limit window to reset before trying again; no automatic retry was attempted.');
    }
    if (!response.ok) throw new CommandExecutionError(`Raindrop answered HTTP ${response.status}`);
    let body;
    try { body = await response.json(); }
    catch { throw new CommandExecutionError('Raindrop returned invalid JSON'); }
    if (body?.result !== true) throw shapeError('result');
    return body;
}

export function itemsFrom(body) {
    if (!Array.isArray(body.items)) throw shapeError('items');
    return body.items;
}

export function collectionId(value = 0) {
    const id = Number(value);
    if (!Number.isSafeInteger(id) || !(id >= 0 || id === -1 || id === -99)) {
        throw new ArgumentError('collection must be 0 (all except Trash), -1 (Unsorted), -99 (Trash), or a positive collection id');
    }
    return id;
}

export function bookmarkId(value) {
    const id = Number(value);
    if (!Number.isSafeInteger(id) || id <= 0) throw new ArgumentError('id must be a positive integer');
    return id;
}

function dateBoundary(value, name) {
    if (value === undefined || value === '') return null;
    const date = String(value);
    const ms = Date.parse(date + 'T00:00:00.000Z');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(ms) || new Date(ms).toISOString().slice(0, 10) !== date) {
        throw new ArgumentError(`--${name} must be a real calendar date in YYYY-MM-DD format`);
    }
    return ms;
}

function domainsFrom(value) {
    if (value === undefined || value === '') return [];
    return String(value).split(',').map(part => {
        const domain = part.trim().toLowerCase();
        if (domain.length > 253 || !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain)) {
            throw new ArgumentError('--domain requires comma-separated hostnames, e.g. x.com,twitter.com (no URL or path)');
        }
        return domain;
    });
}

export function bookmarkRow(item) {
    if (!item || !Number.isSafeInteger(item._id) || typeof item.title !== 'string' ||
        typeof item.link !== 'string' || !Number.isFinite(Date.parse(item.created)) ||
        !Array.isArray(item.tags) || !item.tags.every(tag => typeof tag === 'string')) throw shapeError('bookmark');
    let url;
    try { url = new URL(item.link); } catch { throw shapeError('bookmark URL'); }
    if (!url.protocol) throw shapeError('bookmark URL');
    return {
        id: item._id, title: item.title, url: item.link,
        excerpt: item.excerpt ?? '', note: item.note ?? '', tags: item.tags,
        collection_id: item.collection?.$id ?? null,
        created: item.created, updated: item.lastUpdate ?? null,
        type: item.type ?? null, important: item.important ?? false,
    };
}

export async function searchBookmarks(args = {}) {
    const collection = collectionId(args.collection);
    const limit = Number(args.limit ?? 20);
    if (!Number.isSafeInteger(limit) || limit < 0) throw new ArgumentError('--limit must be an integer >= 0; 0 fetches all matches');
    const query = args.query === undefined ? '' : String(args.query);
    const sort = args.sort ?? '-created';
    if (!SORTS.includes(sort)) throw new ArgumentError(`--sort must be one of: ${SORTS.join(', ')}`);
    if (sort === 'score' && !query.trim()) throw new ArgumentError('--sort score requires a non-empty query');
    if (args.nested !== undefined && typeof args.nested !== 'boolean') throw new ArgumentError('--nested must be a boolean');
    const from = dateBoundary(args.from, 'from');
    const to = dateBoundary(args.to, 'to');
    if (from !== null && to !== null && from > to) throw new ArgumentError('--from must not be after --to');
    const until = to === null ? null : to + 86400000;
    const domains = domainsFrom(args.domain);
    const rows = [], seen = new Set();
    for (let page = 0; ; page++) {
        const body = await apiGet('/raindrops/' + collection, {
            search: query, sort, page, perpage: 50, nested: args.nested ?? false,
        });
        const items = itemsFrom(body);
        let crossedLowerBound = false, newIds = 0;
        for (const item of items) {
            const row = bookmarkRow(item);
            if (seen.has(row.id)) continue;
            seen.add(row.id);
            newIds++;
            const saved = Date.parse(row.created);
            if (from !== null && saved < from) { crossedLowerBound = true; continue; }
            if (until !== null && saved >= until) continue;
            const host = new URL(row.url).hostname.toLowerCase();
            if (domains.length && !domains.some(domain => host === domain || host.endsWith('.' + domain))) continue;
            if (!limit || rows.length < limit) rows.push(row);
        }
        if (limit && rows.length >= limit) return rows;
        if (items.length < 50 || (sort === '-created' && crossedLowerBound)) return rows;
        if (!newIds) throw new CommandExecutionError('Raindrop pagination made no progress', 'The server repeated an entire page; no partial result was returned.');
    }
}

export function requireRows(rows, command, hint) {
    if (!rows.length) throw new EmptyResultError('raindrop ' + command, hint);
    return rows;
}
