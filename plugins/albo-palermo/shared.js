// Shared helpers for the albo-palermo adapters.
//
// The Albo Pretorio of the Comune di Palermo is a server-rendered JSP
// application by SISPI. The "no JavaScript" banner is cosmetic: every page
// carries its data in the HTML, so nothing here needs a browser.
//
//   jsp/home.jsp?modo=info&info=servizi.jsp                        11 categories
//   jsp/home.jsp?modo=info&info=scelta_tipo_documento.jsp&TD=&SERCOD=   types of one category
//   pu/push-tabella-delibere.do?nomeTabella=FO_SCEDELIBEREAP&AP=AP&TD=  acts of one type
//
// The list is stateful. It shows 10 rows, the next page is a POST, and the
// detail of a row is `tabella-modifica.do?row=N` with N counted within the
// current page. So every run holds its own cookie jar and walks the pages in
// order, never in parallel. Verified live on 2026-09-22.
import { ArgumentError, CommandExecutionError } from '@jackwener/opencli/errors';

export const BASE = 'https://albopretorio.comune.palermo.it/albopretorio';
export const HOME = `${BASE}/jsp/home.jsp?modo=info&info=servizi.jsp`;
const TABLE = 'FO_SCEDELIBEREAP';
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const TIMEOUT_MS = 60_000;
const RETRY_WAIT_MS = [3_000, 10_000, 30_000];

// Requests in flight at once, across sessions. The portal answered 429 to
// bursts of about a dozen parallel requests on 2026-09-22.
export const CONCURRENCY = 2;

/** Run `fn` over `items`, at most `CONCURRENCY` at a time, keeping the order of the results. */
export async function pool(items, fn) {
    const out = new Array(items.length);
    let next = 0;
    const worker = async () => {
        while (next < items.length) {
            const i = next++;
            out[i] = await fn(items[i], i);
        }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, worker));
    return out;
}

// The list shows 10 acts a page and every act costs one more request for its
// permanent link, so a run stops at two pages by design.
export const MAX_PAGES = 2;

// The permanent link carries `ALBCOD`: the internal id `ALB_COD`, XORed digit
// by digit with this fixed key and written in hex. 1800156607 ↔
// 6271636078667F75657B, checked on four acts.
const KEY = 'SISPISICUL';

export function encodeAlbcod(id) {
    const s = String(id);
    return [...s].map((c, i) => (c.charCodeAt(0) ^ KEY.charCodeAt(i % KEY.length)).toString(16).padStart(2, '0')).join('').toUpperCase();
}

export function decodeAlbcod(hex) {
    const bytes = String(hex).match(/../g) ?? [];
    return bytes.map((b, i) => String.fromCharCode(parseInt(b, 16) ^ KEY.charCodeAt(i % KEY.length))).join('');
}

export function permalink(type, albcod) {
    return `${BASE}/pu/push-tabella-delibere.do?nomeTabella=${TABLE}&TD=${type}&ALBCOD=${albcod}&sportello=albopretorio`;
}

export function listUrl(type) {
    return `${BASE}/pu/push-tabella-delibere.do?nomeTabella=${TABLE}&AP=AP&TD=${type}`;
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

/** Cards of the index pages: each `<h5>` title followed by the button that opens it. */
export function parseCards(html) {
    const out = [];
    const re = /<h5[^>]*card-title[^>]*>([\s\S]*?)<\/h5>[\s\S]*?onclick="location\.href='([^']+)'/g;
    let m;
    while ((m = re.exec(html)) !== null) out.push({ name: text(m[1]), href: m[2] });
    return out;
}

/** The `<h3>` naming the document type on a list or detail page. */
export function pageTitle(html) {
    const titles = [...html.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>/g)].map((m) => text(m[1]));
    return titles.find((t) => t && t !== 'Albo Pretorio') ?? '';
}

/** `pagina 1 di 3` and `N.ro righe 26` of a list page. */
export function listInfo(html) {
    const page = /pagina\s+(\d+)\s+di\s+(\d+)/.exec(html);
    const rows = /N\.ro righe\s+(\d+)/.exec(html);
    return {
        page: page ? Number(page[1]) : 1,
        pages: page ? Number(page[2]) : 1,
        total: rows ? Number(rows[1]) : null,
    };
}

/** Row indexes of a list page, in order: the only handle to a detail. */
export function rowIndexes(html) {
    return [...html.matchAll(/tabella-modifica\.do\?row=(\d+)/g)].map((m) => Number(m[1]));
}

/** A search that matches one act skips the list and opens its detail. */
export function isDetail(html) {
    return /id='ALB_COD'/.test(html) && /record\s+\d+\s+di\s+\d+/.test(html);
}

function field(html, name) {
    const m = new RegExp(`id='${name}'[^>]*value='([^']*)'`).exec(html);
    return m ? text(m[1]) : '';
}

/**
 * The attachments of a detail page: `viewDocument?col=ALLEGATI&idx=N` is an
 * index into the detail last opened in the session, not a permanent URL.
 */
