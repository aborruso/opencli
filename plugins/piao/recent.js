// The portal's default list, as its home view shows it.
import { cli, Strategy } from '@jackwener/opencli/registry';
import { EmptyResultError } from '@jackwener/opencli/errors';
import { MAX_LIMIT, PIAO_COLUMNS, checkLimit, fetchPiao, piaoRow } from './shared.js';

cli({
    site: 'piao',
    name: 'recent',
    access: 'read',
    description: 'The latest PIAO plans in the portal\'s own order, one row per plan version (no browser, no key). The portal titles this "Ultimi documenti approvati", but rows are not sorted by approval_date: they look like most recently loaded first, and the portal does not say. Same output as `piao search`',
    example: 'opencli piao recent --limit 12',
    domain: 'piao.dfp.gov.it',
    strategy: Strategy.PUBLIC,
    browser: false,
    args: [
        { name: 'limit', type: 'int', default: 20, help: `Rows to return, at most ${MAX_LIMIT}` },
    ],
    columns: PIAO_COLUMNS,
    footerExtra: (kwargs) => (kwargs._total != null ? `${kwargs._total} records on the portal` : undefined),
    func: async (args) => {
        const { records, total } = await fetchPiao({ limit: checkLimit(args.limit) });
        args._total = total;
        if (records.length === 0) throw new EmptyResultError('piao recent', 'the portal returned no records');
        return records.map(piaoRow);
    },
});
