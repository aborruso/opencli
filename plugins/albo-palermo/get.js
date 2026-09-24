// One act, from its permanent link: the link the portal copies with "Copia"
// on the detail page, and the one `list` and `search` return.
import { cli, Strategy } from '@jackwener/opencli/registry';
import { EmptyResultError } from '@jackwener/opencli/errors';
import { Session, COLUMNS, actUrl, isDetail, parseDetail } from './shared.js';

cli({
    site: 'albo-palermo',
    name: 'get',
    access: 'read',
    description: 'One act of the Albo Pretorio of Palermo, from its permanent link (or its ALBCOD plus --type)',
    example: 'opencli albo-palermo get "https://albopretorio.comune.palermo.it/albopretorio/pu/push-tabella-delibere.do?nomeTabella=FO_SCEDELIBEREAP&TD=2024&ALBCOD=6271636078667F75657B&sportello=albopretorio"',
    domain: 'albopretorio.comune.palermo.it',
    strategy: Strategy.PUBLIC,
    browser: false,
    args: [
        { name: 'act', type: 'string', positional: true, required: true, help: 'The permanent link, or only its ALBCOD value (then --type is needed)' },
        { name: 'type', type: 'string', default: '', help: 'Document type, TD code or exact name, when `act` is a bare ALBCOD' },
    ],
    defaultFormat: 'json',
    columns: COLUMNS,
    func: async (args) => {
        const url = await actUrl(args.act, args.type);
        const html = await new Session().get(url);
        if (!isDetail(html)) {
            throw new EmptyResultError('albo-palermo get', 'the portal shows no act at this link: it may be out of publication, or TD and ALBCOD do not match');
        }
        return [parseDetail(html)];
    },
});
