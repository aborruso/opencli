// The Grant Updates service: the news the portal posts on calls - deadline
// extensions, clarifications, evaluation results - newest first.
import { cli, Strategy } from '@jackwener/opencli/registry';
import { EmptyResultError } from '@jackwener/opencli/errors';
import {
    KEYS, PORTAL, UPDATE_TYPE,
    first, day, text, checkLimit, rawQuery, boolQuery, terms,
    search, labels, programmeCodes,
} from './shared.js';

cli({
    site: 'eu-funding',
    name: 'updates',
    access: 'read',
    description: 'Updates the EU Funding & Tenders Portal posts on calls (extensions, clarifications, results), newest first (Grant Updates API, no browser)',
    example: 'opencli eu-funding updates --programme "horizon europe" --limit 5',
    domain: 'ec.europa.eu',
    strategy: Strategy.PUBLIC,
    browser: false,
    args: [
        { name: 'text', type: 'string', positional: true, required: false, help: 'Free text, e.g. a topic or call identifier' },
        { name: 'programme', type: 'string', default: '', help: 'Programme name (e.g. "horizon europe") or code (43108390). Comma-separated for more than one' },
        { name: 'query', type: 'string', default: '', help: 'Raw bool query in JSON, added to the filters above' },
        { name: 'limit', type: 'int', default: 20, help: 'How many updates; pages over the API cap of 100 as needed' },
    ],
    defaultFormat: 'json',
    columns: ['date', 'identifier', 'title', 'call', 'programme', 'update', 'url'],
    footerExtra: (kwargs) => (kwargs._total != null ? `${kwargs._total} updates in total` : undefined),
    func: async (args) => {
        const limit = checkLimit(args.limit);
        const programmes = await programmeCodes(args.programme, KEYS.calls, 'frameworkProgramme');
        const query = boolQuery([terms('type', [UPDATE_TYPE]), terms('frameworkProgramme', programmes)], rawQuery(args.query));
        const [{ results, total }, programmeLabel] = await Promise.all([
            search({ key: KEYS.calls, text: args.text, query, sort: { field: 'startDate', order: 'DESC' }, limit }),
            labels(KEYS.calls, 'frameworkProgramme', query),
        ]);
        if (!results.length) throw new EmptyResultError('eu-funding updates', 'no update matches');
        args._total = total;
        return results.map((r) => {
            const m = r.metadata ?? {};
            const id = first(m.identifier);
            return {
                date: day(m.startDate),
                identifier: id,
                title: first(m.title) || r.summary,
                call: first(m.callIdentifier),
                programme: (m.frameworkProgramme ?? []).map((c) => programmeLabel.get(String(c)) ?? c).join('; '),
                update: text(m.description),
                // The record's own url is the topic's JSON file; the page is
                // what a person wants.
                url: id ? `${PORTAL}/opportunities/topic-details/${id}` : '',
            };
        });
    },
});
