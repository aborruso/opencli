// Latest legislative events across all files.
import { cli, Strategy } from '@jackwener/opencli/registry';
import { EmptyResultError } from '@jackwener/opencli/errors';
import { apiGet, parseIntArg, procedureUrlFor } from './shared.js';

cli({
    site: 'law-tracker',
    name: 'events',
    access: 'read',
    description: 'Latest legislative events (all files)',
    example: 'opencli law-tracker events --limit 10',
    domain: 'law-tracker.europa.eu',
    strategy: Strategy.PUBLIC,
    browser: false,
    args: [
        { name: 'limit', type: 'int', default: 20, help: 'How many events to return' },
        { name: 'offset', type: 'int', default: 0, help: 'Zero-based offset into the result set' },
        { name: 'lang', type: 'string', default: 'en', help: 'Interface language' },
    ],
    columns: ['reference', 'initiationDate', 'event', 'title', 'url'],
    func: async (args) => {
        const limit = parseIntArg(args.limit ?? 20, 'limit', { min: 1, max: 200 });
        const offset = parseIntArg(args.offset ?? 0, 'offset', { min: 0 });
        const lang = args.lang ?? 'en';
        const rows = await apiGet('/events/recent', { startingPosition: offset, size: limit }, lang);
        if (!Array.isArray(rows) || rows.length === 0) {
            throw new EmptyResultError('law-tracker events', 'No events returned');
        }
        return rows.map((r) => ({
            reference: r.reference ?? null,
            initiationDate: r.initiationDate ?? null,
            event: r.event ?? null,
            title: r.title ?? null,
            url: procedureUrlFor(r.reference, lang),
        }));
    },
});
