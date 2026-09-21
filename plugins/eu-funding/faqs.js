// The FAQ index service: the portal's FAQs, active and archived, with the
// short answer. The full answer is `faq <nid>`.
import { cli, Strategy } from '@jackwener/opencli/registry';
import { EmptyResultError } from '@jackwener/opencli/errors';
import {
    KEYS, FAQ_TYPE, FAQ_STATUS,
    first, day, text, codes, checkLimit, rawQuery, boolQuery, terms,
    search, facets, labelMaps, decode, programmeCodes,
} from './shared.js';

const STATUS_LABEL = Object.fromEntries(Object.entries(FAQ_STATUS).map(([k, v]) => [v, k]));
const TYPE_LABEL = Object.fromEntries(Object.entries(FAQ_TYPE).map(([k, v]) => [v, k]));

cli({
    site: 'eu-funding',
    name: 'faqs',
    access: 'read',
    description: 'Search the FAQs of the EU Funding & Tenders Portal, active and archived, with their short answer (FAQ Index API, no browser)',
    example: 'opencli eu-funding faqs "lump sum" --programme "horizon europe" --limit 5',
    domain: 'ec.europa.eu',
    strategy: Strategy.PUBLIC,
    browser: false,
    args: [
        { name: 'text', type: 'string', positional: true, required: false, help: 'Free text, searched in questions and answers' },
        { name: 'type', type: 'string', default: Object.keys(FAQ_TYPE).join(','), help: `Comma-separated: ${Object.keys(FAQ_TYPE).join(', ')}. tenders and grants are the general FAQs; tender-qa and topic-qa, 97% of the index, are the questions asked on one tender or one call topic` },
        { name: 'status', type: 'string', default: 'active,archived', help: `Comma-separated: ${Object.keys(FAQ_STATUS).join(', ')}` },
        { name: 'programme', type: 'string', default: '', help: 'Programme name (e.g. "horizon europe") or code. Comma-separated for more than one' },
        { name: 'query', type: 'string', default: '', help: 'Raw bool query in JSON, added to the filters above' },
        { name: 'limit', type: 'int', default: 20, help: 'How many FAQs; pages over the API cap of 100 as needed' },
    ],
    defaultFormat: 'json',
    columns: ['nid', 'type', 'question', 'short_answer', 'programme', 'categories', 'procedure', 'status', 'published', 'url'],
    footerExtra: (kwargs) => (kwargs._total != null ? `${kwargs._total} FAQs in total` : undefined),
    func: async (args) => {
        const limit = checkLimit(args.limit);
        const programmes = await programmeCodes(args.programme, KEYS.faqs, 'programme');
        const query = boolQuery([
            terms('type', codes('--type', args.type, FAQ_TYPE)),
            terms('status', codes('--status', args.status, FAQ_STATUS)),
            terms('programme', programmes),
        ], rawQuery(args.query));
        const [{ results, total }, facetList] = await Promise.all([
            search({ key: KEYS.faqs, text: args.text, query, limit }),
            facets({ key: KEYS.faqs, query }),
        ]);
        if (!results.length) throw new EmptyResultError('eu-funding faqs', 'no FAQ matches');
        args._total = total;
        const label = labelMaps(facetList);
        return results.map((r) => {
            const m = r.metadata ?? {};
            const status = first(m.status);
            const type = first(m.type);
            return {
                nid: first(m.nid),
                type: TYPE_LABEL[type] ?? type,
                question: text(m.question) || r.summary,
                short_answer: text(m.shortAnswer),
                programme: decode(m.programme, label.get('programme')),
                categories: decode(m.categories, label.get('categories')),
                // The tender a tender-qa FAQ belongs to: `topic <procedure>` opens it.
                procedure: first(m.procedureId),
                status: STATUS_LABEL[status] ?? status,
                published: day(m.publicationDate),
                url: r.url ?? first(m.url),
            };
        });
    },
});
