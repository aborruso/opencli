// Every document type at once, or a chosen set, as JSON Lines: one act per
// line, written as each type is read. Each list is sorted by publication
// start, newest first. Without --known: two pages per type, more for the
// types that publish more than 20 acts a day (DUMP_PAGES). With --known
// <archive>: only the acts not already in that archive, walking each list
// down to publications KNOWN_MARGIN_DAYS older than the archive's newest
// (KNOWN_PAGES_MAX pages at most).
// OpenCLI has no JSON Lines format, so this command prints its own
// lines and returns nothing for the renderer; `-f` does not apply.
import { readFileSync } from 'node:fs';
import { cli, Strategy } from '@jackwener/opencli/registry';
import { EmptyResultError, ArgumentError } from '@jackwener/opencli/errors';
import {
    Session, COLUMNS, MAX_PAGES, DUMP_PAGES, DUMP_PAGES_MAX, KNOWN_PAGES_MAX, KNOWN_MARGIN_DAYS,
    resolveTypes, collect, collectNew, sortByPublication, isDetail, actKey, pool,
} from './shared.js';

/** The keys of the acts in an archive in the shape of `dump`, and the newest publication start in it. */
function readKnown(path) {
    let raw;
    try {
        raw = readFileSync(path, 'utf8');
    } catch (e) {
        throw new ArgumentError(`--known ${path}: ${e.message}`);
    }
    const keys = new Set();
    let newest = '';
    for (const line of raw.split('\n')) {
        if (!line.trim()) continue;
        const r = JSON.parse(line);
        const k = actKey(r.td, r.number, r.date);
        if (k) keys.add(k);
        if (/^\d{4}-\d{2}-\d{2}$/.test(r.published_from ?? '') && r.published_from > newest) newest = r.published_from;
    }
    if (!newest) throw new ArgumentError(`--known ${path}: no act with a publication date in it`);
    const since = new Date(`${newest}T00:00:00Z`);
    since.setUTCDate(since.getUTCDate() - KNOWN_MARGIN_DAYS);
    return { keys, since: since.toISOString().slice(0, 10) };
}

cli({
    site: 'albo-palermo',
    name: 'dump',
    access: 'read',
    description: `Acts in publication of every document type, or of a list of types, as JSON Lines on stdout, newest publications first (${MAX_PAGES} pages of 10 per type, ${Object.entries(DUMP_PAGES).map(([td, n]) => `${n} for TD ${td}`).join(' and ')}; with --known, only the acts not in that archive)`,
    example: 'opencli albo-palermo dump --known albo-palermo.jsonl > new.jsonl',
    domain: 'albopretorio.comune.palermo.it',
    strategy: Strategy.PUBLIC,
    browser: false,
    args: [
        { name: 'types', type: 'string', positional: true, required: false, help: 'Comma-separated TD codes or exact type names, e.g. "Avviso Pubblico,2024"; omit for every type' },
        { name: 'pages', type: 'int', default: 0, help: `List pages to read in every type, 1 to ${DUMP_PAGES_MAX}; default: ${MAX_PAGES}, ${Object.entries(DUMP_PAGES).map(([td, n]) => `${n} for TD ${td}`).join(' and ')}. Ignored with --known` },
        { name: 'known', type: 'string', default: '', help: `An archive of earlier dumps (JSON Lines): print only the acts not in it, reading each list down to publications ${KNOWN_MARGIN_DAYS} days older than its newest act (at most ${KNOWN_PAGES_MAX} pages). No new act is not an error` },
    ],
    defaultFormat: 'json',
    columns: COLUMNS,
    func: async (args) => {
        const override = Number(args.pages);
        if (!Number.isInteger(override) || override < 0 || override > DUMP_PAGES_MAX) throw new ArgumentError(`--pages must be 1 to ${DUMP_PAGES_MAX}`);
        const known = args.known ? readKnown(String(args.known)) : null;
        const types = await resolveTypes(args.types);
        let written = 0;
        const notes = [];
        // Types in parallel within the pool, each in its own session; within a
        // type the pages and details stay sequential.
        await pool(types, async (t) => {
            const session = new Session();
            let first = await session.get(t.url);
            if (!isDetail(first)) first = await sortByPublication(session);
            let rows;
            if (known) {
                const r = await collectNew(session, first, t.td, known.keys, known.since, KNOWN_PAGES_MAX);
                rows = r.rows;
                if (r.capped) notes.push(`${t.td} ${t.type}: stopped at ${r.read} of ${r.pages} pages before reaching ${known.since} (${rows.length} new)`);
            } else {
                const pages = override || DUMP_PAGES[t.td] || MAX_PAGES;
                const r = await collect(session, first, pages);
                rows = r.rows;
                if (rows.length && r.total > rows.length) notes.push(`${t.td} ${t.type}: ${rows.length} of ${r.total} acts (${pages} of ${r.pages} pages)`);
            }
            for (const row of rows) process.stdout.write(`${JSON.stringify({ category: t.category, td: t.td, ...row })}\n`);
            written += rows.length;
        });
        if (!written && !known) throw new EmptyResultError('albo-palermo dump', 'no act in publication for these document types');
        process.stderr.write(`${written} ${known ? 'new ' : ''}acts from ${types.length} document type(s)${known ? `, ${known.keys.size} already known, down to publications of ${known.since}` : ''}\n`);
        if (notes.length) process.stderr.write(`${known ? 'capped' : 'cut'}:\n  ${notes.sort().join('\n  ')}\n`);
        return undefined;
    },
});
