// The Facet API: the reference codes behind every filter of an index, with
// their labels and how many records carry each. The search API speaks in
// codes (status 31094502, programme 43108390, country 20000883); this is the
// dictionary, and the place to find what to put in a `--query`.
import { cli, Strategy } from '@jackwener/opencli/registry';
import { ArgumentError, EmptyResultError } from '@jackwener/opencli/errors';
import {
    KEYS, CALL_TYPE, UPDATE_TYPE, cleanLabel, rawQuery, boolQuery, terms, facets,
} from './shared.js';

cli({
    site: 'eu-funding',
    name: 'codes',
    access: 'read',
    description: 'The reference codes of the EU Funding & Tenders Portal APIs and their labels - programmes, statuses, countries, types... (Facet API, no browser)',
    example: 'opencli eu-funding codes frameworkProgramme --index calls',
    domain: 'ec.europa.eu',
    strategy: Strategy.PUBLIC,
    browser: false,
    args: [
        { name: 'field', type: 'string', positional: true, required: false, help: 'The field to decode, e.g. frameworkProgramme, status, country. Without it, the list of fields of the index and how many codes each has' },
        { name: 'index', type: 'string', default: 'calls', help: `Which index: ${Object.keys(KEYS).join(', ')}` },
        { name: 'text', type: 'string', default: '', help: 'Free text: count only the records that match it' },
        { name: 'query', type: 'string', default: '', help: 'Raw bool query in JSON: count only the records that match it' },
        { name: 'filter', type: 'string', default: '', help: 'Keep the codes whose label or code contains this text (case-insensitive)' },
    ],
    defaultFormat: 'json',
    columns: ['field', 'code', 'label', 'count'],
    func: async (args) => {
        const index = String(args.index ?? 'calls').toLowerCase();
        const key = KEYS[index];
        if (!key) throw new ArgumentError(`invalid --index "${args.index}": use ${Object.keys(KEYS).join(', ')}`);
        // The SEDIA index is shared with other datasets (organisations,
        // announcements, projects' statuses such as "Ended"), so unfiltered
        // its facets mix vocabularies. Scoped here to calls, tenders and
        // grant updates - the part of it the `calls` family of commands uses.
        const scope = index === 'calls' ? terms('type', [...Object.values(CALL_TYPE), UPDATE_TYPE]) : null;
        const query = boolQuery([scope], rawQuery(args.query));
        const list = await facets({ key, text: args.text, query });

        const field = String(args.field ?? '').trim();
        if (!field) {
            const sizes = new Map();
            for (const f of list) sizes.set(f.name, Math.max(sizes.get(f.name) ?? 0, (f.values ?? []).length));
            return [...sizes].sort((a, b) => a[0].localeCompare(b[0])).map(([name, n]) => ({ field: name, code: '', label: '', count: n }));
        }

        const matching = list.filter((f) => f.name === field);
        if (!matching.length) {
            throw new ArgumentError(`the ${index} index has no field "${field}". List them with: opencli eu-funding codes --index ${index}`);
        }
        // A field can come back twice (typeOfMGAs and callIdentifier do on
        // SEDIA); keep each code once.
        const seen = new Map();
        for (const v of matching.flatMap((f) => f.values ?? [])) {
            const code = String(v.rawValue);
            if (!seen.has(code)) seen.set(code, { field, code, label: cleanLabel(v.value), count: Number(v.count ?? 0) });
        }
        const needle = String(args.filter ?? '').trim().toLowerCase();
        const rows = [...seen.values()]
            .filter((r) => !needle || r.label.toLowerCase().includes(needle) || r.code.toLowerCase().includes(needle))
            .sort((a, b) => b.count - a.count);
        if (!rows.length) throw new EmptyResultError(`eu-funding codes ${field}`, `no code of ${field} matches "${args.filter}"`);
        return rows;
    },
});
