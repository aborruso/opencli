// The icon search of koboyo.com/icons, from the command line.
//
// The search box on the site needs JavaScript and produces no URL of its own,
// so there is nothing to link to and nothing to curl. What there is, is a
// static JSON index and a scoring function: this command fetches the one and
// applies the other, and so returns what the page would have shown.
import { cli, Strategy } from '@jackwener/opencli/registry';
import { ArgumentError, EmptyResultError } from '@jackwener/opencli/errors';
import {
    STYLES, checkStyle, checkGroup, commonWords, shardFor,
    score, matchesStyle, matchesGroup, rowFromEntry, searchPageUrl,
} from './shared.js';

cli({
    site: 'koboyo',
    name: 'search',
    access: 'read',
    description: 'Search the 261,740 free hand-drawn SVG icons of koboyo.com (the site search, no browser)',
    example: 'opencli koboyo search "acoustic guitar" --limit 5',
    domain: 'koboyo.com',
    strategy: Strategy.PUBLIC,
    browser: false,
    args: [
        { name: 'query', type: 'string', positional: true, required: true, help: 'One or more words. Every word has to match: the terms are ANDed, as they are on the site' },
        { name: 'style', type: 'string', default: '', help: `Keep one drawing style only: ${STYLES.join(', ')}` },
        { name: 'group', type: 'string', default: '', help: 'Keep one taxonomy branch only, as group/subgroup: the groups are face, mark, object, people, scene, e.g. object/food' },
        { name: 'limit', type: 'int', default: 20, help: 'How many icons to return; 0 returns every match' },
    ],
    // Eight columns, three of them full URLs: the default table is a screen-wide
    // wall of box-drawing characters that wraps into noise. `plain` prints one
    // key/value block per icon, loses no data, and yields to any explicit -f.
    // The same lesson as istatdata on 2026-09-12, met again from a different
    // direction: there the offender was a 400-character description, here it is
    // three URLs.
    defaultFormat: 'plain',
    // `svg` and `page` last: the longest columns, and the ones that can
    // overflow without pushing the identifiers off the screen.
    columns: ['slug', 'name', 'group', 'style', 'relevance', 'url', 'svg', 'page'],
    // How many matched and whether the shard that answered is capped. Both are
    // properties of the answer rather than of a row, and both are informational:
    // the footer renders in `table` format only.
    footerExtra: (kwargs) => (kwargs._matches != null
        ? `${kwargs._matches} matches in the "${kwargs._prefix}" index shard${kwargs._truncated ? ', which is capped: rarer matches may be missing' : ''}`
        : undefined),
    func: async (args) => {
        const query = String(args.query ?? '').trim().toLowerCase();
        if (!query) throw new ArgumentError('the query is empty');
        const style = checkStyle(args.style);
        const group = checkGroup(args.group);
        const limit = Number(args.limit ?? 20);
        if (!Number.isInteger(limit) || limit < 0) throw new ArgumentError('limit must be an integer >= 0');

        const tokens = query.split(/\s+/).filter(Boolean);
        const common = await commonWords();

        // Only a token of at least two characters that is not a stop word can
        // select a shard. When none qualifies the site falls back to the
        // featured list and says so in a banner; this command does not, because
        // a featured list printed under a search that never ran is a wrong
        // answer that looks like a right one.
        const tooShort = tokens.filter((t) => t.length < 2);
        const selectors = tokens.filter((t) => t.length >= 2 && !common.has(t));
        if (selectors.length === 0) {
            if (tooShort.length === tokens.length) {
                throw new ArgumentError(`every word is shorter than two characters (${tokens.join(', ')}): the index is keyed on two-character prefixes and cannot be searched on these`);
            }
            throw new ArgumentError(`every word is too common to search on (${tokens.filter((t) => common.has(t)).join(', ')}): these match most of the library. Add a more specific one`);
        }

        // The longest of them: the deeper the prefix, the smaller the shard.
        const selector = selectors.reduce((longest, t) => (t.length > longest.length ? t : longest));
        const { entries, truncated, prefix } = await shardFor(selector);

        const page = searchPageUrl(query, group, style);
        const scored = [];
        for (const entry of entries) {
            if (!matchesStyle(entry, style) || !matchesGroup(entry, group)) continue;
            const relevance = score(entry, tokens);
            if (relevance > 0) scored.push(rowFromEntry(entry, relevance, page));
        }
        scored.sort((a, b) => b.relevance - a.relevance);

        if (scored.length === 0) {
            const filters = [style && `--style ${style}`, group && `--group ${group}`].filter(Boolean).join(' ');
            // Zero results has two ordinary causes and neither is visible from
            // the query: names and keywords are in English only, and the words
            // are ANDed. Saying so here is the difference between a dead end
            // and a next attempt.
            const hints = ['names and keywords are in English only', 'every word has to match, so fewer words find more'];
            if (filters) hints.push(`${filters} is also narrowing this - check the branch with \`opencli koboyo groups\``);
            throw new EmptyResultError(
                `koboyo search "${query}"${filters ? ` ${filters}` : ''}`,
                `no icon matches every word of the query (${hints.join('; ')})`,
            );
        }

        // The index shard is capped: it holds the top slice of what matches its
        // prefix, not all of it. Saying so is the difference between a short
        // answer and a short answer that looks complete.
        args._matches = scored.length;
        args._prefix = prefix;
        args._truncated = truncated;
        return limit > 0 ? scored.slice(0, limit) : scored;
    },
});
