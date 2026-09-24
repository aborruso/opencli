// Shared helpers for the palermo-delibere adapters.
//
// "Delibere e Ordinanze" of the Comune di Palermo's online services portal is
// the same SISPI application as the Albo Pretorio (see albo-palermo), and it
// holds the same records: an act has the same ALB_COD and ALBCOD in both. The
// difference is that here acts stay after their publication period, so this
// is the permanent archive. Eight sections, each its own table:
//
//   pu/push-tabella-delibere.do?nomeTabella=<table>&TD=<code>&SERCOD=<n>   list or filter form
//   dbmanager/tabella-filtro.do                                           filter form of a list
//   dbmanager/tabella-ricerca.do                                          run the filter
//   dbmanager/tabella-modifica.do?row=N                                   detail of row N
//
// Five sections open on a list. Three open on the filter form, and the filter
// refuses a query that matches too many acts ("numero eccessivo di elementi"):
// the year 2026 alone is 12,493 Dirigenziali. Verified live on 2026-09-24.
import { ArgumentError, CommandExecutionError } from '@jackwener/opencli/errors';

export const BASE = 'https://servizionline.comune.palermo.it/portcitt';
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const TIMEOUT_MS = 60_000;
const RETRY_WAIT_MS = [3_000, 10_000, 30_000];

// A run reads at most two list pages per section: ten acts a page, and every
// act costs one more request for its permanent link.
export const MAX_PAGES = 2;

// How the daily dump reaches each section: `list` reads the list as it
// opens, `year` filters on the year (no date field in the form), `date` on
// the protocol date (the year alone is too many acts).
export const SECTIONS = [
    { code: 'DGC', table: 'FO_SCEDELIBERE', sercod: 6000, daily: 'list', name: 'Delibere di Giunta Comunale' },
    { code: 'DCC', table: 'FO_SCEDELIBERE', sercod: 6010, daily: 'list', name: 'Delibere di Consiglio Comunale' },
    { code: 'DCCIR', table: 'FO_SCEDELIBERE', sercod: 6015, daily: 'year', name: 'Delibere di Consiglio di Circoscrizione' },
    { code: 'DCS', table: 'FO_SCEDELIBERE', sercod: 6017, daily: 'list', name: 'Delibere del Comitato dei Sindaci' },
    { code: 'OS', table: 'FO_SCEALBOPRETORIO', sercod: 6020, daily: 'list', name: 'Determinazioni e Ordinanze Sindacali' },
    { code: 'DCO', table: 'FO_SCEALBOPRETORIO', sercod: 6021, daily: 'list', name: 'Determinazioni e Ordinanze Commissariali' },
    { code: 'DDI', table: 'FO_SCEDETDIRIGENZIALI', sercod: 6030, daily: 'date', name: 'Determinazioni e Ordinanze Dirigenziali' },
    { code: 'ODT', table: 'FO_SCEDETDIRIGENZIALIUT', sercod: 6040, daily: 'date', name: 'Determinazioni e Ordinanze Dirigenziali Ufficio Traffico' },
];

/** One section from its code, case-insensitive. */
export function section(code) {
    const c = String(code ?? '').trim().toUpperCase();
    const s = SECTIONS.find((x) => x.code === c);
    if (!s) throw new ArgumentError(`unknown section "${code}". Sections: ${SECTIONS.map((x) => x.code).join(', ')} (\`opencli palermo-delibere sections\`)`);
    return s;
}

/** Sections from a comma-separated list of codes; all of them when empty. */
export function sectionList(value) {
    const codes = String(value ?? '').split(',').map((v) => v.trim()).filter(Boolean);
    return codes.length ? codes.map(section) : SECTIONS;
}

export function listUrl(s) {
    return `${BASE}/pu/push-tabella-delibere.do?nomeTabella=${s.table}&TD=${s.code}&SERCOD=${s.sercod}`;
}

export function permalink(s, albcod) {
    return `${BASE}/pu/push-tabella-delibere.do?nomeTabella=${s.table}&TD=${s.code}&ALBCOD=${albcod}&sportello=portcitt`;
}