export function attachmentLinks(html) {
    return [...html.matchAll(/viewDocument\?col=ALLEGATI&(?:amp;)?idx=(\d+)[^>]*>\s*<img src='[^']*\/([a-z_]+)\.gif'[\s\S]*?Kb&nbsp;([\d.,]+)\)<\/a>/g)]
        .map((m) => ({ idx: Number(m[1]), kb: m[3], signed: m[2].endsWith('_signed') }));
}

/** The URL of one act, from its permanent link or from a bare ALBCOD plus a document type. */
export async function actUrl(act, type) {
    const s = String(act ?? '').trim();
    if (/^https?:\/\//.test(s)) {
        const u = new URL(s);
        if (!u.searchParams.get('ALBCOD') || !u.searchParams.get('TD')) {
            throw new ArgumentError('this is not a permanent link of the Albo Pretorio: it needs TD and ALBCOD');
        }
        return s;
    }
    if (/^[0-9A-F]+$/i.test(s) && s.length % 2 === 0) {
        if (!type) throw new ArgumentError('a bare ALBCOD needs --type <TD>: the permanent link is built from both');
        return permalink((await resolveType(type)).td, s.toUpperCase());
    }
    throw new ArgumentError(`"${s}" is neither a permanent link nor an ALBCOD (hex)`);
}

/** Everything the detail page says about one act, shaped as an output row. */
export function parseDetail(html) {
    const subject = /id='ALB_DESOGGETTO'[^>]*>([\s\S]*?)<\/textarea>/.exec(html);
    const link = /ALBCOD=([0-9A-F]+)/i.exec(html);
    const type = field(html, 'TAT_COD');
    const albcod = link ? link[1] : encodeAlbcod(field(html, 'ALB_COD'));
    // Attachments have no permanent link, only an index into the session, so
    // a row lists their size and whether the file is digitally signed.
    const attachments = attachmentLinks(html).map((a) => `${a.kb} KB${a.signed ? ' signed' : ''}`);
    return {
        type: pageTitle(html),
        number: field(html, 'ALB_NUMPROT'),
        date: isoDate(field(html, 'ALB_DATPROT')),
        subject: subject ? text(subject[1]) : '',
        sector: field(html, 'SET_COD_DECODIFICATO'),
        published_from: isoDate(field(html, 'ALB_DATINIPUB')),
        published_to: isoDate(field(html, 'ALB_DATFINPUB')),
        attachments: attachments.join('; '),
        permalink: permalink(type, albcod),
    };
}

export const COLUMNS = ['type', 'number', 'date', 'subject', 'sector', 'published_from', 'published_to', 'attachments', 'permalink'];

/** `<option>` pairs of a `<select>` on the filter page. */
export function options(html, name) {
    const select = new RegExp(`<select[^>]*name='${name}'[^>]*>([\\s\\S]*?)</select>`).exec(html);
    if (!select) return [];
    return [...select[1].matchAll(/<option value='([^']*)'[^>]*>([^<]*)/g)]
        .map((m) => ({ value: m[1], label: text(m[2]) }))
        .filter((o) => o.value !== '');
}

/**
 * Every category and document type, from the two index pages: 12 requests.
 * They hold no session state, so the categories load in parallel, within the pool.
 */
export async function catalogue() {
    const categories = parseCards(await new Session().get(HOME));
    const pages = await pool(categories, (c) => new Session().get(new URL(c.href, `${BASE}/jsp/`).href));
    return categories.flatMap((c, i) => parseCards(pages[i]).map((t) => {
        const td = /[?&]TD=(\d+)/.exec(t.href)?.[1] ?? '';
        return { category: c.name, type: t.name, td, url: listUrl(td) };
    }));
}

// ---------------------------------------------------------------- args

/**
 * Document types from TD codes or exact names (case-insensitive), comma-separated.
 * Two names belong to two types each (Decreto Prefettizio, Rilascio Immobile):
 * those are refused with both codes, never resolved to the first.
 */
export async function resolveTypes(value) {
    const wanted = String(value ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    const all = await catalogue();
    if (!wanted.length) return all;
    return wanted.map((w) => {
        const low = w.toLowerCase();
        const hits = all.filter((t) => t.td === w || t.type.toLowerCase() === low);
        if (hits.length === 1) return hits[0];
        const show = (list) => list.map((t) => `${t.td} ${t.type} (${t.category})`).join('; ');
        if (hits.length > 1) throw new ArgumentError(`"${w}" names ${hits.length} document types, use the TD code: ${show(hits)}`);
        const near = all.filter((t) => t.type.toLowerCase().includes(low));
        throw new ArgumentError(`unknown document type "${w}"${near.length ? `; did you mean: ${show(near)}` : ''}. Codes: \`opencli albo-palermo types\``);
    });
}

/** One document type, from its TD code or its exact name. A code costs no request. */
export async function resolveType(value) {
    const s = String(value ?? '').trim();
    if (/^\d+$/.test(s)) return { td: s };
    const types = await resolveTypes(s);
    if (types.length !== 1) throw new ArgumentError('give one document type, as a TD code or its exact name');
    return types[0];
}

export function checkPages(value) {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 1 || n > MAX_PAGES) throw new ArgumentError(`--pages must be 1 or ${MAX_PAGES}`);
    return n;
}

// ---------------------------------------------------------------- walk

/**
 * Walk up to `pages` list pages from the one already loaded, opening the
 * detail of every row. The session must be sitting on page 1 of a list.
 */
export async function collect(session, firstPage, pages) {
    // A type with one act in publication skips the list, as a search with one match does.
    if (isDetail(firstPage)) return { rows: [parseDetail(firstPage)], total: 1, pages: 1 };
    const info = listInfo(firstPage);
    const rows = [];
    let html = firstPage;
    for (let p = 1; p <= pages; p++) {
        for (const row of rowIndexes(html)) {
            rows.push(parseDetail(await session.get(`${BASE}/dbmanager/tabella-modifica.do?row=${row}`)));
        }
        if (p >= info.pages || p === pages) break;
        html = await session.post('tabella-lista-piu.do');
    }
    return { rows, total: info.total, pages: info.pages };
}

export function footer(kwargs) {
    if (kwargs._total == null) return undefined;
    return `${kwargs._total} act${kwargs._total === 1 ? '' : 's'} in publication, ${kwargs._pages} page${kwargs._pages === 1 ? '' : 's'} of 10 on the portal`;
}
