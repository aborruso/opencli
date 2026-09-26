// The daily harvest: for each section, the acts its daily rule reaches for
// one day, as JSON Lines on stdout. Sections with a list give their newest
// acts, DCCIR the newest of the day's year, DDI and ODT the acts protocolled
// that day. Each section has its own number of pages, sized on what a day
// brings (see SECTIONS); DDI reads every page of the day. OpenCLI has no JSON Lines format,
// so this prints its own lines and returns nothing; `-f` does not apply.
import { cli, Strategy } from '@jackwener/opencli/registry';
import { EmptyResultError } from '@jackwener/opencli/errors';
import { ArgumentError } from '@jackwener/opencli/errors';
import { COLUMNS, DAILY_PAGES_MAX, SECTIONS, sectionList, daily, formDate } from './shared.js';

/** Yesterday in Rome, YYYY-MM-DD. */
function yesterday() {
    const d = new Date(Date.now() - 86_400_000);
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(d);
}

cli({
    site: 'palermo-delibere',
    name: 'dump',
    access: 'read',
    description: `The acts each section of the deliberations and ordinances archive of the Comune di Palermo gives for one day, as JSON Lines on stdout (${SECTIONS.map((s) => `${s.code} ${s.dailyPages || 'all'}`).join(', ')} pages of 10)`,
    example: 'opencli palermo-delibere dump --date 2026-09-22 > delibere.jsonl',
    domain: 'servizionline.comune.palermo.it',
    strategy: Strategy.PUBLIC,
    browser: false,
    args: [
        { name: 'sections', type: 'string', positional: true, required: false, help: 'Comma-separated section codes, e.g. "DDI,ODT"; omit for all eight' },
        { name: 'date', type: 'string', default: '', help: 'The day, YYYY-MM-DD: the protocol date for DDI and ODT, the year for DCCIR. Default: yesterday in Rome' },
        { name: 'pages', type: 'int', default: 0, help: `Pages of 10 to read in every section, 1 to ${DAILY_PAGES_MAX}; default: each section's own number (${SECTIONS.map((s) => `${s.code} ${s.dailyPages || 'all'}`).join(', ')})` },
    ],
    defaultFormat: 'json',
    columns: COLUMNS,
    func: async (args) => {
        const pages = Number(args.pages);
        if (!Number.isInteger(pages) || pages < 0 || pages > DAILY_PAGES_MAX) throw new ArgumentError(`--pages must be 1 to ${DAILY_PAGES_MAX}`);
        const date = args.date ? String(args.date).trim() : yesterday();
        formDate(date);
        const sections = sectionList(args.sections);
        let written = 0;
        const notes = [];
        // One section at a time, each on its own session: the portal answers
        // bursts with HTTP 429.
        for (const s of sections) {
            const { rows, total } = await daily(s, date, pages);
            for (const row of rows) process.stdout.write(`${JSON.stringify(row)}\n`);
            written += rows.length;
            notes.push(`${s.code} ${rows.length}${total > rows.length ? ` of ${total}` : ''}`);
        }
        if (!written) throw new EmptyResultError('palermo-delibere dump', `no act for ${date} in ${sections.map((s) => s.code).join(', ')}`);
        process.stderr.write(`${written} acts for ${date}: ${notes.join(', ')}\n`);
        return undefined;
    },
});
