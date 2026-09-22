// The two index pages of the portal, as one table: every category and every
// document type in it, with the TD code the other commands take.
import { cli, Strategy } from '@jackwener/opencli/registry';
import { EmptyResultError } from '@jackwener/opencli/errors';
import { catalogue } from './shared.js';

cli({
    site: 'albo-palermo',
    name: 'types',
    access: 'read',
    description: 'Categories and document types of the Albo Pretorio of Palermo, with the TD code that `list` and `search` take',
    example: 'opencli albo-palermo types --category bandi',
    domain: 'albopretorio.comune.palermo.it',
    strategy: Strategy.PUBLIC,
    browser: false,
    args: [
        { name: 'category', type: 'string', default: '', help: 'Keep the categories whose name contains this text (case-insensitive), e.g. delibere' },
        { name: 'filter', type: 'string', default: '', help: 'Keep the document types whose name contains this text (case-insensitive), e.g. "avviso pubblico"' },
    ],
    defaultFormat: 'json',
    columns: ['category', 'type', 'td', 'url'],
    func: async (args) => {
        const category = String(args.category ?? '').trim().toLowerCase();
        const filter = String(args.filter ?? '').trim().toLowerCase();
        const rows = (await catalogue()).filter((t) =>
            (!category || t.category.toLowerCase().includes(category)) && (!filter || t.type.toLowerCase().includes(filter)));
        if (!rows.length) throw new EmptyResultError('albo-palermo types', 'no category or document type matches');
        return rows;
    },
});
