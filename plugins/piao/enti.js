// Administrations known to the portal, to find an IPA code.
import { cli, Strategy } from '@jackwener/opencli/registry';
import { ArgumentError, EmptyResultError } from '@jackwener/opencli/errors';
import { MAX_ADMINISTRATIONS, apiGet, checkLimit } from './shared.js';

cli({
    site: 'piao',
    name: 'enti',
    access: 'read',
    description: 'Find administrations on the PIAO portal by name or IPA code (no browser, no key). Next step: `opencli piao ente <ipa_code>`. A few codes appear under two spellings of the name',
    example: [
        'opencli piao enti palermo',
        'opencli piao enti --ipa c_g273',
    ].join('\n'),
    domain: 'piao.dfp.gov.it',
    strategy: Strategy.PUBLIC,
    browser: false,
    args: [
        { name: 'name', type: 'string', positional: true, help: 'Part of the name, server filter: case-insensitive substring, words as a phrase in this order' },
        { name: 'ipa', type: 'string', help: 'Part of the IPA code, server filter: case-sensitive substring. Use instead of a name, not with it' },
        { name: 'limit', type: 'int', default: 20, help: `Rows to return, at most ${MAX_ADMINISTRATIONS}. Order is the portal's, not alphabetical, and it gives no total: a footer says when the limit was reached` },
    ],
    columns: ['ipa_code', 'administration'],
    footerExtra: (kwargs) => (kwargs._full ? 'limit reached: more administrations may match, raise --limit' : undefined),
    func: async (args) => {
        const name = args.name?.trim();
        const ipa = args.ipa?.trim();
        if (Boolean(name) === Boolean(ipa)) throw new ArgumentError('give either an administration name or --ipa');
        const limit = checkLimit(args.limit, MAX_ADMINISTRATIONS);
        const filter = name ? `administrationName=${encodeURIComponent(name)}` : `ipaCode=${encodeURIComponent(ipa)}`;
        const json = await apiGet(`/api/administrations?${filter}&limit=${limit}`, 'the administrations list');
        const rows = json.result ?? [];
        if (rows.length === 0) throw new EmptyResultError('piao enti', 'no administration matches: names match as a phrase in the stored spelling, IPA codes are case-sensitive');
        args._full = rows.length === limit;
        return rows.map((r) => ({ ipa_code: r.administrationIpaCode, administration: r.administrationName?.trim() ?? null }));
    },
});
