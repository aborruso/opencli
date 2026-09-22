// The portal's own filter on one document type: subject text, year and number
// of protocol, sector. The same row shape as `list`, permanent link included.
import { cli, Strategy } from '@jackwener/opencli/registry';
import { ArgumentError, CommandExecutionError, EmptyResultError } from '@jackwener/opencli/errors';
import {
    Session, COLUMNS, MAX_PAGES, listUrl, resolveType, checkPages, collect, footer,
    options, isDetail, parseDetail, rowIndexes,
} from './shared.js';

/** A sector by code, or by a piece of its name that picks exactly one. */
function sectorCode(value, sectors) {
    const s = String(value).trim();
    if (sectors.some((o) => o.value === s)) return s;
    const hits = sectors.filter((o) => o.label.toLowerCase().includes(s.toLowerCase()));
    if (hits.length === 1) return hits[0].value;
    const list = (hits.length ? hits : sectors).map((o) => `${o.value} ${o.label}`).join('; ');
    throw new ArgumentError(`--sector "${s}" matches ${hits.length ? `${hits.length} sectors` : 'no sector'} of this document type: ${list}`);
}

cli({
    site: 'albo-palermo',
    name: 'search',
    access: 'read',
    description: `Search the acts of one document type on the Albo Pretorio of Palermo by subject, protocol year and number, or sector (the portal's filter; at most ${MAX_PAGES} pages of 10)`,
    example: 'opencli albo-palermo search 2024 --text "variazione peg"',
    domain: 'albopretorio.comune.palermo.it',
    strategy: Strategy.PUBLIC,
    browser: false,
    args: [
        { name: 'type', type: 'string', positional: true, required: true, help: 'Document type: its TD code or its exact name, e.g. "Avviso Pubblico"; see `opencli albo-palermo types`' },
        { name: 'text', type: 'string', default: '', help: 'Text contained in the subject, case-insensitive; words are matched as one phrase' },
        { name: 'year', type: 'string', default: '', help: 'Protocol year; only the years with acts in publication are accepted' },
        { name: 'number', type: 'string', default: '', help: 'Protocol number' },
        { name: 'sector', type: 'string', default: '', help: 'Sector code, or a piece of its name that picks one sector (e.g. "segreteria")' },
        { name: 'pages', type: 'int', default: MAX_PAGES, help: `Result pages to read, 1 or ${MAX_PAGES}` },
    ],
    defaultFormat: 'json',
    columns: COLUMNS,
    footerExtra: footer,
    func: async (args) => {
        const { td: type } = await resolveType(args.type);
        const pages = checkPages(args.pages);
        const text = String(args.text ?? '').trim();
        const number = String(args.number ?? '').trim();
        if (!text && !number && !args.year && !args.sector) {
            throw new ArgumentError('give at least one of --text, --year, --number, --sector; for everything use `list`');
        }
        if (number && !/^\d+$/.test(number)) throw new ArgumentError('--number wants digits only');

        // The filter lives in the session: open the list, then the filter form,
        // which also carries the years and sectors this type accepts.
        const session = new Session();
        await session.get(listUrl(type));
        const form = await session.post('tabella-filtro.do');
        const fields = { ALB_DESOGGETTO: text, ALB_NUMPROT: number, ALB_DESANNOPROT: '', SET_COD: '' };
        if (args.year) {
            const years = options(form, 'ALB_DESANNOPROT').map((o) => o.value);
            const year = String(args.year).trim();
            if (!years.includes(year)) throw new ArgumentError(`--year ${year}: acts in publication for this type have protocol years ${years.join(', ') || 'none'}`);
            fields.ALB_DESANNOPROT = year;
        }
        if (args.sector) fields.SET_COD = sectorCode(args.sector, options(form, 'SET_COD'));

        const html = await session.post('tabella-ricerca.do', { ...fields, siglaStato: 'R' });
        // One match: the portal skips the list and opens the act.
        if (isDetail(html)) {
            args._total = 1;
            args._pages = 1;
            return [parseDetail(html)];
        }
        if (/errori interni/.test(html)) throw new CommandExecutionError('albo-palermo: the portal answered "errori interni" to this search');
        if (!rowIndexes(html).length) throw new EmptyResultError(`albo-palermo search ${type}`, 'no act in publication matches. The filters are ANDed');
        const { rows, total, pages: available } = await collect(session, html, pages);
        args._total = total;
        args._pages = available;
        return rows;
    },
});
