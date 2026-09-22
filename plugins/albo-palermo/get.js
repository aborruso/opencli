// One act, from its permanent link: the link the portal copies with "Copia"
// on the detail page, and the one `list` and `search` return.
import { cli, Strategy } from '@jackwener/opencli/registry';
import { ArgumentError, EmptyResultError } from '@jackwener/opencli/errors';
import { Session, COLUMNS, permalink, isDetail, parseDetail, resolveType } from './shared.js';

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
        const act = String(args.act ?? '').trim();
        let url;
        if (/^https?:\/\//.test(act)) {
            const u = new URL(act);
            if (!u.searchParams.get('ALBCOD') || !u.searchParams.get('TD')) {
                throw new ArgumentError('this is not a permanent link of the Albo Pretorio: it needs TD and ALBCOD');
            }
            url = act;
        } else if (/^[0-9A-F]+$/i.test(act) && act.length % 2 === 0) {
            if (!args.type) throw new ArgumentError('a bare ALBCOD needs --type <TD>: the permanent link is built from both');
            url = permalink((await resolveType(args.type)).td, act.toUpperCase());
        } else {
            throw new ArgumentError(`"${act}" is neither a permanent link nor an ALBCOD (hex)`);
        }
        const html = await new Session().get(url);
        if (!isDetail(html)) {
            throw new EmptyResultError('albo-palermo get', 'the portal shows no act at this link: it may be out of publication, or TD and ALBCOD do not match');
        }
        return [parseDetail(html)];
    },
});
