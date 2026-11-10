// Offline reference: native operators are passed through to Raindrop; local
// flags are implemented by this adapter. This command never resolves a token.
import { cli, Strategy } from '@jackwener/opencli/registry';

const FILTERS = 'https://help.raindrop.io/filters/';
const SEARCH = 'https://help.raindrop.io/using-search/';
const ADAPTER = 'https://github.com/aborruso/opencli/blob/main/plugins/raindrop/README.md#search-cookbook';
const API = 'https://developer.raindrop.io/v1/raindrops/multiple';
const QUERY_NOTE = 'Quote the entire query for the shell. Native matching and indexing are controlled by Raindrop.';
const entries = [
    {
        category: 'text', syntax: 'word word', description: 'Match both words (default AND)',
        example: "opencli raindrop search 'cli agents'", notes: QUERY_NOTE, source: FILTERS,
    },
    {
        category: 'text', syntax: '"exact phrase"', description: 'Match a phrase, preserving double quotes inside the shell argument',
        example: 'opencli raindrop search \'"Building CLIs for agents"\'', notes: QUERY_NOTE, source: FILTERS,
    },
    {
        category: 'text', syntax: '-word', description: 'Exclude a word',
        example: "opencli raindrop search 'cli -mcp'", notes: 'Use the minus inside the quoted query, not as a CLI option.', source: FILTERS,
    },
    {
        category: 'text', syntax: 'term term match:OR', description: 'Match either native term or filter',
        example: "opencli raindrop search 'cli agents match:OR'",
        notes: 'OR changes native query combination, including native filters. Do not assume SQL parentheses or precedence. Local --from/--to/--domain remain AND conditions.', source: FILTERS,
    },
    {
        category: 'tags', syntax: '#tag', description: 'Match a tag; discover actual tag names with tags --grep',
        example: "opencli raindrop search '#cli'", notes: 'The tags command lists tag names, while search returns bookmarks.', source: FILTERS,
    },
    {
        category: 'tags', syntax: '#tag #tag', description: 'Require both tags',
        example: "opencli raindrop search '#cli #reference'", notes: QUERY_NOTE, source: FILTERS,
    },
    {
        category: 'tags', syntax: '#tag #tag match:OR', description: 'Require at least one of two tags',
        example: "opencli raindrop search '#cli #mcp match:OR'", notes: 'Native OR also affects other native terms in the same query.', source: FILTERS,
    },
    {
        category: 'tags', syntax: '#tag -#tag', description: 'Require one tag and exclude another',
        example: "opencli raindrop search '#cli -#obsolete'", notes: QUERY_NOTE, source: FILTERS,
    },
    {
        category: 'tags', syntax: '#"multi word tag"', description: 'Match a tag containing spaces',
        example: 'opencli raindrop search \'#"machine learning"\'', notes: QUERY_NOTE, source: FILTERS,
    },
    {
        category: 'fields', syntax: 'title:word', description: 'Search within the title',
        example: "opencli raindrop search 'title:agents'", notes: QUERY_NOTE, source: FILTERS,
    },
    {
        category: 'fields', syntax: 'excerpt:word', description: 'Search within the saved description',
        example: "opencli raindrop search 'excerpt:tutorial'", notes: QUERY_NOTE, source: FILTERS,
    },
    {
        category: 'fields', syntax: 'note:word', description: 'Search your own bookmark notes',
        example: "opencli raindrop search 'note:review'", notes: QUERY_NOTE, source: FILTERS,
    },
    {
        category: 'fields', syntax: 'link:word', description: 'Search within the URL',
        example: "opencli raindrop search 'link:github'", notes: 'URL text matching is not an exact hostname check. Use --domain github.com for hostname filtering.', source: FILTERS,
    },
    {
        category: 'fields', syntax: 'info:word', description: 'Restrict text matching to title/description',
        example: "opencli raindrop search 'info:duckdb'", notes: 'Ordinary text search may also inspect saved indexed content; relevant content-search features require Pro and a saved copy.', source: SEARCH,
    },
    {
        category: 'attributes', syntax: 'type:X', description: 'Filter by Raindrop content type',
        example: "opencli raindrop search 'type:video #ai'",
        notes: 'Types documented by the help: article, image, video, audio, document, book. Classification comes from Raindrop, not the URL suffix.', source: FILTERS,
    },
    {
        category: 'attributes', syntax: '-type:X', description: 'Exclude a content type',
        example: "opencli raindrop search 'cli -type:video'", notes: 'Native exclusions can be combined with words or tags.', source: FILTERS,
    },
    {
        category: 'attributes', syntax: 'notag:true', description: 'Find bookmarks without tags',
        example: "opencli raindrop search 'notag:true'", notes: QUERY_NOTE, source: FILTERS,
    },
    {
        category: 'attributes', syntax: '❤️', description: 'Find favorites',
        example: "opencli raindrop search '❤️'", notes: 'This filters saved favorites, not popularity on the linked site.', source: FILTERS,
    },
    {
        category: 'attributes', syntax: 'file:true', description: 'Find uploaded files',
        example: "opencli raindrop search 'file:true'", notes: QUERY_NOTE, source: FILTERS,
    },
    {
        category: 'attributes', syntax: 'reminder:true', description: 'Find bookmarks with reminders',
        example: "opencli raindrop search 'reminder:true'", notes: QUERY_NOTE, source: FILTERS,
    },
    {
        category: 'attributes', syntax: 'cache.status:ready', description: 'Find bookmarks with an archived copy',
        example: "opencli raindrop search 'cache.status:ready'", notes: 'The adapter returns metadata; it does not download or inspect the archived content.', source: FILTERS,
    },
    {
        category: 'dates', syntax: 'created:YYYY-MM or created:>YYYY-MM-DD', description: 'Native save-date filter',
        example: "opencli raindrop search 'created:2026-04'", notes: 'Also supports before/after operators. Prefer local --from/--to for explicit inclusive UTC ranges, not publication dates.', source: FILTERS,
    },
    {
        category: 'dates', syntax: 'lastUpdate:YYYY-MM-DD', description: 'Native last-update date filter',
        example: "opencli raindrop search 'lastUpdate:2026-04-03'", notes: 'Save date and update date are different. No local update-date range option is implemented.', source: FILTERS,
    },
    {
        category: 'local', syntax: '--from YYYY-MM-DD --to YYYY-MM-DD', description: 'Inclusive UTC bookmark save-date range, checked locally',
        example: 'opencli raindrop search --from 2026-01-01 --to 2026-12-31 --domain x.com,twitter.com --limit 0',
        notes: 'Not the linked page publication date. Invalid dates and reversed ranges fail. Dates remain AND conditions even with native match:OR.', source: ADAPTER,
    },
    {
        category: 'local', syntax: '--domain host[,host]', description: 'Exact URL hostname or subdomain; multiple hostnames are ORed',
        example: "opencli raindrop search '#cli' --domain x.com,twitter.com --from 2026-01-01",
        notes: 'x.com matches mobile.x.com, not notx.com or URLs mentioning x.com in a path. This local filter is ANDed with the query.', source: ADAPTER,
    },
    {
        category: 'local', syntax: '--collection id --nested true', description: 'Restrict search to a collection and optionally its children',
        example: "opencli raindrop search '#cli' --collection 123456 --nested true",
        notes: '123456 is illustrative: discover actual ids with collections. Default 0 = all except Trash; -1 = Unsorted; -99 = Trash explicitly.', source: API,
    },
    {
        category: 'local', syntax: '--sort key --limit N', description: 'Order results and limit the number of locally filtered matches',
        example: "opencli raindrop search 'cli' --sort score --limit 5",
        notes: 'Sorts: -created (default), created, score (requires a query), -sort, title, -title, domain, -domain. Limit defaults to 20; 0 exhausts pages and can be slow. No invented total or silent truncation.', source: ADAPTER,
    },
    {
        category: 'workflow', syntax: 'tags --grep substring', description: 'Discover tag names before constructing a tag search',
        example: 'opencli raindrop tags --grep cli', notes: 'Case-insensitive substring of tag names; counts are reported by Raindrop. Use search with #tag to retrieve bookmarks.', source: ADAPTER,
    },
    {
        category: 'workflow', syntax: 'collections', description: 'Discover collection ids for --collection',
        example: 'opencli raindrop collections', notes: 'Lists user collections with parent ids; system ids 0, -1 and -99 are not invented as collection rows.', source: ADAPTER,
    },
    {
        category: 'workflow', syntax: 'syntax -f json', description: 'Read this reference programmatically, offline and without a token',
        example: 'opencli raindrop syntax -f json', notes: 'OpenCLI wraps reference rows in {ok:true,data:[...]}. Examples illustrate syntax, not guaranteed matches. Saved metadata does not establish the full content of an external thread.', source: ADAPTER,
    },
];

cli({
    site: 'raindrop', name: 'syntax', access: 'read', browser: false,
    domain: 'api.raindrop.io', strategy: Strategy.PUBLIC,
    description: 'Offline search reference: operators, tag combinations, fields, dates, local filters and examples; no token or network required',
    example: 'opencli raindrop syntax -f json',
    args: [],
    columns: ['category', 'syntax', 'description', 'example', 'notes', 'source'],
    func: async () => entries.map(entry => ({ ...entry })),
});
