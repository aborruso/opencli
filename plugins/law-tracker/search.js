// Ricerca nel database legislativo (POST /search), con i filtri della Advanced Search.
import { cli, Strategy } from '@jackwener/opencli/registry';
import { ArgumentError, EmptyResultError } from '@jackwener/opencli/errors';
import { apiPost, parseIntArg, splitList, stripHighlight, toApiRef, procedureUrlFor } from './shared.js';

const STATUS_CODES = ['ong', 'ado', 'nad', 'wit'];

/**
 * Il backend filtra in modo diverso a seconda che riceva o meno l'envelope
 * SearchCriteria completo: un body sparso dà conteggi incoerenti rispetto a
 * quello che manda la UI. Si parte quindi sempre dall'envelope pieno.
 */
function baseBody(size) {
    return {
        quickSearch: null, title: null, keywords: [], procedure: null, document: null,
        topics: null, legal: null, events: [], status: null, stage: [], institution: null,
        prioritySearch: null, cellarIds: [],
        sort: { order: 'REL', direction: 'ASC' },
        page: '0', size, countResults: false, facetSearch: false, version: null,
    };
}

cli({
    site: 'law-tracker',
    name: 'search',
    access: 'read',
    description: 'Cerca procedure legislative (testo libero + filtri della Advanced Search)',
    example: 'opencli law-tracker search "artificial intelligence" --status ong --stage FR',
    domain: 'law-tracker.europa.eu',
    strategy: Strategy.PUBLIC,
    browser: false,
    args: [
        { name: 'query', type: 'string', positional: true, required: false, help: 'Testo libero (quick search)' },
        { name: 'title', type: 'string', help: 'Cerca solo nel titolo' },
        { name: 'procedure', type: 'string', help: 'Reference di procedura, es. 2021/0106(COD)' },
        { name: 'status', type: 'string', help: `Stato, anche multiplo separato da virgola: ${STATUS_CODES.join('/')}` },
        { name: 'stage', type: 'string', help: 'Fase, separata da virgola: PR, FR, SR, CTR, EOP' },
        { name: 'eurovoc', type: 'string', help: 'Topic EuroVoc come CODICE,TIPO (es. "52,DOM"); più topic separati da ";"' },
        { name: 'policyArea', type: 'string', help: 'Codici policy area separati da virgola (es. 01,0107)' },
        { name: 'keyword', type: 'string', help: 'Parole chiave separate da virgola' },
        { name: 'sort', type: 'string', default: 'REL', help: 'Ordinamento: REL (rilevanza) o DATE' },
        { name: 'direction', type: 'string', default: 'ASC', help: 'Direzione: ASC o DESC' },
        { name: 'page', type: 'int', default: 0, help: 'Pagina zero-based' },
        { name: 'size', type: 'int', default: 20, help: 'Risultati per pagina (il backend tetta intorno a 20)' },
        { name: 'lang', type: 'string', default: 'en', help: 'Lingua dell\'interfaccia' },
    ],
    columns: ['reference', 'status', 'currentStage', 'initiationDate', 'title', 'url'],
    func: async (args) => {
        const lang = args.lang ?? 'en';
        const size = parseIntArg(args.size ?? 20, 'size', { min: 1, max: 100 });
        const page = parseIntArg(args.page ?? 0, 'page', { min: 0 });
        const body = baseBody(size);
        body.page = String(page);

        const sort = String(args.sort ?? 'REL').toUpperCase();
        if (!['REL', 'DATE'].includes(sort)) throw new ArgumentError('sort deve essere REL o DATE');
        const direction = String(args.direction ?? 'ASC').toUpperCase();
        if (!['ASC', 'DESC'].includes(direction)) throw new ArgumentError('direction deve essere ASC o DESC');
        body.sort = { order: sort, direction };

        const freeText = args.query || args.title;
        const hasStatus = splitList(args.status).length > 0;
        const hasStage = splitList(args.stage).length > 0;
        if (freeText && (hasStatus || hasStage)) {
            // Verificato dal vivo: con quickSearch o title valorizzati il backend
            // IGNORA status e stage e restituisce righe che non rispettano il filtro.
            // Meglio rifiutare che consegnare righe sbagliate senza dirlo.
            throw new ArgumentError('status e stage vengono ignorati dal backend quando c\'è testo libero: usa --keyword al posto della query, oppure togli --status/--stage');
        }
        if (args.query) body.quickSearch = String(args.query);
        if (args.title) body.title = String(args.title);

        if (args.procedure) {
            const [year, number] = toApiRef(args.procedure).split('_');
            // referenceType resta null: mandando il tipo (es. COD) il backend torna zero risultati.
            body.procedure = { referenceYear: [year], referenceNumber: number, referenceType: null };
        }

        const statuses = splitList(args.status).map((s) => s.toLowerCase());
        for (const s of statuses) {
            if (!STATUS_CODES.includes(s)) throw new ArgumentError(`status "${s}" non valido: attesi ${STATUS_CODES.join(', ')}`);
        }
        // Forma verificata: status è un OGGETTO {type:[codici]}; una stringa nuda dà 400.
        if (statuses.length) body.status = { type: statuses };

        const stages = splitList(args.stage).map((s) => s.toUpperCase());
        if (stages.length) body.stage = stages;

        const keywords = splitList(args.keyword);
        if (keywords.length) body.keywords = keywords;

        const eurovocRaw = String(args.eurovoc ?? '').split(';').map((s) => s.trim()).filter(Boolean);
        const policyAreas = splitList(args.policyArea);
        if (eurovocRaw.length || policyAreas.length) {
            const eurovoc = eurovocRaw.map((e) => {
                const parts = e.split(',');
                if (parts.length !== 2 || !parts[1]) {
                    throw new ArgumentError(`eurovoc "${e}" non valido: atteso CODICE,TIPO come lo stampa "opencli law-tracker topics eurovoc"`);
                }
                return { code: parts[0].trim(), type: parts[1].trim() };
            });
            body.topics = { eurovoc, policyArea: policyAreas, includeSublevels: true };
        }

        const res = await apiPost('/search', body, lang);
        const rows = Array.isArray(res?.searchResults) ? res.searchResults : [];
        if (rows.length === 0) {
            throw new EmptyResultError('law-tracker search', 'Nessuna procedura corrisponde ai filtri');
        }
        return rows.map((r) => {
            const current = Array.isArray(r.stages) ? r.stages.find((s) => s.current) : null;
            return {
                reference: r.reference ?? null,
                status: r.status ?? null,
                currentStage: current?.code ?? null,
                initiationDate: r.initiationDate ?? null,
                title: stripHighlight(r.titleShort || r.title),
                url: procedureUrlFor(r.reference, lang),
            };
        });
    },
});
