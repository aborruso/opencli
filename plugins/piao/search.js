// PIAO records by administration name and/or IPA code.
import { cli, Strategy } from '@jackwener/opencli/registry';
import { ArgumentError, EmptyResultError } from '@jackwener/opencli/errors';
import { MAX_LIMIT, PIAO_COLUMNS, annoFilter, checkLimit, fetchPiao, piaoRow } from './shared.js';

cli({
    site: 'piao',
    name: 'search',
    access: 'read',
    description: 'Search PIAO plans (Piano Integrato di Attività e Organizzazione) by administration name and/or IPA code, one row per plan version (no browser, no key). For one administration use `piao ente`, for its files `piao docs`. attachments is a count; n_dipendenti is the raw Sì/No of the portal, which does not label it; one administration and triennium can have several versions',
    example: [
        'opencli piao search palermo',
        'opencli piao search "comune di palermo" --anno 2026',
        'opencli piao search --ipa c_g2 --anno 2025-2027 --limit 50',
    ].join('\n'),
    domain: 'piao.dfp.gov.it',
    strategy: Strategy.PUBLIC,
    browser: false,
    args: [
        { name: 'name', type: 'string', positional: true, help: 'Part of the administration name, server filter: case-insensitive substring, words as a phrase in this order (accented letters match literally: "citta\'" is how most names are stored)' },
        { name: 'ipa', type: 'string', help: 'Part of the IPA code, server filter: case-sensitive substring. With a name, both must match. For one exact code use `piao ente`' },
        { name: 'anno', type: 'string', help: 'Local filter, applied after the server filters: 2026 keeps every triennium covering that year, 2026-2028 only that triennium' },
        { name: 'limit', type: 'int', default: 20, help: `Rows to return after --anno, at most ${MAX_LIMIT}. Reads at most 200 portal pages of 6 records and fails, rather than returning a partial list, if that is not enough` },
    ],
    columns: PIAO_COLUMNS,
    footerExtra: (kwargs) => (kwargs._total != null ? `${kwargs._total} records match on the portal${kwargs.anno ? ', before --anno' : ''}` : undefined),
    func: async (args) => {
        const name = args.name?.trim();
        const ipa = args.ipa?.trim();
        if (!name && !ipa) throw new ArgumentError('give an administration name or --ipa; `opencli piao recent` lists without filters');
        const { records, total } = await fetchPiao({ name, ipa, keep: annoFilter(args.anno), limit: checkLimit(args.limit) });
        args._total = total;
        if (records.length === 0) {
            throw new EmptyResultError('piao search', total > 0 ? `${total} records match, none for --anno ${args.anno}` : 'no PIAO matches: names match as a phrase in the stored spelling; find the administration with `opencli piao enti`');
        }
        return records.map(piaoRow);
    },
});
