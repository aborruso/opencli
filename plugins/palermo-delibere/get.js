// One act, from its permanent link: the one "Copia" copies on the detail
// page, and the one every row of the other commands carries.
import { cli, Strategy } from '@jackwener/opencli/registry';
import { EmptyResultError } from '@jackwener/opencli/errors';
import { Session, COLUMNS, actUrl, isDetail, parseDetail } from './shared.js';

cli({
    site: 'palermo-delibere',
    name: 'get',
    access: 'read',
    description: 'One act of the deliberations and ordinances archive of the Comune di Palermo, from its permanent link (or its ALBCOD plus --section)',
    example: 'opencli palermo-delibere get "https://servizionline.comune.palermo.it/portcitt/pu/push-tabella-delibere.do?nomeTabella=FO_SCEDELIBERE&TD=DGC&ALBCOD=627E6A627A607C716675&sportello=portcitt"',
    domain: 'servizionline.comune.palermo.it',
    strategy: Strategy.PUBLIC,
    browser: false,
    args: [
        { name: 'act', type: 'string', positional: true, required: true, help: 'The permanent link, or only its ALBCOD value (then --section is needed)' },
        { name: 'section', type: 'string', default: '', help: 'Section code, when `act` is a bare ALBCOD' },
    ],
    defaultFormat: 'json',
    columns: COLUMNS,
    func: async (args) => {
        const { url, s } = actUrl(args.act, args.section);
        const html = await new Session().get(url);
        if (!isDetail(html)) throw new EmptyResultError('palermo-delibere get', 'the portal shows no act at this link: section and ALBCOD may not match');
        return [parseDetail(html, s)];
    },
});
