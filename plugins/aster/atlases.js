// The atlases of aster.istat.it: one Data Browser node each.
import { cli, Strategy } from '@jackwener/opencli/registry';
import { EmptyResultError } from '@jackwener/opencli/errors';
import { checkLang, fetchAtlases } from './shared.js';

cli({
    site: 'aster',
    name: 'atlases',
    access: 'read',
    description: 'The atlases of the ISTAT Statistical Atlas of the Territory, with the code to pass as --atlas (no browser)',
    example: 'opencli aster atlases',
    domain: 'aster.istat.it',
    strategy: Strategy.PUBLIC,
    browser: false,
    args: [
        { name: 'lang', type: 'string', default: 'it', help: 'Language of the names: it or en' },
    ],
    columns: ['id', 'code', 'name', 'default'],
    func: async (args) => {
        const lang = checkLang(args.lang);
        const atlases = await fetchAtlases(lang);
        if (atlases.length === 0) {
            throw new EmptyResultError('aster atlases', 'the hub listed no atlas: the site may be down or changed');
        }
        return atlases
            .slice()
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
            .map((a) => ({
                id: a.nodeId,
                code: a.code,
                name: a.name || null,
                default: Boolean(a.default),
            }));
    },
});
