// The FAQ Details service: one FAQ in full, by its nid.
import { cli, Strategy } from '@jackwener/opencli/registry';
import { ArgumentError, EmptyResultError } from '@jackwener/opencli/errors';
import {
    KEYS, FAQ_STATUS, FAQ_TYPE,
    first, day, text, all, boolQuery, terms, search, facets, labelMaps, decode,
} from './shared.js';

const STATUS_LABEL = Object.fromEntries(Object.entries(FAQ_STATUS).map(([k, v]) => [v, k]));
const TYPE_LABEL = Object.fromEntries(Object.entries(FAQ_TYPE).map(([k, v]) => [v, k]));

cli({
    site: 'eu-funding',
    name: 'faq',
    access: 'read',
    description: 'One FAQ of the EU Funding & Tenders Portal in full, answer included (FAQ Details API, no browser)',
    example: 'opencli eu-funding faq 55257',
    domain: 'ec.europa.eu',
    strategy: Strategy.PUBLIC,
    browser: false,
    args: [
        { name: 'nid', type: 'string', positional: true, required: true, help: 'FAQ id: the `nid` column of `faqs`, or the number at the end of a portal FAQ url' },
    ],
    defaultFormat: 'json',
    columns: ['nid', 'type', 'question', 'answer', 'programme', 'categories', 'keywords', 'procedure', 'status', 'published', 'modified', 'archived', 'url'],
    func: async (args) => {
        const nid = String(args.nid ?? '').trim();
        if (!/^\d+$/.test(nid)) throw new ArgumentError(`invalid nid "${args.nid}": it is a number, e.g. 55257`);
        const query = boolQuery([terms('nid', [nid])]);
        const [{ results }, facetList] = await Promise.all([
            search({ key: KEYS.faqs, query, limit: 5 }),
            facets({ key: KEYS.faqs, query }),
        ]);
        const r = results.find((x) => first(x.metadata?.nid) === nid);
        // The doc page's own example, nid 755, returns nothing (2026-09-21).
        if (!r) throw new EmptyResultError(`eu-funding faq ${nid}`, 'no FAQ has this nid. Find one with `opencli eu-funding faqs`');
        const label = labelMaps(facetList);
        const m = r.metadata ?? {};
        const status = first(m.status);
        const type = first(m.type);
        return [{
            nid,
            type: TYPE_LABEL[type] ?? type,
            question: text(m.question) || r.summary,
            answer: text(m.answer),
            programme: decode(m.programme, label.get('programme')),
            categories: decode(m.categories, label.get('categories')),
            keywords: all(m.keyword),
            procedure: first(m.procedureId),
            status: STATUS_LABEL[status] ?? status,
            published: day(m.publicationDate),
            modified: day(m.modificationDate),
            archived: day(m.archivedDate),
            url: r.url ?? first(m.url),
        }];
    },
});
