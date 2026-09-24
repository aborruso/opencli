// The newest acts of one section. Five sections open on a list; DCCIR and ODT
// are reached through the filter on the current year, whose result is newest
// first too. DDI has no list and refuses the year alone (too many acts).
import { cli, Strategy } from '@jackwener/opencli/registry';
import { ArgumentError, EmptyResultError } from '@jackwener/opencli/errors';
import { Session, COLUMNS, MAX_PAGES, section, listUrl, runFilter, collect, checkPages } from './shared.js';

cli({
    site: 'palermo-delibere',
    name: 'list',
    access: 'read',
    description: `The newest acts of one section of the deliberations and ordinances archive of the Comune di Palermo, with permanent link and attachments (at most ${MAX_PAGES} pages of 10)`,
    example: 'opencli palermo-delibere list DGC',
    domain: 'servizionline.comune.palermo.it',
    strategy: Strategy.PUBLIC,
    browser: false,
    args: [
        { name: 'section', type: 'string', positional: true, required: true, help: 'Section code: DGC, DCC, DCCIR, DCS, OS, DCO, ODT (DDI has no list: use `search DDI --date`); see `opencli palermo-delibere sections`' },
        { name: 'pages', type: 'int', default: MAX_PAGES, help: `List pages to read, 1 or ${MAX_PAGES}; each page is 10 acts and 11 requests` },
    ],
    defaultFormat: 'json',
    columns: COLUMNS,
    footerExtra: (kwargs) => (kwargs._total == null ? undefined : `${kwargs._total} acts in the ${kwargs._scope}, ${kwargs._pages} pages of 10 on the portal`),
    func: async (args) => {
        const s = section(args.section);
        const pages = checkPages(args.pages);
        if (s.code === 'DDI') throw new ArgumentError('DDI has no list and the portal refuses a whole year of it (over 12,000 acts): use `search DDI --date YYYY-MM-DD`');
        const session = new Session();
        const year = String(new Date().getFullYear());
        const first = s.daily === 'list' ? await session.get(listUrl(s)) : (await runFilter(session, s, { ALB_DESANNOPROT: year })).html;
        const { rows, total, pages: available } = await collect(session, s, first, pages);
        if (!rows.length) throw new EmptyResultError(`palermo-delibere list ${s.code}`, 'the portal returned no act');
        Object.assign(args, { _total: total, _pages: available, _scope: s.daily === 'list' ? 'section' : `section for ${year}` });
        return rows;
    },
});
