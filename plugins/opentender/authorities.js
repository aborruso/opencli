// Search OpenTender contracting authorities (buyers) by name. Every matching
// record is listed as it is: the same body can have one record per spelling
// of its name in the notices, and they are not merged here.
import { cli, Strategy } from '@jackwener/opencli/registry';
import { EmptyResultError } from '@jackwener/opencli/errors';
import { bodyRow, checkCountry, checkLimit, search, text } from './shared.js';

cli({
    site: 'opentender',
    name: 'authorities',
    access: 'read',
    description: 'Search OpenTender contracting authorities by name: one row per record, with contracts and their total value; one body can have several records, one per spelling (no browser)',
    example: 'opencli opentender authorities "Comune di Palermo" --country it',
    domain: 'opentender.eu',
    strategy: Strategy.PUBLIC,
    browser: false,
    args: [
        { name: 'name', positional: true, required: true, help: 'Name, as a phrase; the last word may be a prefix' },
        { name: 'country', type: 'string', default: 'all', help: 'Portal id (it, de, uk, eu, ...) or all; see `opencli opentender stats`' },
        { name: 'limit', type: 'int', default: 50, help: 'Rows to return, at most 10000 (the server window)' },
    ],
    columns: ['id', 'name', 'city', 'country', 'contracts', 'total_value_eur', 'years', 'url'],
    footerExtra: (kwargs) => (kwargs._total != null ? `${kwargs._total} records match` : undefined),
    func: async (args) => {
        const cc = checkCountry(args.country);
        const limit = checkLimit(args.limit);
        const { hits, total } = await search(cc, 'authority', [text('body.name', String(args.name))], { limit });
        args._total = total;
        if (hits.length === 0) {
            throw new EmptyResultError('opentender authorities', 'no record matches: names are matched as a phrase from the start of a word, try fewer words');
        }
        return hits.map((h) => bodyRow(cc, 'authority', h._source ?? h));
    },
});
