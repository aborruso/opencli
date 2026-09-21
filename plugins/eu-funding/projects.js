// The Projects & Results service: EU-funded projects, with budget,
// contribution, coordinator and the countries of the consortium.
import { cli, Strategy } from '@jackwener/opencli/registry';
import { EmptyResultError } from '@jackwener/opencli/errors';
import {
    KEYS, first, day, parseJson, codes, checkLimit, rawQuery, boolQuery, terms,
    search, facets, labelMaps, decode, programmeCodes,
} from './shared.js';

// This index writes its statuses as words, not codes.
const STATUS = { ongoing: 'Ongoing', ended: 'Ended', forthcoming: 'Forthcoming', suspended: 'Suspended' };

cli({
    site: 'eu-funding',
    name: 'projects',
    access: 'read',
    description: 'Search EU-funded projects of the Funding & Tenders Portal: budget, EU contribution, coordinator, countries (Projects & Results API, no browser)',
    example: 'opencli eu-funding projects "digital twin" --programme "horizon europe" --status ongoing --limit 5',
    domain: 'ec.europa.eu',
    strategy: Strategy.PUBLIC,
    browser: false,
    args: [
        { name: 'text', type: 'string', positional: true, required: false, help: 'Free text, searched in titles, acronyms and objectives' },
        { name: 'programme', type: 'string', default: '', help: 'Programme name (e.g. "horizon europe", "LIFE") or code (43108390). Comma-separated for more than one' },
        { name: 'status', type: 'string', default: '', help: `Comma-separated: ${Object.keys(STATUS).join(', ')}. Default: all` },
        { name: 'topic', type: 'string', default: '', help: 'Topic identifier, e.g. HORIZON-MISS-2022-OCEAN-01-01' },
        { name: 'call', type: 'string', default: '', help: 'Call identifier, e.g. HORIZON-CL5-2022-D3-01' },
        { name: 'query', type: 'string', default: '', help: 'Raw bool query in JSON, added to the filters above (e.g. missionGroup, crossCuttingPriorities, countries - see `codes --index projects`)' },
        { name: 'limit', type: 'int', default: 20, help: 'How many projects; pages over the API cap of 100 as needed' },
    ],
    defaultFormat: 'json',
    columns: ['id', 'acronym', 'title', 'programme', 'status', 'start', 'end', 'eu_contribution', 'overall_budget', 'coordinator', 'countries', 'call', 'topic', 'url'],
    footerExtra: (kwargs) => (kwargs._total != null ? `${kwargs._total} projects in total` : undefined),
    func: async (args) => {
        const limit = checkLimit(args.limit);
        const programmes = await programmeCodes(args.programme, KEYS.projects, 'programId');
        const query = boolQuery([
            terms('programId', programmes),
            terms('status', codes('--status', args.status, STATUS)),
            args.topic ? terms('topicAbbreviation', [String(args.topic).trim()]) : null,
            args.call ? terms('callIdentifier', [String(args.call).trim()]) : null,
        ], rawQuery(args.query));
        const [{ results, total }, facetList] = await Promise.all([
            search({ key: KEYS.projects, text: args.text, query, limit }),
            facets({ key: KEYS.projects, query }),
        ]);
        if (!results.length) throw new EmptyResultError('eu-funding projects', 'no project matches');
        args._total = total;
        const label = labelMaps(facetList);
        return results.map((r) => {
            const m = r.metadata ?? {};
            const participants = parseJson(m.participants) ?? [];
            const coordinator = participants.find((p) => /coordinator/i.test(String(p.role ?? '')));
            return {
                id: first(m.projectId),
                acronym: first(m.acronym),
                title: first(m.title) || r.summary,
                programme: first(m.programAbbreviation) || decode(m.programId, label.get('programId')),
                status: first(m.status),
                start: day(m.startDate),
                end: day(m.endDate),
                eu_contribution: first(m.euContributionAmount),
                overall_budget: first(m.overallBudget),
                coordinator: coordinator?.legalName ?? '',
                countries: decode(m.countries, label.get('countries')),
                call: first(m.callIdentifier),
                topic: first(m.topicAbbreviation),
                // Some records prefix it with "uri -> ".
                url: String(r.url ?? first(m.url)).replace(/^uri -> /, ''),
            };
        });
    },
});
