// Ultimi eventi legislativi su tutti i fascicoli.
import { cli, Strategy } from '@jackwener/opencli/registry';
import { EmptyResultError } from '@jackwener/opencli/errors';
import { apiGet, parseIntArg, procedureUrlFor } from './shared.js';

cli({
    site: 'law-tracker',
    name: 'events',
    access: 'read',
    description: 'Ultimi eventi legislativi (tutti i fascicoli)',
    example: 'opencli law-tracker events --limit 10',
    domain: 'law-tracker.europa.eu',
    strategy: Strategy.PUBLIC,
    browser: false,
    args: [
        { name: 'limit', type: 'int', default: 20, help: 'Numero di eventi da restituire' },
        { name: 'offset', type: 'int', default: 0, help: 'Scorrimento zero-based nel risultato' },
        { name: 'lang', type: 'string', default: 'en', help: 'Lingua dell\'interfaccia' },
    ],
    columns: ['reference', 'initiationDate', 'event', 'title', 'url'],
    func: async (args) => {
        const limit = parseIntArg(args.limit ?? 20, 'limit', { min: 1, max: 200 });
        const offset = parseIntArg(args.offset ?? 0, 'offset', { min: 0 });
        const lang = args.lang ?? 'en';
        const rows = await apiGet('/events/recent', { startingPosition: offset, size: limit }, lang);
        if (!Array.isArray(rows) || rows.length === 0) {
            throw new EmptyResultError('law-tracker events', 'Nessun evento restituito');
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