// ALBCOD is the internal id ALB_COD, XORed digit by digit with this key and
// written in hex, as on the Albo Pretorio: 627E6A627A607C716675 ↔ 1792335239.
const KEY = 'SISPISICUL';

export function encodeAlbcod(id) {
    return [...String(id)].map((c, i) => (c.charCodeAt(0) ^ KEY.charCodeAt(i % KEY.length)).toString(16).padStart(2, '0')).join('').toUpperCase();
}

// ---------------------------------------------------------------- http

/** One cookie jar per run: the list, its pages and its details share a server-side session. */
export class Session {
    constructor() {
        this.jar = new Map();
    }

    /** The response of one request, after cookies, redirects and 429 retries. */
    async send(url, form, attempt = 0) {
        const headers = { 'User-Agent': UA, Accept: 'text/html,*/*;q=0.8' };
        if (this.jar.size) headers.Cookie = [...this.jar].map(([k, v]) => `${k}=${v}`).join('; ');
        const init = { headers, redirect: 'manual', signal: AbortSignal.timeout(TIMEOUT_MS) };
        if (form) {
            init.method = 'POST';
            init.body = new URLSearchParams(form).toString();
            headers['Content-Type'] = 'application/x-www-form-urlencoded';
        }
        let resp;
        try {
            resp = await fetch(new URL(url, `${BASE}/`), init);
        } catch (error) {
            throw new CommandExecutionError(`albo-palermo request failed: ${error?.message || error}`);
        }
        for (const line of resp.headers.getSetCookie()) {
            const head = line.split(';')[0];
            const i = head.indexOf('=');
            this.jar.set(head.slice(0, i), head.slice(i + 1));
        }
        // Follow redirects by hand, so the cookies they set are kept.
        const location = resp.headers.get('location');
        if (resp.status >= 300 && resp.status < 400 && location) return this.send(new URL(location, url).href);
        // The portal rate-limits bursts with 429 and sends no Retry-After.
        // Wait and retry a few times, then say so plainly.
        if (resp.status === 429) {
            if (attempt < RETRY_WAIT_MS.length) {
                await new Promise((r) => setTimeout(r, RETRY_WAIT_MS[attempt]));
                return this.send(url, form, attempt + 1);
            }
            throw new CommandExecutionError('albo-palermo: the portal is rate-limiting this address (HTTP 429). Wait a minute and retry');
        }
        if (!resp.ok) throw new CommandExecutionError(`albo-palermo request failed: HTTP ${resp.status} for ${url}`);
        return resp;
    }

    async request(url, form) {
        const html = await (await this.send(url, form)).text();
        // The application answers 200 with this page when a request does not
        // fit the session state, e.g. a row index that is not on the current page.
        if (/Servizio temporaneamente non disponibile/.test(html)) {
            throw new CommandExecutionError(`albo-palermo: the portal answered "Servizio temporaneamente non disponibile" for ${url}`);
        }
        return html;
    }

    get(url) {
        return this.request(url);
    }

    post(path, fields = {}) {
        return this.request(`${BASE}/dbmanager/${path}`, { siglaStato: 'L', row: '', chiave: '', provieneDa: '', ...fields });
    }
}

// ---------------------------------------------------------------- html

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

export function text(value) {
    return String(value ?? '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
        .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
        .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m)
        .replace(/\s+/g, ' ')
        .trim();
}
/** `18/09/2026` → `2026-09-18`. */
export function isoDate(value) {
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(value ?? '').trim());
    return m ? `${m[3]}-${m[2]}-${m[1]}` : String(value ?? '').trim();
}

/** `pagina 1 di 235` and `N.ro righe 2.349` of a list page (the count has thousands dots). */
export function listInfo(html) {
    const page = /pagina\s+(\d+)\s+di\s+([\d.]+)/.exec(html);
    const rows = /N\.ro righe\s+([\d.]+)/.exec(html);
    return {
        pages: page ? Number(page[2].replace(/\./g, '')) : 1,
        total: rows ? Number(rows[1].replace(/\./g, '')) : null,
    };
}

/** Row indexes of a list page, in order: the only handle to a detail. */
export function rowIndexes(html) {
    return [...html.matchAll(/tabella-modifica\.do\?row=(\d+)/g)].map((m) => Number(m[1]));
}

