// Shared helpers for the eur-lex adapters.
//
// The commands do NOT talk to eur-lex.europa.eu: that host sits behind an AWS
// WAF and answers HTTP 202 with a JS challenge to non-browser clients. They use
// the Publications Office endpoints instead, which are the official
// machine-readable interfaces and are not challenged:
//   - Cellar REST   https://publications.europa.eu/resource/celex/<CELEX>
//   - SPARQL        https://publications.europa.eu/webapi/rdf/sparql
// Searching EUR-Lex full text stays a browser workflow; see the sitemap.
// Contracts verified live on 2026-08-28.
import { ArgumentError, CommandExecutionError } from '@jackwener/opencli/errors';

export const CELLAR = 'https://publications.europa.eu/resource/celex/';
export const SPARQL = 'https://publications.europa.eu/webapi/rdf/sparql';
const UA = 'opencli-eur-lex/0.1';

/** A CELEX number, e.g. 32024R1689 or the consolidated form 02024R1358-20240522. */
export function checkCelex(input) {
    const celex = String(input ?? '').trim().toUpperCase();
    if (!/^[0-9][0-9]{4}[A-Z]{1,2}[0-9]{4}(\(\d{2}\))?(-\d{8})?$/.test(celex)) {
        throw new ArgumentError(`invalid act "${input}". Expected a CELEX number like 32024R1689 or 02024R1358-20240522, or an ELI like reg/2024/1689/oj`);
    }
    return celex;
}

/**
 * A CELEX number or an ELI, resolved to a CELEX number. The ELI can be the full
 * URI (http://data.europa.eu/eli/reg/2024/1689/oj) or its path (reg/2024/1689/oj).
 * Cellar stores it as cdm:resource_legal_eli, a literal typed xsd:anyURI.
 * Proposals have no ELI, only adopted acts and consolidated versions.
 */
export async function resolveCelex(input) {
    const raw = String(input ?? '').trim();
    const path = raw.replace(/^https?:\/\/data\.europa\.eu\/eli\//i, '').replace(/^eli\//i, '').replace(/\/+$/, '');
    if (!/^[a-z_]+\/\d{4}\/[0-9a-z_\-\/]+$/i.test(path)) return checkCelex(raw);
    const eli = `http://data.europa.eu/eli/${path.toLowerCase()}`;
    const data = await sparql(`PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>
SELECT ?c WHERE { ?w cdm:resource_legal_eli "${eli}"^^<http://www.w3.org/2001/XMLSchema#anyURI> ; cdm:resource_legal_id_celex ?c } LIMIT 1`);
    const celex = data?.results?.bindings?.[0]?.c?.value;
    if (!celex) throw new ArgumentError(`no act with ELI ${eli} in Cellar. Expected something like reg/2024/1689/oj`);
    return celex;
}

export function eurlexUrl(celex, lang = 'EN') {
    return `https://eur-lex.europa.eu/legal-content/${lang}/TXT/?uri=CELEX:${celex}`;
}

/**
 * Cellar content negotiation. `Accept-Language` is mandatory: without it the
 * service answers 400 "Invalid content type ... without language".
 */
export async function cellarFetch(celex, accept, lang3 = 'eng') {
    let res;
    try {
        res = await fetch(CELLAR + celex, {
            redirect: 'follow',
            headers: { accept, 'accept-language': lang3, 'user-agent': UA },
        });
    } catch (e) {
        throw new CommandExecutionError(`Cellar is unreachable: ${e.message}`);
    }
    if (res.status === 404) {
        throw new ArgumentError(`Cellar has no "${accept}" for CELEX ${celex} in language ${lang3} (404). Try another --as or --lang.`);
    }
    if (!res.ok) throw new CommandExecutionError(`Cellar answered HTTP ${res.status}`);
    return res.text();
}

export async function sparql(query) {
    const url = new URL(SPARQL);
    url.searchParams.set('query', query);
    url.searchParams.set('format', 'application/sparql-results+json');
    let res;
    try {
        res = await fetch(url, { headers: { accept: 'application/sparql-results+json', 'user-agent': UA } });
    } catch (e) {
        throw new CommandExecutionError(`SPARQL endpoint is unreachable: ${e.message}`);
    }
    if (res.status === 400) throw new ArgumentError('the SPARQL endpoint rejected the query (HTTP 400): check the syntax');
    if (!res.ok) throw new CommandExecutionError(`SPARQL endpoint answered HTTP ${res.status}`);
    try {
        return await res.json();
    } catch {
        throw new CommandExecutionError('non-JSON response from the SPARQL endpoint');
    }
}

/** XHTML act body to readable plain text. */
export function xhtmlToText(xhtml) {
    return xhtml
        .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
        .replace(/<\/(p|div|tr|h[1-6]|li)>/gi, '\n')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
        .replace(/[ \t ]+/g, ' ')
        .replace(/\n\s*\n\s*\n+/g, '\n\n')
        .trim();
}
