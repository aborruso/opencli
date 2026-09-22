// The acts of one document type currently in publication, each with its
// permanent link. The list itself has no link and no id: they are on the
// detail page, so this opens the detail of every row.
import { cli, Strategy } from '@jackwener/opencli/registry';
import { EmptyResultError } from '@jackwener/opencli/errors';
import { Session, COLUMNS, MAX_PAGES, listUrl, resolveType, checkPages, collect, footer } from './shared.js';

cli({
    site: 'albo-palermo',
    name: 'list',
    access: 'read',
    description: `Acts of one document type in publication on the Albo Pretorio of Palermo, newest first, with permanent link, sector and attachments (at most ${MAX_PAGES} pages of 10)`,
    example: 'opencli albo-palermo list "Avviso Pubblico"',
    domain: 'albopretorio.comune.palermo.it',
    strategy: Strategy.PUBLIC,
    browser: false,
    args: [
        { name: 'type', type: 'string', positional: true, required: true, help: 'Document type: its TD code or its exact name, e.g. 2024 or "Delibera Di Giunta Comunale"; see `opencli albo-palermo types`' },
        { name: 'pages', type: 'int', default: MAX_PAGES, help: `List pages to read, 1 or ${MAX_PAGES}; each page is 10 acts and 11 requests` },
    ],
    defaultFormat: 'json',
    columns: COLUMNS,
    footerExtra: footer,
    func: async (args) => {
        const { td: type } = await resolveType(args.type);
        const pages = checkPages(args.pages);
        const session = new Session();
        const { rows, total, pages: available } = await collect(session, await session.get(listUrl(type)), pages);
        if (!rows.length) {
            throw new EmptyResultError(`albo-palermo list ${type}`, 'no act in publication for this document type, or no such type. Codes and names: `opencli albo-palermo types`');
        }
        args._total = total;
        args._pages = available;
        return rows;
    },
});
