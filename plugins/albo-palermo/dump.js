// Every document type at once, or a chosen set, as JSON Lines: one act per
// line, written as each type is read. Same rows as `list`, same cap of pages
// per type. OpenCLI has no JSON Lines format, so this command prints its own
// lines and returns nothing for the renderer; `-f` does not apply.
import { cli, Strategy } from '@jackwener/opencli/registry';
import { EmptyResultError } from '@jackwener/opencli/errors';
import { Session, COLUMNS, MAX_PAGES, resolveTypes, checkPages, collect, pool } from './shared.js';

cli({
    site: 'albo-palermo',
    name: 'dump',
    access: 'read',
    description: `Acts in publication of every document type, or of a list of types, as JSON Lines on stdout (at most ${MAX_PAGES} pages of 10 per type)`,
    example: 'opencli albo-palermo dump "Avviso Pubblico,2024" > albo.jsonl',
    domain: 'albopretorio.comune.palermo.it',
    strategy: Strategy.PUBLIC,
    browser: false,
    args: [
        { name: 'types', type: 'string', positional: true, required: false, help: 'Comma-separated TD codes or exact type names, e.g. "Avviso Pubblico,2024"; omit for every type' },
        { name: 'pages', type: 'int', default: MAX_PAGES, help: `List pages to read per type, 1 or ${MAX_PAGES}` },
    ],
    defaultFormat: 'json',
    columns: COLUMNS,
    func: async (args) => {
        const pages = checkPages(args.pages);
        const types = await resolveTypes(args.types);
        let written = 0;
        const notes = [];
        // Types in parallel within the pool, each in its own session; within a
        // type the pages and details stay sequential.
        await pool(types, async (t) => {
            const session = new Session();
            const { rows, total, pages: available } = await collect(session, await session.get(t.url), pages);
            for (const row of rows) process.stdout.write(`${JSON.stringify({ category: t.category, td: t.td, ...row })}\n`);
            written += rows.length;
            if (rows.length && total > rows.length) notes.push(`${t.td} ${t.type}: ${rows.length} of ${total} acts (${available} pages)`);
        });
        if (!written) throw new EmptyResultError('albo-palermo dump', 'no act in publication for these document types');
        process.stderr.write(`${written} acts from ${types.length} document type(s)\n`);
        if (notes.length) process.stderr.write(`cut at ${pages} page(s) per type:\n  ${notes.sort().join('\n  ')}\n`);
        return undefined;
    },
});