/** A filter that matches one act skips the list and opens its detail. */
export function isDetail(html) {
    return /id='ALB_DATFINPUB'|id='ALB_DATPROT'[^>]*value='\d/.test(html) && /record\s+\d+\s+di\s+\d+/.test(html);
}

function field(html, name) {
    const m = new RegExp(`id='${name}'[^>]*value='([^']*)'`).exec(html);
    return m ? text(m[1]) : '';
}

/** The attachments of a detail page: an index into the session, not a permanent URL. */
export function attachmentLinks(html) {
    return [...html.matchAll(/viewDocument\?col=ALLEGATI&(?:amp;)?idx=(\d+)[^>]*>\s*<img src='[^']*\/([a-z_]+)\.gif'[\s\S]*?Kb&nbsp;([\d.,]+)\)<\/a>/g)]
        .map((m) => ({ idx: Number(m[1]), kb: m[3], signed: m[2].endsWith('_signed') }));
}

export const COLUMNS = ['section', 'type', 'number', 'date', 'subject', 'sector', 'published_to', 'attachments', 'permalink'];

/**
 * One act as an output row. Every row has the same columns, empty where a
 * section's detail lacks the field: only OS, ODT and DDI decode their type,
 * only DDI names a sector.
 */
export function parseDetail(html, s) {
    // A div here, a textarea on the Albo Pretorio.
    const subject = /id='ALB_DESOGGETTO'[^>]*>([\s\S]*?)<\/(?:div|textarea)>/.exec(html);
    // The link is built from ALB_COD, not taken from the page's "Copia"
    // button: that one is only the portal's base URL on six DCO acts of
    // 2024-12-30, and on ODT it names the DDI table with an empty TD, which
    // opens nothing ("Nessun record presente"). It stays as a fallback.
    const own = /testoCodiceIpa\s*=\s*'([^']*ALBCOD=[^']+)'/.exec(html);
    const id = field(html, 'ALB_COD');
    return {
        section: s.code,
        type: field(html, 'TAT_COD_DECODIFICATO') || s.name,
        number: field(html, 'ALB_NUMPROT'),
        date: isoDate(field(html, 'ALB_DATPROT')),
        subject: subject ? text(subject[1]) : '',
        sector: field(html, 'SET_COD_DECODIFICATO'),
        published_to: isoDate(field(html, 'ALB_DATFINPUB')),
        attachments: attachmentLinks(html).map((a) => `${a.kb} KB${a.signed ? ' signed' : ''}`).join('; '),
        permalink: id ? permalink(s, encodeAlbcod(id)) : own ? own[1] : '',
    };
}

// ---------------------------------------------------------------- filter

/** The flag behind each form field, for error messages. */
const FLAGS = { ALB_DESOGGETTO: '--text', ALB_DESANNOPROT: '--year', ALB_NUMPROT: '--number', ALB_DATPROT: '--date', SET_COD: '--sector' };

/** The fields of the filter form, with the values of its hidden inputs. */
function formFields(html) {
    const form = /<form[^>]*id='passaggio'[\s\S]*?<\/form>/.exec(html)?.[0] ?? html;
    const out = {};
    for (const m of form.matchAll(/<(input|select|textarea)\b[^>]*\bname='([^']+)'[^>]*>/g)) {
        const value = m[1] === 'input' ? /\bvalue='([^']*)'/.exec(m[0])?.[1] ?? '' : '';
        out[m[2]] = value;
    }
    return out;
}

/** `<option>` pairs of a `<select>` of the filter form. */
export function options(html, name) {
    const select = new RegExp(`<select[^>]*name='${name}'[^>]*>([\\s\\S]*?)</select>`).exec(html);
    if (!select) return [];
    return [...select[1].matchAll(/<option value='([^']*)'[^>]*>([^<]*)/g)]
        .map((m) => ({ value: m[1], label: text(m[2]) }))
        .filter((o) => o.value !== '');
}

