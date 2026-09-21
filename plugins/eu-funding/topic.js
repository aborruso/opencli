// The Topic Details service: one call topic (or one tender) in full, by its
// identifier, e.g. HORIZON-CL3-2022-BM-01-01.
import { cli, Strategy } from '@jackwener/opencli/registry';
import { ArgumentError, CommandExecutionError, EmptyResultError } from '@jackwener/opencli/errors';
import {
    KEYS, PORTAL, CALL_STATUS, CALL_TYPE, CALL_TYPE_LABEL,
    first, all, day, text, boolQuery, terms, search, labels,
} from './shared.js';

const STATUS_LABEL = Object.fromEntries(Object.entries(CALL_STATUS).map(([k, v]) => [v, k]));

cli({
    site: 'eu-funding',
    name: 'topic',
    access: 'read',
    description: 'One call topic or tender of the EU Funding & Tenders Portal in full: dates, programme, description, conditions (Topic Details API, no browser)',
    example: 'opencli eu-funding topic HORIZON-CL3-2022-BM-01-01',
    domain: 'ec.europa.eu',
    strategy: Strategy.PUBLIC,
    browser: false,
    args: [
        { name: 'identifier', type: 'string', positional: true, required: true, help: 'Topic identifier (the `identifier` column of `calls`), e.g. HORIZON-CL3-2022-BM-01-01' },
    ],
    defaultFormat: 'json',
    columns: ['identifier', 'title', 'type', 'status', 'programme', 'call', 'call_title', 'types_of_action', 'opening', 'deadline', 'deadline_model', 'keywords', 'description', 'conditions', 'support', 'url'],
    func: async (args) => {
        const id = String(args.identifier ?? '').trim();
        if (!id) throw new ArgumentError('the identifier is empty');
        // The exact phrase in quotes is what the doc prescribes. It still
        // matches more than the topic: grant updates about it (type 6) and a
        // copy from another datasource. Keep the call/tender types and the
        // SEDIA datasource only.
        const query = boolQuery([terms('type', Object.values(CALL_TYPE))]);
        const [{ results }, programmeLabel] = await Promise.all([
            search({ key: KEYS.calls, text: `"${id}"`, query, limit: 20 }),
            labels(KEYS.calls, 'frameworkProgramme', boolQuery([terms('identifier', [id])])),
        ]);
        const hits = results.filter((r) => first(r.metadata?.DATASOURCE) === 'SEDIA'
            && first(r.metadata?.identifier).toLowerCase() === id.toLowerCase());
        if (!hits.length) {
            throw new EmptyResultError(`eu-funding topic ${id}`, 'no topic or tender has this identifier. Find one with `opencli eu-funding calls`');
        }
        if (hits.length > 1) {
            throw new CommandExecutionError(`${hits.length} records carry the identifier ${id}; expected one`);
        }
        const r = hits[0];
        const m = r.metadata ?? {};
        const type = first(m.type);
        const status = first(m.status);
        // For a grant topic the record's url points at a JSON data file that
        // answers 404 (checked 2026-09-21); the page a person opens is
        // topic-details/<id>. A tender's url is already a page.
        const own = r.url ?? first(m.url);
        const isData = /\/data\/topicDetails\//.test(own);
        return [{
            identifier: first(m.identifier),
            title: first(m.title) || r.summary,
            type: CALL_TYPE_LABEL[type] ?? type,
            status: STATUS_LABEL[status] ?? status,
            programme: (m.frameworkProgramme ?? []).map((c) => programmeLabel.get(String(c)) ?? c).join('; '),
            call: first(m.callIdentifier),
            call_title: first(m.callTitle),
            types_of_action: all(m.typesOfAction),
            opening: day(m.startDate),
            deadline: [...new Set((m.deadlineDate ?? []).map(day))].join('; '),
            deadline_model: first(m.deadlineModel),
            keywords: all(m.keywords),
            description: text(m.descriptionByte ?? m.description),
            conditions: text(m.topicConditions),
            support: text(m.supportInfo),
            url: isData ? `${PORTAL}/opportunities/topic-details/${first(m.identifier)}` : own,
        }];
    },
});
