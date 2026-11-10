import { cli, Strategy } from '@jackwener/opencli/registry';
import { BOOKMARK_COLUMNS, SORTS, searchBookmarks, requireRows } from './shared.js';

cli({
    site: 'raindrop', name: 'search', access: 'read', browser: false,
    domain: 'api.raindrop.io', strategy: Strategy.PUBLIC,
    description: 'Search your Raindrop bookmarks using RAINDROP_TOKEN; optional saved-date and exact-domain filters (no browser). Discover operators and combinations with: opencli raindrop syntax (offline, no token; -f json for agents)',
    example: [
        "opencli raindrop search 'cli agents'  # both words",
        'opencli raindrop search \'"Building CLIs for agents"\'  # exact phrase',
        "opencli raindrop search '#cli #reference'  # both tags",
        "opencli raindrop search '#cli #mcp match:OR'  # either tag",
        "opencli raindrop search '#cli -#obsolete'  # exclude a tag",
        "opencli raindrop search '#cli' --from 2026-01-01 --domain x.com,twitter.com  # native query AND local filters",
        'opencli raindrop syntax -f json  # full query reference; no token required',
    ].join('\n'),
    args: [
        { name: 'query', type: 'string', positional: true, help: 'Native query; quote the whole argument. Words and #tags default to AND; use match:OR for alternatives, -word/-#tag for exclusion, "phrase" for exact phrases. Fields: title:, excerpt:, note:, link:, info:, type:. Omit to browse. See opencli raindrop syntax for combinations, examples and caveats' },
        { name: 'collection', type: 'int', default: 0, help: 'Collection id; 0 = all except Trash, -1 = Unsorted, -99 = Trash; see collections' },
        { name: 'nested', type: 'boolean', default: false, help: 'Include nested collections when searching one collection' },
        { name: 'from', type: 'string', help: 'First bookmark save date, inclusive UTC YYYY-MM-DD; not the linked page publication date' },
        { name: 'to', type: 'string', help: 'Last bookmark save date, inclusive UTC YYYY-MM-DD' },
        { name: 'domain', type: 'string', help: 'Comma-separated hostnames, ORed: x.com,twitter.com; matches exact hosts and subdomains, not URL substrings' },
        { name: 'sort', type: 'string', default: '-created', help: 'Raindrop sort: ' + SORTS.join(', ') + '; score requires a query' },
        { name: 'limit', type: 'int', default: 20, help: 'Matching rows to return after local filters; 0 exhausts the matching pages (may be slow)' },
    ],
    columns: BOOKMARK_COLUMNS,
    func: async args => requireRows(await searchBookmarks(args), 'search',
        'No bookmark matches. Try fewer words or wider save dates; this does not inspect live page or thread content.'),
});
