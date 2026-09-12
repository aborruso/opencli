// The AI search of IstatData, from the command line.
//
// This is the form at esploradati.istat.it/databrowser/#/it/dw/search?ai=true.
// The endpoint answers with dataset ids and little else, so every row is joined
// against the node catalog: that is where the title, the category path and the
// deep link to the table come from. With `--lang en` the endpoint returns an
// empty title, which makes the join load-bearing rather than decorative.
import { cli, Strategy } from '@jackwener/opencli/registry';
import { ArgumentError, EmptyResultError } from '@jackwener/opencli/errors';
import {
    checkLang, nodeSettings, executeSearch, fetchCatalog, buildIndex,
    tableUrl, sdmxUrls, categoryPath,
} from './shared.js';

cli({
    site: 'istatdata',
    name: 'ask',
    access: 'read',
    description: 'Ask IstatData in plain language which datasets answer a question (the AI search form, no browser)',
    example: 'opencli istatdata ask "incidenti stradali in Sicilia"',
    domain: 'esploradati.istat.it',
    strategy: Strategy.PUBLIC,
    browser: false,
    args: [
        { name: 'question', type: 'string', positional: true, required: true, help: 'The question, in plain Italian or English. It searches dataset descriptions, it does not compute an answer' },
        { name: 'lang', type: 'string', default: 'it', help: 'Language of the question and of the results: it or en' },
        { name: 'limit', type: 'int', default: 0, help: 'How many datasets to ask for; 0 uses the node default (20)' },
        { name: 'session-id', type: 'string', default: '', help: 'The session_id of a previous answer, to ask a follow-up question in the same context' },
        { name: 'node', type: 'int', default: 1, help: 'Data Browser node id' },
    ],
    // Identifiers first, then the one number, then the links, and the two long
    // texts last: in a table the trailing columns are the ones that can
    // overflow without pushing everything else off the screen.
    //
    // `sessionId` is a property of the answer, not of a dataset, so it repeats
    // identically down the column. It lives here anyway, and not in
    // `footerExtra`, because the runtime renders the footer only in `table`
    // format: in `json`, `csv`, `yaml` — and in any pipe, where `table`
    // auto-downgrades to yaml — a footer value is simply gone. An option like
    // `--session-id` whose input cannot be read back out of the output is a
    // broken option, and that matters more than the repetition.
    // Default to `plain` rather than `table`: a question returns a handful of wide rows, and a
    // nine-column table with a 400-character description in it is a wall of
    // box-drawing characters nobody can read. `plain` prints one `key: value`
    // block per dataset and skips the empty fields. Every format is still
    // reachable with an explicit -f, and -f table is what it always was.
    defaultFormat: 'plain',
    columns: ['id', 'title', 'category', 'similarity', 'table', 'data', 'aiTitle', 'description', 'sessionId'],
    func: async (args) => {
        const question = String(args.question ?? '').trim();
        if (!question) throw new ArgumentError('the question is empty');
        const lang = checkLang(args.lang);
        const node = Number(args.node ?? 1);
        if (!Number.isInteger(node) || node < 1) throw new ArgumentError('node must be an integer >= 1');
        const limit = Number(args.limit ?? 0);
        if (!Number.isInteger(limit) || limit < 0) throw new ArgumentError('limit must be an integer >= 0');
        // Kebab arg names stay kebab in `args`: the runtime looks the option
        // up under both spellings but stores it back under `arg.name`.
        const sessionId = String(args['session-id'] ?? '').trim() || null;

        const settings = await nodeSettings(node, lang);
        const answer = await executeSearch({
            node,
            lang,
            request: question,
            sessionId,
            // Passed through as asked: the node caps it on its side, and
            // silently clamping it here would hide that from the caller.
            maxResults: limit > 0 ? limit : settings.maxResults,
            rateLimiting: settings.rateLimiting,
        });

        const answerSessionId = answer.session_id ?? null;
        const products = answer.chatContext?.dataproducts ?? [];
        if (products.length === 0) {
            throw new EmptyResultError(`istatdata ask "${question}"`, 'the AI search found no dataset for this question');
        }

        // Only now, once there is something to enrich, pay the 1.5 MB catalog.
        const index = buildIndex(await fetchCatalog(node, lang));

        const rows = [];
        for (const product of products) {
            const id = product?.id ?? '';
            const meta = index.get(id) ?? {};
            rows.push({
                id,
                // The catalog first: with --lang en the endpoint sends an empty title.
                title: meta.title || product?.title || null,
                category: categoryPath(meta.categoryLabels),
                similarity: product?.similarity ?? null,
                table: tableUrl(id, meta.categoryIds, lang),
                data: sdmxUrls(id).data,
                // The AI-written descriptive title, filled only with --lang it.
                aiTitle: product?.ai_title || null,
                description: (product?.description ?? '').trim() || null,
                // Pass it back with --session-id to ask a follow-up question
                // in the same context.
                sessionId: answerSessionId,
            });
        }
        return rows;
    },
});
