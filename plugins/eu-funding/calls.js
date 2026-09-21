// The Grants & Tenders service: every call for proposals and every call for
// tenders of the portal, with filters by type, status, programme and call.
import { cli, Strategy } from '@jackwener/opencli/registry';
import { ArgumentError, EmptyResultError } from '@jackwener/opencli/errors';
import {
    KEYS, CALL_STATUS, CALL_TYPE, CALL_TYPE_LABEL,
    first, day, codes, checkLimit, rawQuery, boolQuery, terms,
    search, labels, programmeCodes,
} from './shared.js';

const STATUS_LABEL = Object.fromEntries(Object.entries(CALL_STATUS).map(([k, v]) => [v, k]));
const SORT = {
    deadline: { field: 'deadlineDate', order: 'ASC' },
    start: { field: 'startDate', order: 'DESC' },
    // The portal's own default order.
    status: { field: 'sortStatus', order: 'ASC' },
};

cli({
    site: 'eu-funding',
    name: 'calls',
    access: 'read',
    description: 'Search calls for proposals and calls for tenders of the EU Funding & Tenders Portal (Grants & Tenders API, no browser)',
    example: 'opencli eu-funding calls "artificial intelligence" --type grant --status open --programme "horizon europe" --limit 5',
    domain: 'ec.europa.eu',
    strategy: Strategy.PUBLIC,
    browser: false,
    args: [
        { name: 'text', type: 'string', positional: true, required: false, help: 'Free text. Put it in double quotes inside single quotes for an exact phrase: \'"green hydrogen"\'' },
        { name: 'type', type: 'string', default: 'grant,proposals,cascade,tender', help: `Comma-separated: ${Object.keys(CALL_TYPE).join(', ')}` },
        { name: 'status', type: 'string', default: 'open', help: `Comma-separated: ${Object.keys(CALL_STATUS).join(', ')}. The API code for forthcoming is 31094501 - the doc page's "only open" sample includes it` },
        { name: 'programme', type: 'string', default: '', help: 'Programme name (matched against the portal labels, e.g. "horizon europe", "LIFE") or its code (43108390). Comma-separated for more than one' },
        { name: 'call', type: 'string', default: '', help: 'Call identifier, e.g. HORIZON-CL5-2027-03' },
        { name: 'period', type: 'string', default: '', help: 'Programme period, e.g. "2021 - 2027"' },
        { name: 'deadline-after', type: 'string', default: '', help: 'Keep calls with at least one deadline on or after this date (YYYY-MM-DD). The status field is not always current: some "open" calls have deadlines years ago' },
        { name: 'sort', type: 'string', default: 'status', help: `Order: ${Object.keys(SORT).join(', ')} (status is the portal's default)` },
        { name: 'query', type: 'string', default: '', help: 'Raw bool query in JSON, added to the filters above - anything the API allows, e.g. the query the portal sends, copied from the browser' },
        { name: 'limit', type: 'int', default: 20, help: 'How many results; the API serves 100 per page and this pages as needed' },
    ],
    defaultFormat: 'json',
    columns: ['identifier', 'title', 'type', 'status', 'programme', 'call', 'opening', 'deadline', 'url'],
    footerExtra: (kwargs) => (kwargs._total != null ? `${kwargs._total} results in total` : undefined),
    func: async (args) => {
        const limit = checkLimit(args.limit);
        const sort = SORT[String(args.sort ?? 'status').toLowerCase()];
        if (!sort) throw new ArgumentError(`invalid --sort "${args.sort}": use ${Object.keys(SORT).join(', ')}`);
        const after = String(args['deadline-after'] ?? '').trim();
        if (after && !/^\d{4}-\d{2}-\d{2}$/.test(after)) throw new ArgumentError('--deadline-after wants YYYY-MM-DD');

        const programmes = await programmeCodes(args.programme, KEYS.calls, 'frameworkProgramme');
        const query = boolQuery([
            terms('type', codes('--type', args.type, CALL_TYPE)),
            terms('status', codes('--status', args.status, CALL_STATUS)),
            terms('frameworkProgramme', programmes),
            args.call ? { term: { callIdentifier: String(args.call).trim() } } : null,
            args.period ? { term: { programmePeriod: String(args.period).trim() } } : null,
            // A bare date does not compare: 2026 and 2099 give the same count,
            // the records that merely have a deadline (open tenders 1001 → 755).
            // Only the index's own timestamp format compares (→ 178; 2099 → 0).
            after ? { range: { deadlineDate: { gte: `${after}T00:00:00.000+0000` } } } : null,
        ], rawQuery(args.query));

        // The search and the programme labels in parallel: the facet call is
        // filtered by the same query, so it is small and quick (~1.5 s).
        const [{ results, total }, programmeLabel] = await Promise.all([
            search({ key: KEYS.calls, text: args.text, query, sort, limit }),
            labels(KEYS.calls, 'frameworkProgramme', query),
        ]);
        if (!results.length) {
            throw new EmptyResultError('eu-funding calls', 'no call matches. Free text and filters are ANDed; --status defaults to open only');
        }
        args._total = total;
        return results.map((r) => {
            const m = r.metadata ?? {};
            const type = first(m.type);
            const status = first(m.status);
            return {
                identifier: first(m.identifier) || r.reference,
                title: first(m.title) || r.summary,
                type: CALL_TYPE_LABEL[type] ?? type,
                status: STATUS_LABEL[status] ?? status,
                programme: (m.frameworkProgramme ?? []).map((c) => programmeLabel.get(String(c)) ?? c).join('; '),
                call: first(m.callIdentifier),
                opening: day(m.startDate),
                deadline: [...new Set((m.deadlineDate ?? []).map(day))].join('; '),
                url: r.url ?? first(m.url),
            };
        });
    },
});
