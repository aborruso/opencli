// The eight sections of "Delibere e Ordinanze", with the codes the other
// commands take and how the daily dump reaches each one. No request.
import { cli, Strategy } from '@jackwener/opencli/registry';
import { SECTIONS, listUrl } from './shared.js';

const HOW = {
    list: 'list, newest first',
    year: 'filter only, no date field: the year',
    date: 'filter only: the protocol date',
};

cli({
    site: 'palermo-delibere',
    name: 'sections',
    access: 'read',
    description: 'The eight sections of the deliberations and ordinances archive of the Comune di Palermo, with the code the other commands take',
    example: 'opencli palermo-delibere sections -f table',
    domain: 'servizionline.comune.palermo.it',
    strategy: Strategy.PUBLIC,
    browser: false,
    args: [],
    defaultFormat: 'json',
    columns: ['code', 'name', 'access', 'url'],
    func: async () => SECTIONS.map((s) => ({ code: s.code, name: s.name, access: HOW[s.daily], url: listUrl(s) })),
});
