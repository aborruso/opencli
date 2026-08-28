// Helper condivisi per gli adapter law-tracker (API JSON pubblica, nessuna auth).
// Contratto verificato dal vivo 2026-08-28; vedi ~/.opencli/sites/law-tracker/endpoints.json.
import { CommandExecutionError, ArgumentError } from '@jackwener/opencli/errors';

export const BASE = 'https://law-tracker.europa.eu';
const UA = 'opencli-law-tracker/0.1';

/** `lang` è obbligatorio su ogni endpoint: si inietta qui, nessun chiamante può ometterlo. */
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
        throw new CommandExecutionError(`law-tracker non raggiungibile: ${e.message}`);
    }
    if (res.status === 400) {
        // Il backend risponde 400 anche quando il reference è inesistente o malformato.
        throw new ArgumentError('parametro rifiutato dal backend (HTTP 400): controlla reference, codici o filtri');
    }
    if (!res.ok) throw new CommandExecutionError(`law-tracker ha risposto HTTP ${res.status}`);
    try {
        return await res.json();
    } catch {
        throw new CommandExecutionError('risposta non-JSON dal backend');
    }
}

/** I titoli in /search tornano con markup <em> di evidenziazione: va tolto. */
export function stripHighlight(s) {
    return typeof s === 'string' ? s.replace(/<\/?em>/g, '').replace(/\s+/g, ' ').trim() : s;
}

/**
 * Il reference ha due grafie: display `2021/0106(COD)` e API `2021_106`
 * (zeri iniziali del numero rimossi). Qui si accettano entrambe.
 */
export function toApiRef(input) {
    const raw = String(input ?? '').trim();
    let m = raw.match(/^(\d{4})_(\d+)$/);
    if (m) return `${m[1]}_${String(Number(m[2]))}`;
    m = raw.match(/^(\d{4})\/(\d+)(?:\([A-Z]+\))?$/);
    if (m) return `${m[1]}_${String(Number(m[2]))}`;
    throw new ArgumentError(`reference non valido: "${raw}". Attesi 2021/0106(COD) oppure 2021_106`);
}

export function procedureUrl(apiRef, lang = 'en') {
    return `${BASE}/procedure/${apiRef}?lang=${lang}`;
}

export function parseIntArg(value, name, { min = 0, max = Infinity } = {}) {
    const n = Number(value);
    if (!Number.isInteger(n)) throw new ArgumentError(`${name} deve essere un intero`);
    if (n < min || n > max) throw new ArgumentError(`${name} deve stare fra ${min} e ${max}`);
    return n;
}

export function splitList(value) {
    if (value === undefined || value === null || value === '') return [];
    return String(value).split(',').map((s) => s.trim()).filter(Boolean);
}
