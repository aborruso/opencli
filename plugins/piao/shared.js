// Shared helpers for the piao adapters.
//
// piao.dfp.gov.it is a Drupal page around a React view that reads two public
// JSON endpoints, no key or cookie. Contract read from the page's bundle and
// checked live on 2026-11-10:
//   GET /api/piao?page=N[&administrationName=][&ipaCode=]
//   GET /api/administrations?[administrationName=|ipaCode=]&limit=N
// /api/piao returns 6 records per page and ignores limit, perPage and size. It
// has no triennium filter (year and years are ignored), so that one is local.
// An empty result has `count: 0` and no `total`. No rate limit is declared;
// the commands call the server serially.
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { ArgumentError, CommandExecutionError } from '@jackwener/opencli/errors';

export const BASE = 'https://piao.dfp.gov.it';
const UA = 'opencli-piao/0.1';

// 6 records a page: the most one command reads, so no search turns into a
// download of the 40,000-record archive.
export const MAX_PAGES = 200;
export const MAX_LIMIT = MAX_PAGES * 6;
export const MAX_ADMINISTRATIONS = 10000;

export function checkLimit(input, max = MAX_LIMIT) {
    const n = Number(input);
    if (!Number.isInteger(n) || n < 1 || n > max) {
        throw new ArgumentError(`invalid --limit "${input}": 1 to ${max}`);
    }
    return n;
}

export async function apiGet(url, what) {
    let res;
    try {
        res = await fetch(`${BASE}${url}`, { headers: { accept: 'application/json', 'user-agent': UA } });
    } catch (e) {
        throw new CommandExecutionError(`${what} is unreachable: ${e.message}${e.cause?.code ? ` (${e.cause.code})` : ''}`);
    }
    if (!res.ok) throw new CommandExecutionError(`${what} answered HTTP ${res.status}`);
    let json;
    try {
        json = await res.json();
    } catch {
        throw new CommandExecutionError(`non-JSON response from ${what}`);
    }
    if (!json?.success) throw new CommandExecutionError(`${what} answered success=false`);
    return json;
}

/**
 * Pages through /api/piao until `limit` records pass `keep` or the records end.
 * Stops with an error at MAX_PAGES: a partial list must not look complete.
 */
export async function fetchPiao({ name, ipa, keep = () => true, limit = Infinity } = {}) {
    const filters = [];
    if (name) filters.push(`administrationName=${encodeURIComponent(name)}`);
    if (ipa) filters.push(`ipaCode=${encodeURIComponent(ipa)}`);
    const records = [];
    let seen = 0;
    let total = 0;
    for (let page = 0; ; page++) {
        if (page === MAX_PAGES) {
            throw new CommandExecutionError(`piao: read ${seen} of ${total} records, the most one command reads, with ${records.length} kept: narrow the name or the IPA code, or lower --limit where the command has it`);
        }
        const json = await apiGet(`/api/piao?${[...filters, `page=${page}`].join('&')}`, 'the PIAO list');
        const result = json.result?.[0];
        if (!Array.isArray(result?.list)) {
            throw new CommandExecutionError('the PIAO list answered without result[0].list: the response shape changed');
        }
        total = result.total ?? 0;
        for (const record of result.list) {
            seen++;
            if (keep(record)) {
                records.push(record);
                if (records.length === limit) return { records, total };
            }
        }
        if (result.list.length === 0 || seen >= total) return { records, total };
    }
}

export const triennium = (record) => /\d{4}-\d{4}/.exec(record.years ?? '')?.[0] ?? record.years ?? null;

/** --anno as a predicate: YYYY is any triennium covering that year, YYYY-YYYY is that triennium. */
export function annoFilter(input) {
    const anno = String(input ?? '').trim();
    if (!anno) return () => true;
    if (/^\d{4}-\d{4}$/.test(anno)) return (record) => triennium(record) === anno;
    if (/^\d{4}$/.test(anno)) {
        const year = Number(anno);
        return (record) => {
            const [from, to] = String(triennium(record)).split('-').map(Number);
            return from <= year && year <= to;
        };
    }
    throw new ArgumentError(`invalid --anno "${input}": a year (2026, any triennium covering it) or a triennium (2026-2028)`);
}

