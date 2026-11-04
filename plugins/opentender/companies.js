// Search OpenTender suppliers (companies that bid) by name. Every matching
// record is listed as it is: the same company often has one record per
// spelling of its name in the notices, and they are not merged here.
import { cli, Strategy } from '@jackwener/opencli/registry';
import { EmptyResultError } from '@jackwener/opencli/errors';
import { bodyRow, checkCountry, checkLimit, search, text } from './shared.js';

cli({
    site: 'opentender',
    name: 'companies',
    access: 'read',
    description: 'Search OpenTender suppliers by name: one row per record, with contracts and their total value; one company can have several records, one per spelling (no browser)',
    example: 'opencli opentender companies Palantir',
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
        const { hits, total } = await search(cc, 'company', [text('body.name', String(args.name))], { limit });
        args._total = total;
        if (hits.length === 0) {
            throw new EmptyResultError('opentender companies', 'no record matches: names are matched as a phrase from the start of a word, try fewer words');
        }
        return hits.map((h) => bodyRow(cc, 'company', h._source ?? h));
    },
});