/** The filter form of a section, on the session: three sections open on it, the others on a list. */
export async function openForm(session, s) {
    const html = await session.get(listUrl(s));
    if (!rowIndexes(html).length && /name='ALB_DESANNOPROT'/.test(html)) return html;
    return session.post('tabella-filtro.do');
}

/**
 * Run the portal's filter. `fields` are form field names; one the section's
 * form does not have is refused rather than silently ignored. Returns the
 * page the portal answers: a list, a single detail, or an empty result.
 */
export async function runFilter(session, s, fields) {
    const form = await openForm(session, s);
    const all = formFields(form);
    for (const k of Object.keys(fields)) {
        if (!(k in all)) throw new ArgumentError(`section ${s.code} has no ${FLAGS[k] ?? k} filter`);
    }
    const html = await session.post('tabella-ricerca.do', { ...all, ...fields, siglaStato: 'F', row: '0' });
    const tooMany = /numero eccessivo di elementi:\s*([\d.]+)/.exec(html);
    if (tooMany) {
        throw new CommandExecutionError(`palermo-delibere: the portal refuses this filter on ${s.code}, it matches too many acts (${tooMany[1]}). Narrow it, e.g. with a date`);
    }
    return { html, form };
}

export function isEmptyResult(html) {
    return /Nessun elemento trovato/.test(html);
}

// ---------------------------------------------------------------- walk

/**
 * Up to `pages` list pages from the one already loaded, opening the detail of
 * every row. A single match arrives as a detail, no match as an empty page.
 */
export async function collect(session, s, firstPage, pages) {
    if (isDetail(firstPage)) return { rows: [parseDetail(firstPage, s)], total: 1, pages: 1 };
    if (isEmptyResult(firstPage) || !rowIndexes(firstPage).length) return { rows: [], total: 0, pages: 0 };
    const info = listInfo(firstPage);
    const rows = [];
    let html = firstPage;
    for (let p = 1; p <= pages; p++) {
        for (const row of rowIndexes(html)) {
            rows.push(parseDetail(await session.get(`${BASE}/dbmanager/tabella-modifica.do?row=${row}`), s));
        }
        if (p >= info.pages || p === pages) break;
        html = await session.post('tabella-lista-piu.do');
    }
    return { rows, total: info.total, pages: info.pages };
}

export function checkPages(value) {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 1 || n > MAX_PAGES) throw new ArgumentError(`--pages must be 1 or ${MAX_PAGES}`);
    return n;
}

/** `2026-09-22` → `22/09/2026`, as the form wants it. */
export function formDate(value) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? '').trim());
    if (!m) throw new ArgumentError(`a date is YYYY-MM-DD, not "${value}"`);
    return `${m[3]}/${m[2]}/${m[1]}`;
}

/**
 * The acts of one section for the day `date` (YYYY-MM-DD), by the section's
 * daily rule: its list, its filter on the year of `date`, or its filter on
 * `date` itself.
 */
export async function daily(s, date, pages) {
    const session = new Session();
    let first;
    if (s.daily === 'list') first = await session.get(listUrl(s));
    else if (s.daily === 'year') first = (await runFilter(session, s, { ALB_DESANNOPROT: date.slice(0, 4) })).html;
    else first = (await runFilter(session, s, { ALB_DATPROT: formDate(date) })).html;
    return collect(session, s, first, pages);
}

// ---------------------------------------------------------------- act

/** The URL of one act, from its permanent link or from a bare ALBCOD plus a section. */
export function actUrl(act, code) {
    const v = String(act ?? '').trim();
    if (/^https?:\/\//.test(v)) {
        const u = new URL(v);
        const s = section(u.searchParams.get('TD') ?? '');
        if (!u.searchParams.get('ALBCOD')) throw new ArgumentError('this is not a permanent link of the portal: it needs TD and ALBCOD');
        return { url: v, s };
    }
    if (/^[0-9A-F]+$/i.test(v) && v.length % 2 === 0) {
        if (!code) throw new ArgumentError('a bare ALBCOD needs --section <code>: the permanent link is built from both');
        const s = section(code);
        return { url: permalink(s, v.toUpperCase()), s };
    }
    throw new ArgumentError(`"${v}" is neither a permanent link nor an ALBCOD (hex)`);
}
