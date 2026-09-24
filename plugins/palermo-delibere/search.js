// The portal's own filter on one section. Each section's form has its own
// fields: a flag the section does not have is refused, not ignored. The
// portal refuses a filter that matches too many acts: the year alone is
// enough for most sections, not for DDI.
import { cli, Strategy } from '@jackwener/opencli/registry';
import { ArgumentError, EmptyResultError } from '@jackwener/opencli/errors';
import { Session, COLUMNS, MAX_PAGES, section, runFilter, openForm, options, collect, checkPages, formDate } from './shared.js';

cli({
    site: 'palermo-delibere',
    name: 'search',
    access: 'read',
    description: `Search one section of the deliberations and ordinances archive of the Comune di Palermo with the portal's filter: subject, year, number, protocol date, sector (at most ${MAX_PAGES} pages of 10)`,
    example: 'opencli palermo-delibere search DGC --text "barriere architettoniche"',
    domain: 'servizionline.comune.palermo.it',
    strategy: Strategy.PUBLIC,
    browser: false,
    args: [
        { name: 'section', type: 'string', positional: true, required: true, help: 'Section code; see `opencli palermo-delibere sections`' },
        { name: 'text', type: 'string', default: '', help: 'Text contained in the subject, case-insensitive' },
        { name: 'year', type: 'string', default: '', help: 'Year of the act; only the years the section offers are accepted' },
        { name: 'number', type: 'string', default: '', help: 'Protocol number (not in OS and DCO)' },
        { name: 'date', type: 'string', default: '', help: 'Protocol date, YYYY-MM-DD (DDI and ODT only)' },
        { name: 'sector', type: 'string', default: '', help: 'Sector code, or a piece of its name that picks one sector (DDI only)' },
        { name: 'pages', type: 'int', default: MAX_PAGES, help: `Result pages to read, 1 or ${MAX_PAGES}` },
    ],
    defaultFormat: 'json',
    columns: COLUMNS,
    footerExtra: (kwargs) => (kwargs._total == null ? undefined : `${kwargs._total} acts match, ${kwargs._pages} pages of 10 on the portal`),
    func: async (args) => {
        const s = section(args.section);
        const pages = checkPages(args.pages);
        const fields = {};
        const text = String(args.text ?? '').trim();
        const number = String(args.number ?? '').trim();
        if (text) fields.ALB_DESOGGETTO = text;
        if (number) {
            if (!/^\d+$/.test(number)) throw new ArgumentError('--number wants digits only');
            fields.ALB_NUMPROT = number;
        }
        if (args.date) fields.ALB_DATPROT = formDate(args.date);
        if (!Object.keys(fields).length && !args.year && !args.sector) {
            throw new ArgumentError('give at least one of --text, --year, --number, --date, --sector; for the newest acts use `list`');
        }
        const session = new Session();
        if (args.year || args.sector) {
            // Years and sectors are the options of the section's own form.
            const form = await openForm(session, s);
            if (args.year) {
                const years = options(form, 'ALB_DESANNOPROT').map((o) => o.value);
                const year = String(args.year).trim();
                if (!years.includes(year)) throw new ArgumentError(`--year ${year}: section ${s.code} offers ${years.join(', ') || 'no year'}`);
                fields.ALB_DESANNOPROT = year;
            }
            if (args.sector) {
                const sectors = options(form, 'SET_COD');
                if (!sectors.length) throw new ArgumentError(`section ${s.code} has no sector filter`);
                const want = String(args.sector).trim().toLowerCase();
                const hits = sectors.filter((o) => o.value === want || o.label.toLowerCase().includes(want));
                if (hits.length !== 1) {
                    throw new ArgumentError(`--sector "${args.sector}" matches ${hits.length} sectors${hits.length ? `: ${hits.slice(0, 8).map((o) => `${o.value} ${o.label}`).join('; ')}` : ''}`);
                }
                fields.SET_COD = hits[0].value;
            }
        }
        const { html } = await runFilter(session, s, fields);
        const { rows, total, pages: available } = await collect(session, s, html, pages);
        if (!rows.length) throw new EmptyResultError(`palermo-delibere search ${s.code}`, 'no act matches. The filters are ANDed');
        Object.assign(args, { _total: total, _pages: available });
        return rows;
    },
});
