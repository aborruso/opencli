// Every PIAO of one administration, by exact IPA code.
import { cli, Strategy } from '@jackwener/opencli/registry';
import { PIAO_COLUMNS, latestOnly, piaoRow } from './shared.js';
import { loadEnte, ENTE_ARGS } from './ente-records.js';

cli({
    site: 'piao',
    name: 'ente',
    access: 'read',
    description: 'History of one administration on the PIAO portal by exact IPA code, one row per plan version (no browser, no key). Find the code with `opencli piao enti`; for the files use `opencli piao docs`. Same output as `piao search`',
    example: [
        'opencli piao ente c_g273',
        'opencli piao ente c_g273 --anno 2025-2027 --latest',
    ].join('\n'),
    domain: 'piao.dfp.gov.it',
    strategy: Strategy.PUBLIC,
    browser: false,
    args: ENTE_ARGS,
    columns: PIAO_COLUMNS,
    func: async (args) => {
        const records = await loadEnte('ente', args);
        return (args.latest ? latestOnly(records) : records).map(piaoRow);
    },
});
