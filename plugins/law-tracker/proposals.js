// Ultime proposte legislative della Commissione (feed della homepage).
import { cli, Strategy } from '@jackwener/opencli/registry';
import { EmptyResultError } from '@jackwener/opencli/errors';
import { apiGet, parseIntArg, procedureUrlFor } from './shared.js';

cli({
    site: 'law-tracker',
    name: 'proposals',
    access: 'read',
    description: 'Ultime proposte legislative della Commissione europea',
    example: 'opencli law-tracker proposals --limit 10',
    domain: 'law-tracker.europa.eu',
    strategy: Strategy.PUBLIC,
    browser: false,
    args: [
        { name: 'limit', type: 'int', default: 20, help: 'Numero di proposte da restituire' },
        { name: 'offset', type: 'int', default: 0, help: 'Scorrimento zero-based nel risultato' },
        { name: 'lang', type: 'string', default: 'en', help: 'Lingua dell\'interfaccia' },
    ],
    columns: ['reference', 'initiationDate', 'title', 'url'],
    func: async (args) => {
        const limit = parseIntArg(args.limit ?? 20, 'limit', { min: 1, max: 200 });
        const offset = parseIntArg(args.offset ?? 0, 'offset', { min: 0 });
        const lang = args.lang ?? 'en';
        // startingPosition e size vanno mandati sempre, anche per la prima pagina.
        const rows = await apiGet('/proposals/recent', { startingPosition: offset, size: limit }, lang);
        if (!Array.isArray(rows) || rows.length === 0) {
            throw new EmptyResultError('law-tracker proposals', 'Nessuna proposta restituita');
        }
        return rows.map((r) => ({
            reference: r.reference ?? null,
            initiationDate: r.initiationDate ?? null,
            title: r.title ?? null,
            url: procedureUrlFor(r.reference, lang),
        }));
    },
});
