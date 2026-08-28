// Search the legislative database (POST /search), with the Advanced Search filters.
import { cli, Strategy } from '@jackwener/opencli/registry';
import { ArgumentError, EmptyResultError } from '@jackwener/opencli/errors';
import { apiPost, parseIntArg, splitList, stripHighlight, toApiRef, procedureUrlFor } from './shared.js';

const STATUS_CODES = ['ong', 'ado', 'nad', 'wit'];

/**
 * The backend filters differently depending on whether it receives the full
 * SearchCriteria envelope: a sparse body yields counts inconsistent with the
 * ones the UI gets. So always start from the complete envelope.
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
    description: 'Search legislative procedures by free text OR by Advanced Search filters (the backend ignores --status/--stage when free text is present, so the two cannot be combined)',
    example: 'opencli law-tracker search --status ong --stage FR --size 20',
    domain: 'law-tracker.europa.eu',
    strategy: Strategy.PUBLIC,
    browser: false,
    args: [
        { name: 'query', type: 'string', positional: true, required: false, help: 'Free text (quick search)' },
        { name: 'title', type: 'string', help: 'Match the title only' },
        { name: 'procedure', type: 'string', help: 'Procedure reference, e.g. 2021/0106(COD)' },
        { name: 'status', type: 'string', help: `Status, comma-separated for several: ${STATUS_CODES.join('/')}. Cannot be combined with free text or --title` },
        { name: 'stage', type: 'string', help: 'Stage, comma-separated: PR, FR, SR, CTR, EOP. Cannot be combined with free text or --title' },
        { name: 'eurovoc', type: 'string', help: 'EuroVoc topic as CODE,TYPE (e.g. "52,DOM"); several topics separated by ";"' },
        { name: 'policyArea', type: 'string', help: 'Comma-separated policy-area codes (e.g. 01,0107)' },
        { name: 'keyword', type: 'string', help: 'Comma-separated keywords. Unlike --status/--stage this one does combine with free text' },
        { name: 'sort', type: 'string', default: 'REL', help: 'Ordering: REL (relevance) or DATE (document date)' },
        { name: 'direction', type: 'string', default: 'ASC', help: 'Direction: ASC or DESC' },
        { name: 'page', type: 'int', default: 0, help: 'Zero-based page' },
        { name: 'size', type: 'int', default: 20, help: 'Results per page (the backend caps around 20)' },
        { name: 'lang', type: 'string', default: 'en', help: 'Interface language' },
    ],
    columns: ['reference', 'status', 'currentStage', 'initiationDate', 'title', 'url'],
    func: async (args) => {
        const lang = args.lang ?? 'en';
        const size = parseIntArg(args.size ?? 20, 'size', { min: 1, max: 100 });
        const page = parseIntArg(args.page ?? 0, 'page', { min: 0 });
        const body = baseBody(size);
        body.page = String(page);

        const sort = String(args.sort ?? 'REL').toUpperCase();
        if (!['REL', 'DATE'].includes(sort)) throw new ArgumentError('sort must be REL or DATE');
        const direction = String(args.direction ?? 'ASC').toUpperCase();
        if (!['ASC', 'DESC'].includes(direction)) throw new ArgumentError('direction must be ASC or DESC');
        // The backend does not know "DATE": date ordering is called DOCD.
        // Sending order:"DATE" answers HTTP 400. In the results-page URL, the
        // same ordering is spelled sort=DATE.
        body.sort = { order: sort === 'DATE' ? 'DOCD' : 'REL', direction };

        const freeText = args.query || args.title;
        const hasStatus = splitList(args.status).length > 0;
        const hasStage = splitList(args.stage).length > 0;
        if (freeText && (hasStatus || hasStage)) {
            // Verified live: with quickSearch or title set, the backend IGNORES
            // status and stage and returns rows that violate the filter.
            // Better to refuse than to hand over wrong rows silently.
            throw new ArgumentError('free text makes the backend ignore status and stage: use --keyword instead of the query, or drop --status/--stage');
        }
        if (args.query) body.quickSearch = String(args.query);
        if (args.title) body.title = String(args.title);

        if (args.procedure) {
            const [year, number] = toApiRef(args.procedure).split('_');
            // referenceType stays null: sending the type (e.g. COD) returns zero results.
            body.procedure = { referenceYear: [year], referenceNumber: number, referenceType: null };
        }

        const statuses = splitList(args.status).map((s) => s.toLowerCase());
        for (const s of statuses) {
            if (!STATUS_CODES.includes(s)) throw new ArgumentError(`invalid status "${s}": expected one of ${STATUS_CODES.join(', ')}`);
        }
        // Verified shape: status is an OBJECT {type:[codes]}; a bare string gives 400.
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
                    throw new ArgumentError(`invalid eurovoc "${e}": expected CODE,TYPE as printed by "opencli law-tracker topics eurovoc"`);
                }
                return { code: parts[0].trim(), type: parts[1].trim() };
            });
            body.topics = { eurovoc, policyArea: policyAreas, includeSublevels: true };
        }

        const res = await apiPost('/search', body, lang);
        const rows = Array.isArray(res?.searchResults) ? res.searchResults : [];
        if (rows.length === 0) {
            throw new EmptyResultError('law-tracker search', 'No procedure matches these filters');
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