/** Keeps the highest version of each administration and triennium, in input order. */
export function latestOnly(records) {
    const key = (r) => `${r.administrationIpaCode}|${triennium(r)}`;
    const highest = new Map();
    for (const r of records) highest.set(key(r), Math.max(highest.get(key(r)) ?? -Infinity, r.version ?? 0));
    return records.filter((r) => (r.version ?? 0) === highest.get(key(r)));
}

const clean = (v) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);
const filesOf = (record, field) => record.content?.[field]?.files ?? [];
const urls = (files) => files.map((f) => f.url).join('; ') || null;

export const PIAO_COLUMNS = ['ipa_code', 'administration', 'triennium', 'version', 'approval_date', 'authority', 'act_reference', 'n_dipendenti', 'piao_url', 'act_url', 'attachments', 'pa_url'];

export function piaoRow(record) {
    const c = record.content ?? {};
    return {
        ipa_code: record.administrationIpaCode ?? null,
        administration: clean(record.administrationName),
        triennium: triennium(record),
        version: record.version ?? null,
        approval_date: clean(c.approvalDate?.value),
        authority: clean(c.autorita?.value),
        act_reference: clean(c.estremiAtto?.value),
        n_dipendenti: clean(c.nDipendenti?.value?.value),
        piao_url: urls(filesOf(record, 'piaoPDF')),
        act_url: urls(filesOf(record, 'atto')),
        attachments: filesOf(record, 'attachments').length,
        pa_url: clean(c.linkPiaoPA?.value),
    };
}

export const FILE_COLUMNS = ['ipa_code', 'triennium', 'version', 'kind', 'file_name', 'mime_type', 'url', 'status', 'bytes', 'path'];

/** One row per document of a record. `index` numbers the files of one kind. */
export function fileRows(record) {
    const kinds = [['piao', 'piaoPDF'], ['act', 'atto'], ['attachment', 'attachments']];
    return kinds.flatMap(([kind, field]) => filesOf(record, field).map((f, i) => ({
        ipa_code: record.administrationIpaCode ?? null,
        triennium: triennium(record),
        version: record.version ?? null,
        kind,
        index: i + 1,
        file_name: f.fileName ?? null,
        mime_type: f.mimeType ?? null,
        url: f.url,
    })));
}

const safeName = (name) => {
    const base = path.basename(String(name ?? '').replace(/\\/g, '/')).replace(/[\x00-\x1f<>:"|?*]/g, '_');
    return base && base !== '.' && base !== '..' ? base : 'file';
};

/** <dir>/<ipa code>/<triennium>_v<version>/<kind>-<n>_<file name> */
export function targetPath(dir, row) {
    return path.join(dir, safeName(row.ipa_code), safeName(`${row.triennium}_v${row.version}`), `${row.kind}-${row.index}_${safeName(row.file_name)}`);
}

/** Saves one document unless already on disk; `.part` keeps a broken download from counting as done. */
export async function saveFile(url, file) {
    if (fs.existsSync(file)) return { status: 'exists', bytes: fs.statSync(file).size };
    const res = await fetch(url, { headers: { 'user-agent': UA } });
    if (!res.ok) {
        await res.body?.cancel();
        throw new Error(`HTTP ${res.status}`);
    }
    if ((res.headers.get('content-type') ?? '').startsWith('text/html')) {
        await res.body?.cancel();
        throw new Error('an HTML page instead of a file');
    }
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const part = `${file}.part`;
    try {
        await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(part));
        fs.renameSync(part, file);
    } catch (e) {
        fs.rmSync(part, { force: true });
        throw e;
    }
    return { status: 'downloaded', bytes: fs.statSync(file).size };
}
