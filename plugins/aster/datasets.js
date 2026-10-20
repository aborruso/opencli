// The datasets of one atlas, from its catalog; with --tree, its theme tree
// with the number of datasets under each theme.
import { cli, Strategy } from '@jackwener/opencli/registry';
import { EmptyResultError } from '@jackwener/opencli/errors';
import {
    DEFAULT_ATLAS, checkLang, resolveAtlas, fetchCatalog, buildIndex, tableUrl, categoryPath,
} from './shared.js';

cli({
    site: 'aster',
    name: 'datasets',
    access: 'read',
    description: 'Datasets of one atlas of aster.istat.it: id, title, theme path and link to the table (no browser)',
    example: 'opencli aster datasets --atlas AST --grep popolazione',
    domain: 'aster.istat.it',
    strategy: Strategy.PUBLIC,
    browser: false,
    args: [
        { name: 'atlas', type: 'string', default: DEFAULT_ATLAS, help: 'Atlas code or id, see `opencli aster atlases`' },
        { name: 'grep', type: 'string', help: 'Keep datasets whose id, title or theme path contains this text (case-insensitive)' },
        { name: 'tree', type: 'boolean', default: false, help: 'List the themes instead of the datasets: one row per theme, with how many datasets it holds' },
        { name: 'lang', type: 'string', default: 'it', help: 'Language of titles and themes: it or en' },
    ],
    // No `columns`: without --tree the rows are id, title, category, atlas,
    // table; with --tree they are level, theme, datasets, category.
    func: async (args) => {
        const lang = checkLang(args.lang);
        const atlas = await resolveAtlas(args.atlas, lang);
        const index = buildIndex(await fetchCatalog(atlas.nodeId, lang));
        const needle = args.grep ? String(args.grep).toLowerCase() : null;

        const rows = [];
        for (const [id, meta] of index) {
            const category = categoryPath(meta.categoryLabels);
            if (needle && ![id, meta.title, category].some((v) => v && v.toLowerCase().includes(needle))) continue;
            rows.push({
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
                needle ? `no dataset matches "${args.grep}": try a shorter word, or the other language with --lang` : 'the atlas catalog is empty',
            );
        }
        return args.tree ? themeTree(rows) : rows;
    },
});

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
