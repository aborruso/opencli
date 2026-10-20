// The datasets of one atlas, from its catalog; with --tree, its theme tree
// with the number of datasets under each theme.
import { cli, Strategy } from '@jackwener/opencli/registry';
import { ArgumentError, EmptyResultError } from '@jackwener/opencli/errors';
import {
    DEFAULT_ATLAS, checkLang, resolveAtlas, fetchCatalog, buildIndex, tableUrl, categoryPath,
} from './shared.js';

cli({
    site: 'aster',
    name: 'datasets',
    access: 'read',
    description: 'Datasets of one atlas of aster.istat.it: id, title, theme path and link to the table; with --tree, the theme tree with the number of datasets per theme (no browser)',
    example: 'opencli aster datasets --atlas AST --grep popolazione',
    domain: 'aster.istat.it',
    strategy: Strategy.PUBLIC,
    browser: false,
    args: [
        { name: 'atlas', type: 'string', default: DEFAULT_ATLAS, help: 'Atlas code or id, see `opencli aster atlases`' },
        { name: 'grep', type: 'string', help: 'Keep datasets whose id, title or theme path holds every word, in any order; accents, case and the final vowel are ignored (decesso finds Decessi). Title matches first' },
        { name: 'tree', type: 'boolean', default: false, help: 'List the themes instead of the datasets: one row per theme, with how many datasets it holds' },
        { name: 'lang', type: 'string', default: 'it', help: 'Language of titles and themes: it or en' },
    ],
    // No `columns`: without --tree the rows are id, title, category, atlas,
    // table; with --tree they are level, theme, datasets, category.
    func: async (args) => {
        const lang = checkLang(args.lang);
        const atlas = await resolveAtlas(args.atlas, lang);
        const index = buildIndex(await fetchCatalog(atlas.nodeId, lang));
        const terms = args.grep ? stems(args.grep) : null;
        if (terms && terms.length === 0) throw new ArgumentError(`--grep "${args.grep}" has no word to search`);

        const rows = [];
        for (const [id, meta] of index) {
            const category = categoryPath(meta.categoryLabels);
            let inTitle = 0;
            if (terms) {
                const idWords = stems(id), titleWords = stems(meta.title), categoryWords = stems(category);
                const has = (words, t) => words.some((w) => w.startsWith(t));
                if (!terms.every((t) => has(idWords, t) || has(titleWords, t) || has(categoryWords, t))) continue;
                inTitle = terms.filter((t) => has(titleWords, t)).length;
            }
            rows.push({
                inTitle,
                id,
                title: meta.title || null,
                category,
                atlas: atlas.code,
                table: tableUrl(atlas.code, id, lang),
            });
        }
        if (rows.length === 0) {
            throw new EmptyResultError(
                `aster datasets --atlas ${atlas.code}`,
                terms ? `no dataset matches "${args.grep}": try a shorter word, or the other language with --lang` : 'the atlas catalog is empty',
            );
        }
        // Datasets with more of the words in their title first; the sort is
        // stable, so the catalog order holds within each group.
        rows.sort((a, b) => b.inTitle - a.inTitle);
        for (const row of rows) delete row.inTitle;
        return args.tree ? themeTree(rows) : rows;
    },
});

/**
 * The words of a text, for --grep: lower case, no accents, split on anything
 * that is not a letter or a digit, final vowel dropped from words longer than
 * three letters, so singular and plural meet (decesso, decessi -> decess). A
 * query word matches a word of the dataset that starts with it, in any order.
 */
function stems(text) {
    return String(text ?? '')
        .normalize('NFD').replace(/\p{M}/gu, '')
        .toLowerCase()
        .split(/[^\p{L}\p{N}]+/u)
        .filter(Boolean)
        .map((w) => (w.length > 3 && /[aeiou]$/.test(w) ? w.slice(0, -1) : w));
}

/**
 * One row per theme, in tree order, counting each dataset once under its
 * theme path and every theme above it, so the counts match `datasets --grep`
 * on the same path.
 */
function themeTree(rows) {
    const themes = new Map();
    for (const { category } of rows) {
        const labels = category.split(' > ');
        for (let i = 1; i <= labels.length; i++) {
            const path = labels.slice(0, i).join(' > ');
            if (!themes.has(path)) themes.set(path, { level: i, theme: labels[i - 1], datasets: 0, category: path });
            themes.get(path).datasets++;
        }
    }
    // Compare label by label, so a theme is followed by its own subthemes.
    const byPath = (a, b) => {
        const x = a.category.split(' > '), y = b.category.split(' > ');
        for (let i = 0; i < Math.min(x.length, y.length); i++) {
            const c = x[i].localeCompare(y[i], 'it');
            if (c) return c;
        }
        return x.length - y.length;
    };
    return [...themes.values()].sort(byPath);
}
