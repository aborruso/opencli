// Tender search: one row per tender, with buyers, winners and the three kinds
// of amount the data carries.
import { cli, Strategy } from '@jackwener/opencli/registry';
import { ArgumentError, EmptyResultError } from '@jackwener/opencli/errors';
import { checkCountry, checkLimit, search, text, tenderRow } from './shared.js';

// Sort keys of the search body. Without --sort the server orders by last
// modification, newest first.
const SORTS = {
    modified: null,
    year: 'tenderYear',
    'final-price': 'finalPrice.netAmountEur',
    'bid-price': 'lots.bids.price.netAmountEur',
};

function checkYear(name, input) {
    if (input == null || input === '') return null;
    const y = Number(input);
    if (!Number.isInteger(y) || y < 1990 || y > 2100) throw new ArgumentError(`invalid --${name} "${input}": a four-digit year`);
    return y;
}

function cpvFilter(input) {
    const code = String(input).trim();
    // The server indexes the CPV code whole and by division: a 2-digit code
    // matches the division, an 8-digit one the full code, any other length
    // matches nothing (checked 2026-11-04: 72 → 499,864; 72000000 → 125,271).
    if (/^\d{2}$/.test(code)) return { field: 'cpvs.code.divisions', type: 'select', value: [code] };
    if (/^\d{8}$/.test(code)) return { field: 'cpvs.code', type: 'select', value: [code] };
    throw new ArgumentError(`invalid --cpv "${input}": 2 digits (a division, see \`opencli opentender sectors\`) or the full 8-digit code`);
}

cli({
    site: 'opentender',
    name: 'tenders',
    access: 'read',
    description: 'Search OpenTender tenders by title, buyer, supplier (name or record id), CPV, year and bid amount: one row per tender with buyers, winners and amounts (no browser)',
    example: 'opencli opentender tenders --supplier Palantir',
    domain: 'opentender.eu',
    strategy: Strategy.PUBLIC,
    browser: false,
    args: [
        { name: 'title', type: 'string', help: 'Words of the title in the original language, as a phrase; the last word may be a prefix' },
        { name: 'buyer', type: 'string', help: 'Contracting authority name, as a phrase; the last word may be a prefix' },
        { name: 'supplier', type: 'string', help: 'Bidder name, as a phrase; matches every spelling that starts the same way, so check the names in the winners column' },
        { name: 'buyer-id', type: 'string', help: 'Contracting authority record id, from `opencli opentender authorities`: exactly that record, no name matching' },
        { name: 'supplier-id', type: 'string', help: 'Supplier record id, from `opencli opentender companies`: exactly that record, no name matching' },
        { name: 'cpv', type: 'string', help: 'CPV code: 2 digits for a division, 8 for a full code. Italian tenders (ANAC data) carry no CPV' },
        { name: 'year-from', type: 'string', help: 'First tender year, inclusive' },
        { name: 'year-to', type: 'string', help: 'Last tender year, inclusive' },
        { name: 'min-bid', type: 'string', help: 'Keep tenders with at least one bid of this many EUR or more' },
        { name: 'country', type: 'string', default: 'all', help: 'Portal id (it, de, uk, eu, ...) or all; see `opencli opentender stats`' },
        { name: 'sort', type: 'string', default: 'modified', help: 'modified (newest first), year, final-price or bid-price, descending' },
        { name: 'limit', type: 'int', default: 20, help: 'Rows to return, at most 10000 (the server window)' },
    ],
    columns: ['id', 'country', 'year', 'date', 'title', 'buyers', 'winners', 'final_eur', 'estimated_eur', 'winning_bids_eur', 'cpv', 'procedure', 'source', 'url'],
    footerExtra: (kwargs) => (kwargs._total != null ? `${kwargs._total} tenders match` : undefined),
    func: async (args) => {
        const cc = checkCountry(args.country);
        const limit = checkLimit(args.limit);
        if (!(args.sort in SORTS)) throw new ArgumentError(`invalid --sort "${args.sort}": ${Object.keys(SORTS).join(', ')}`);

        const filters = [];
        if (args.title) filters.push(text('title', args.title));
        if (args.buyer) filters.push(text('buyers.name', args.buyer));
        if (args.supplier) filters.push(text('lots.bids.bidders.name', args.supplier));
        if (args['buyer-id']) filters.push({ field: 'buyers.id', type: 'select', value: [String(args['buyer-id']).trim()] });
        if (args['supplier-id']) filters.push({ field: 'lots.bids.bidders.id', type: 'select', value: [String(args['supplier-id']).trim()] });
        if (args.cpv) filters.push(cpvFilter(args.cpv));
        const from = checkYear('year-from', args['year-from']);
        const to = checkYear('year-to', args['year-to']);
        if (from != null && to != null && from > to) throw new ArgumentError(`--year-from ${from} is after --year-to ${to}`);
        if (from != null) filters.push({ field: 'tenderYear', type: 'value', mode: '>=', value: [from] });
        if (to != null) filters.push({ field: 'tenderYear', type: 'value', mode: '<=', value: [to] });
        if (args['min-bid'] != null && args['min-bid'] !== '') {
            const v = Number(args['min-bid']);
            if (!Number.isFinite(v) || v < 0) throw new ArgumentError(`invalid --min-bid "${args['min-bid']}": an amount in EUR`);
            filters.push({ field: 'lots.bids.price.netAmountEur', type: 'value', mode: '>=', value: [v] });
        }
        if (filters.length === 0) {
            throw new ArgumentError('give at least one filter: --title, --buyer, --supplier, --buyer-id, --supplier-id, --cpv, --year-from, --year-to or --min-bid');
        }

        const field = SORTS[args.sort];
        const { hits, total } = await search(cc, 'tender', filters, { limit, sort: field ? { field, ascend: false } : undefined });
        args._total = total;
        if (hits.length === 0) {
            throw new EmptyResultError('opentender tenders', 'no tender matches: names are matched as a phrase from the start of a word, try fewer words');
        }
        return hits.map((h) => tenderRow(cc, h._source ?? h));
    },
});
