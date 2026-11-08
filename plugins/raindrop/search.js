import { cli, Strategy } from '@jackwener/opencli/registry';
import { BOOKMARK_COLUMNS, SORTS, searchBookmarks, requireRows } from './shared.js';

cli({
    site: 'raindrop', name: 'search', access: 'read', browser: false,
    domain: 'api.raindrop.io', strategy: Strategy.PUBLIC,
    description: 'Search your Raindrop bookmarks using RAINDROP_TOKEN; optional saved-date and exact-domain filters (no browser)',
    example: 'opencli raindrop search --from 2026-01-01 --to 2026-12-31 --domain x.com,twitter.com --limit 0',
    args: [
        { name: 'query', type: 'string', positional: true, help: 'Native Raindrop search, including #tags, quoted phrases and link:; omit to browse' },
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
