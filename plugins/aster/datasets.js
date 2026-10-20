// The datasets of one atlas, from its catalog.
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
        { name: 'lang', type: 'string', default: 'it', help: 'Language of titles and themes: it or en' },
    ],
    columns: ['id', 'title', 'category', 'atlas', 'table'],
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
        return rows;
    },
});
