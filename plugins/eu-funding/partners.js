// The Partner Search service: who published a partner search on a topic, and
// what they offer or ask for.
//
// The doc page's sample asks for records of type ORGANISATION and PERSON with
// the topic: that returns the publishers, each carrying its whole project
// history - 40 records weighed 51 MB on 2026-09-21. The announcements
// themselves are records of type ANNOUNCEMENT in the same index: light (2 kB
// each), with the text of the offer. They are the default here; the other
// two types stay one option away.
import { cli, Strategy } from '@jackwener/opencli/registry';
import { EmptyResultError } from '@jackwener/opencli/errors';
import {
    KEYS, PORTAL, first, all, day, text, codes, checkLimit, rawQuery, boolQuery, terms,
    search, facets, labelMaps, decode,
} from './shared.js';

const TYPE = { announcement: 'ANNOUNCEMENT', organisation: 'ORGANISATION', person: 'PERSON' };

cli({
    site: 'eu-funding',
    name: 'partners',
    access: 'read',
    description: 'Partner searches published on the EU Funding & Tenders Portal for a topic: who, from where, offering or requesting what (Partner Search API, no browser)',
    example: 'opencli eu-funding partners HORIZON-CL4-2022-RESILIENCE-01-08 --limit 5',
    domain: 'ec.europa.eu',
    strategy: Strategy.PUBLIC,
    browser: false,
    args: [
        { name: 'topic', type: 'string', positional: true, required: false, help: 'Topic identifier, e.g. HORIZON-CL4-2022-RESILIENCE-01-08. Without it, every partner search' },
        { name: 'text', type: 'string', default: '', help: 'Free text, e.g. a skill or a technology' },
        { name: 'type', type: 'string', default: 'announcement', help: `Comma-separated: ${Object.keys(TYPE).join(', ')}. organisation and person return the publishers rather than their announcements, and are heavy: each organisation carries its full project history` },
        { name: 'query', type: 'string', default: '', help: 'Raw bool query in JSON, added to the filters above' },
        { name: 'limit', type: 'int', default: 20, help: 'How many results; pages over the API cap of 100 as needed' },
    ],
    defaultFormat: 'json',
    columns: ['id', 'type', 'name', 'pic', 'country', 'organisation_type', 'expertise', 'date', 'topic', 'topic_title', 'summary', 'url'],
    footerExtra: (kwargs) => (kwargs._total != null ? `${kwargs._total} results in total` : undefined),
    func: async (args) => {
        const limit = checkLimit(args.limit);
        const topic = String(args.topic ?? '').trim();
        const query = boolQuery([
            topic ? terms('topics', [topic]) : null,
            terms('type', codes('--type', args.type, TYPE)),
        ], rawQuery(args.query));
        const [{ results, total }, facetList] = await Promise.all([
            search({ key: KEYS.partners, text: args.text, query, limit }),
            facets({ key: KEYS.partners, query }),
        ]);
        if (!results.length) throw new EmptyResultError('eu-funding partners', topic ? `no partner search for ${topic}` : 'no partner search matches');
        args._total = total;
        const label = labelMaps(facetList);
        return results.map((r) => {
            const m = r.metadata ?? {};
            const type = first(m.type);
            const pic = first(m.pic);
            const kind = first(m.announcementType) || type;
            return {
                id: first(m.announcementId) || pic,
                type: `${type.toLowerCase()}${type === 'ANNOUNCEMENT' && kind ? ` (${kind.toLowerCase()})` : ''}`,
                name: first(m.name) || (type === 'ANNOUNCEMENT' ? '' : r.summary),
                pic,
                country: decode(m.country, label.get('country')),
                organisation_type: decode(m.organisationType, label.get('organisationType')),
                expertise: decode(m.expertise, label.get('expertise')),
                // When the partner search was published. An organisation or a
                // person has only the date its profile last changed, which is
                // something else, so it stays empty for them.
                date: day(m.requestedDate),
                topic: type === 'ANNOUNCEMENT' ? all(m.topics) : '',
                topic_title: type === 'ANNOUNCEMENT' ? (first(m.title) || r.summary) : '',
                summary: text(m.announcementSummary) || all(m.keywords),
                // An announcement has no page of its own (its url is "NA"); an
                // organisation has one, keyed by PIC.
                url: pic && kind === 'ORGANISATION' ? `${PORTAL}/how-to-participate/org-details/${pic}` : '',
            };
        });
    },
});
