// Every document type at once, or a chosen set, as JSON Lines: one act per
// line, written as each type is read. Same rows as `list`; two pages per
// type, more for the types that publish more than 20 acts a day (DUMP_PAGES).
// OpenCLI has no JSON Lines format, so this command prints its own
// lines and returns nothing for the renderer; `-f` does not apply.
import { cli, Strategy } from '@jackwener/opencli/registry';
import { EmptyResultError, ArgumentError } from '@jackwener/opencli/errors';
import { Session, COLUMNS, MAX_PAGES, DUMP_PAGES, DUMP_PAGES_MAX, resolveTypes, collect, pool } from './shared.js';

cli({
    site: 'albo-palermo',
    name: 'dump',
    access: 'read',
    description: `Acts in publication of every document type, or of a list of types, as JSON Lines on stdout (${MAX_PAGES} pages of 10 per type, ${Object.entries(DUMP_PAGES).map(([td, n]) => `${n} for TD ${td}`).join(' and ')})`,
    example: 'opencli albo-palermo dump "Avviso Pubblico,2024" > albo.jsonl',
    domain: 'albopretorio.comune.palermo.it',
    strategy: Strategy.PUBLIC,
    browser: false,
    args: [
        { name: 'types', type: 'string', positional: true, required: false, help: 'Comma-separated TD codes or exact type names, e.g. "Avviso Pubblico,2024"; omit for every type' },
        { name: 'pages', type: 'int', default: 0, help: `List pages to read in every type, 1 to ${DUMP_PAGES_MAX}; default: ${MAX_PAGES}, ${Object.entries(DUMP_PAGES).map(([td, n]) => `${n} for TD ${td}`).join(' and ')}` },
    ],
    defaultFormat: 'json',
    columns: COLUMNS,
    func: async (args) => {
        const override = Number(args.pages);
        if (!Number.isInteger(override) || override < 0 || override > DUMP_PAGES_MAX) throw new ArgumentError(`--pages must be 1 to ${DUMP_PAGES_MAX}`);
        const types = await resolveTypes(args.types);
        let written = 0;
        const notes = [];
        // Types in parallel within the pool, each in its own session; within a
        // type the pages and details stay sequential.
        await pool(types, async (t) => {
            const session = new Session();
            const pages = override || DUMP_PAGES[t.td] || MAX_PAGES;
            const { rows, total, pages: available } = await collect(session, await session.get(t.url), pages);
            for (const row of rows) process.stdout.write(`${JSON.stringify({ category: t.category, td: t.td, ...row })}\n`);
            written += rows.length;
            if (rows.length && total > rows.length) notes.push(`${t.td} ${t.type}: ${rows.length} of ${total} acts (${pages} of ${available} pages)`);
        });
        if (!written) throw new EmptyResultError('albo-palermo dump', 'no act in publication for these document types');
        process.stderr.write(`${written} acts from ${types.length} document type(s)\n`);
        if (notes.length) process.stderr.write(`cut:\n  ${notes.sort().join('\n  ')}\n`);
        return undefined;
    },
});
