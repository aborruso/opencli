// One tender: one row per bid of each lot, with the tender's header repeated.
import { cli, Strategy } from '@jackwener/opencli/registry';
import { checkCountry, getById, tenderRow, round2 } from './shared.js';

cli({
    site: 'opentender',
    name: 'tender',
    access: 'read',
    description: 'One OpenTender tender by id: one row per bid of each lot (bidder, winning, price), with the tender header (no browser)',
    example: 'opencli opentender tender 73a431a7-0bcd-49c7-b7be-94c5146752da',
    domain: 'opentender.eu',
    strategy: Strategy.PUBLIC,
    browser: false,
    args: [
        { name: 'id', positional: true, required: true, help: 'Tender id, from `opencli opentender tenders`' },
        { name: 'country', type: 'string', default: 'all', help: 'Portal id, only used for the page link' },
    ],
    columns: ['lot', 'lot_title', 'bidder', 'bidder_id', 'winning', 'bid_eur', 'id', 'country', 'year', 'title', 'buyers', 'final_eur', 'estimated_eur', 'source', 'url'],
    func: async (args) => {
        const cc = checkCountry(args.country);
        const t = await getById(cc, 'tender', String(args.id).trim());
        const head = tenderRow(cc, t);
        const header = {
            id: head.id, country: head.country, year: head.year, title: head.title, buyers: head.buyers,
            final_eur: head.final_eur, estimated_eur: head.estimated_eur, source: head.source, url: head.url,
        };
        const rows = [];
        (t.lots ?? []).forEach((lot, i) => {
            const bids = lot.bids ?? [];
            const base = { lot: i + 1, lot_title: lot.title ?? null };
            if (bids.length === 0) {
                rows.push({ ...base, bidder: null, bidder_id: null, winning: null, bid_eur: null, ...header });
                return;
            }
            for (const bid of bids) {
                const bidders = bid.bidders ?? [];
                rows.push({
                    ...base,
                    bidder: bidders.map((b) => b.name).filter(Boolean).join('; ') || null,
                    bidder_id: bidders.map((b) => b.id).filter(Boolean).join('; ') || null,
                    winning: bid.isWinning ?? null,
                    bid_eur: round2(bid.price?.netAmountEur),
                    ...header,
                });
            }
        });
        // A tender without lots still has a header worth showing.
        if (rows.length === 0) rows.push({ lot: null, lot_title: null, bidder: null, bidder_id: null, winning: null, bid_eur: null, ...header });
        return rows;
    },
});
