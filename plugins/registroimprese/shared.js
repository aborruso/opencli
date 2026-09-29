// Shared pieces of the registroimprese adapter.
import { request } from 'node:https';
import { CommandExecutionError } from '@jackwener/opencli/errors';

export const SITE = 'registroimprese';
export const DOMAIN = 'registroimprese.infocamere.it';
export const SEARCH_URL = `https://${DOMAIN}/web/guest/ricerca-libera-e-acquisto`;
export const SUGGEST_URL = 'https://risuggester.infocamere.it/raceSuggWeb/suggester';

// The F5 WAF in front of the suggester rejects a bare "Mozilla/5.0" with an
// HTML "Request Rejected" page; a full browser user agent passes.
export const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

// The suggester's three lists, as the site names them -> as the rows name them.
export const KINDS = { denom: 'name', attivita: 'activity', declaratorie: 'description' };

// The WAF in front of the suggester (F5) rejects Node's own fetch (undici)
// with "Request Rejected" whatever the headers, and answers a JavaScript
// challenge to a request without Origin. A plain node:https request with the
// headers a browser sends from the search page passes.
function get(url) {
    return new Promise((resolve, reject) => {
        const req = request(url, {
            headers: {
                'User-Agent': UA,
                Accept: 'application/json, text/javascript, */*; q=0.01',
                'Accept-Language': 'it-IT,it;q=0.9',
                Origin: `https://${DOMAIN}`,
                Referer: `https://${DOMAIN}/`,
            },
        }, (res) => {
            let body = '';
            res.setEncoding('utf8');
            res.on('data', (d) => { body += d; });
            res.on('end', () => resolve({ status: res.statusCode, body }));
        });
        req.on('error', reject);
        req.end();
    });
}

/**
 * The suggestions of the search box for a text: rows `{kind, term, ateco}`,
 * names first, then activities and descriptions. `ateco` is the site's
 * `payload`, the code it searches by when that entry is picked; null on names.
 */
export async function suggestions(text) {
    const { status, body } = await get(`${SUGGEST_URL}?lang=IT&app=RI&q=${encodeURIComponent(text)}`);
    if (status !== 200 || !body.startsWith('{')) {
        throw new CommandExecutionError(`registroimprese: the suggester answered HTTP ${status}${/Request Rejected/.test(body) ? ' "Request Rejected" (WAF)' : ''}`);
    }
    const data = JSON.parse(body).suggest ?? {};
    const rows = [];
    for (const [key, kind] of Object.entries(KINDS)) {
        const block = data[key]?.[text] ?? Object.values(data[key] ?? {})[0];
        for (const s of block?.suggestions ?? []) rows.push({ kind, term: s.term, ateco: s.payload || null });
    }
    return rows;
}

// The provinces of the page's own <select>, code -> name (2026-09-26).
export const PROVINCES = {
    AG: 'AGRIGENTO', AL: 'ALESSANDRIA', AN: 'ANCONA', AR: 'AREZZO', AP: 'ASCOLI PICENO', AT: 'ASTI', AV: 'AVELLINO',
    BA: 'BARI', BT: 'BARLETTA-ANDRIA-TRANI', BL: 'BELLUNO', BN: 'BENEVENTO', BG: 'BERGAMO', BI: 'BIELLA', BO: 'BOLOGNA',
    BZ: 'BOLZANO', BS: 'BRESCIA', BR: 'BRINDISI', CA: 'CAGLIARI', CL: 'CALTANISSETTA', CB: 'CAMPOBASSO', CE: 'CASERTA',
    CT: 'CATANIA', CZ: 'CATANZARO', CH: 'CHIETI', CO: 'COMO', CS: 'COSENZA', CR: 'CREMONA', KR: 'CROTONE', CN: 'CUNEO',
    EN: 'ENNA', FM: 'FERMO', FE: 'FERRARA', FI: 'FIRENZE', FG: 'FOGGIA', FC: "FORLI'-CESENA", FR: 'FROSINONE', GE: 'GENOVA',
    GO: 'GORIZIA', GR: 'GROSSETO', IM: 'IMPERIA', IS: 'ISERNIA', AQ: "L'AQUILA", SP: 'LA SPEZIA', LT: 'LATINA', LE: 'LECCE',
    LC: 'LECCO', LI: 'LIVORNO', LO: 'LODI', LU: 'LUCCA', MC: 'MACERATA', MN: 'MANTOVA', MS: 'MASSA-CARRARA', MT: 'MATERA',
    ME: 'MESSINA', MI: 'MILANO', MO: 'MODENA', MB: 'MONZA E DELLA BRIANZA', NA: 'NAPOLI', NO: 'NOVARA', NU: 'NUORO',
    OR: 'ORISTANO', PD: 'PADOVA', PA: 'PALERMO', PR: 'PARMA', PV: 'PAVIA', PG: 'PERUGIA', PU: 'PESARO E URBINO', PE: 'PESCARA',
    PC: 'PIACENZA', PI: 'PISA', PT: 'PISTOIA', PN: 'PORDENONE', PZ: 'POTENZA', PO: 'PRATO', RG: 'RAGUSA', RA: 'RAVENNA',
    RC: 'REGGIO DI CALABRIA', RE: "REGGIO NELL'EMILIA", RI: 'RIETI', RN: 'RIMINI', RM: 'ROMA', RO: 'ROVIGO', SA: 'SALERNO',
    SS: 'SASSARI', SV: 'SAVONA', SI: 'SIENA', SR: 'SIRACUSA', SO: 'SONDRIO', SU: 'SUD SARDEGNA', TA: 'TARANTO', TE: 'TERAMO',
    TR: 'TERNI', TO: 'TORINO', TP: 'TRAPANI', TN: 'TRENTO', TV: 'TREVISO', TS: 'TRIESTE', UD: 'UDINE', AO: "VALLE D'AOSTA",
    VA: 'VARESE', VE: 'VENEZIA', VB: 'VERBANO-CUSIO-OSSOLA', VC: 'VERCELLI', VR: 'VERONA', VV: 'VIBO VALENTIA', VI: 'VICENZA',
    VT: 'VITERBO',
};
