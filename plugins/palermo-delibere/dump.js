// The daily harvest: for each section, the acts its daily rule reaches for
// one day, as JSON Lines on stdout. Sections with a list give their newest
// acts, DCCIR the newest of the day's year, DDI and ODT the acts protocolled
// that day. Each section has its own number of pages, sized on what a day
// brings (see SECTIONS); DDI reads every page of the day.
// With --known <archive>, only the acts not in the archive are opened and
// printed, and DDI and ODT are read for the last --lookback protocol days:
// acts are often loaded on the portal days after their protocol date.
// OpenCLI has no JSON Lines format, so this prints its own lines and returns
// nothing; `-f` does not apply.
import { readFileSync } from 'node:fs';
import { cli, Strategy } from '@jackwener/opencli/registry';
import { EmptyResultError, ArgumentError } from '@jackwener/opencli/errors';
import { COLUMNS, DAILY_PAGES_MAX, SECTIONS, sectionList, daily, formDate, actKey } from './shared.js';

const LOOKBACK_DEFAULT = 10;
const LOOKBACK_MAX = 31;

/** Yesterday in Rome, YYYY-MM-DD. */
function yesterday() {
    const d = new Date(Date.now() - 86_400_000);
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(d);
}

/** `date` and the `n - 1` days before it, newest first. */
function daysBack(date, n) {
    const d = new Date(`${date}T00:00:00Z`);
    return Array.from({ length: n }, (_, i) => {
        const x = new Date(d);
        x.setUTCDate(d.getUTCDate() - i);
        return x.toISOString().slice(0, 10);
    });
}

/** The keys of the acts in an archive in the shape of `dump`. */
function readKnown(path) {
    let raw;
    try {
        raw = readFileSync(path, 'utf8');
    } catch (e) {
        throw new ArgumentError(`--known ${path}: ${e.message}`);
    }
    const keys = new Set();
    for (const line of raw.split('\n')) {
        if (!line.trim()) continue;
        const r = JSON.parse(line);
        const k = actKey(r.section, r.number, r.date);
        if (k) keys.add(k);
    }
    return keys;
}

cli({
    site: 'palermo-delibere',
    name: 'dump',
    access: 'read',
    description: `The acts each section of the deliberations and ordinances archive of the Comune di Palermo gives for one day, as JSON Lines on stdout (${SECTIONS.map((s) => `${s.code} ${s.dailyPages || 'all'}`).join(', ')} pages of 10); with --known, only the acts not in that archive, DDI and ODT over the last days`,
    example: 'opencli palermo-delibere dump --known delibere.jsonl > new.jsonl',
    domain: 'servizionline.comune.palermo.it',
    strategy: Strategy.PUBLIC,
    browser: false,
    args: [
        { name: 'sections', type: 'string', positional: true, required: false, help: 'Comma-separated section codes, e.g. "DDI,ODT"; omit for all eight' },
        { name: 'date', type: 'string', default: '', help: 'The day, YYYY-MM-DD: the protocol date for DDI and ODT, the year for DCCIR. Default: yesterday in Rome' },
        { name: 'pages', type: 'int', default: 0, help: `Pages of 10 to read in every section, 1 to ${DAILY_PAGES_MAX}; default: each section's own number (${SECTIONS.map((s) => `${s.code} ${s.dailyPages || 'all'}`).join(', ')})` },
        { name: 'known', type: 'string', default: '', help: 'An archive of earlier dumps (JSON Lines): print only the acts not in it, and read DDI and ODT for the last --lookback protocol days. No new act is not an error' },
        { name: 'lookback', type: 'int', default: LOOKBACK_DEFAULT, help: `With --known, protocol days read for DDI and ODT, ending at --date, 1 to ${LOOKBACK_MAX}` },
    ],
    defaultFormat: 'json',
    columns: COLUMNS,
    func: async (args) => {
        const pages = Number(args.pages);
        if (!Number.isInteger(pages) || pages < 0 || pages > DAILY_PAGES_MAX) throw new ArgumentError(`--pages must be 1 to ${DAILY_PAGES_MAX}`);
        const lookback = Number(args.lookback);
        if (!Number.isInteger(lookback) || lookback < 1 || lookback > LOOKBACK_MAX) throw new ArgumentError(`--lookback must be 1 to ${LOOKBACK_MAX}`);
        const date = args.date ? String(args.date).trim() : yesterday();
        formDate(date);
        const known = args.known ? readKnown(String(args.known)) : null;
        const sections = sectionList(args.sections);
        let written = 0;
        const notes = [];
        // One section and one day at a time, each on its own session: the
        // portal answers bursts with HTTP 429.
        for (const s of sections) {
            const days = known && s.daily === 'date' ? daysBack(date, lookback) : [date];
            let n = 0;
            let total = 0;
            for (const day of days) {
                const r = await daily(s, day, pages, known);
                for (const row of r.rows) process.stdout.write(`${JSON.stringify(row)}\n`);
                n += r.rows.length;
                total += r.total ?? 0;
            }
            written += n;
            notes.push(known ? `${s.code} ${n} new${days.length > 1 ? ` (${days.length} days)` : ''}` : `${s.code} ${n}${total > n ? ` of ${total}` : ''}`);
        }
        if (!written && !known) throw new EmptyResultError('palermo-delibere dump', `no act for ${date} in ${sections.map((s) => s.code).join(', ')}`);
        process.stderr.write(`${written} ${known ? 'new ' : ''}acts for ${date}${known ? `, ${known.size} already known` : ''}: ${notes.join(', ')}\n`);
        return undefined;
    },
});
