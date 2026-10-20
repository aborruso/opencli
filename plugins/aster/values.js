// The values of one dimension of a dataset: the codes to pass to `data --filter`.
import { cli, Strategy } from '@jackwener/opencli/registry';
import { ArgumentError, EmptyResultError } from '@jackwener/opencli/errors';
import {
    DEFAULT_ATLAS, checkLang, checkDatasetId, resolveAtlas, fetchStructure, fetchValues,
} from './shared.js';

cli({
    site: 'aster',
    name: 'values',
    access: 'read',
    description: 'Codes and labels of one dimension of an aster dataset, only those with data (no browser)',
    example: 'opencli aster values "IT1,26_29,1.0" SEX',
    domain: 'aster.istat.it',
    strategy: Strategy.PUBLIC,
    browser: false,
    args: [
        { name: 'id', type: 'string', positional: true, required: true, help: 'Dataset id as agency,id,version, e.g. IT1,26_29,1.0' },
        { name: 'dimension', type: 'string', positional: true, required: true, help: 'Dimension id, see `opencli aster dataset <id>`' },
        { name: 'atlas', type: 'string', default: DEFAULT_ATLAS, help: 'Atlas code or id, see `opencli aster atlases`' },
        { name: 'lang', type: 'string', default: 'it', help: 'Language of the labels: it or en' },
    ],
    columns: ['dimension', 'code', 'name', 'parent', 'selectable'],
    func: async (args) => {
        const id = checkDatasetId(args.id);
        const lang = checkLang(args.lang);
        const dim = String(args.dimension ?? '').trim().toUpperCase();
        const atlas = await resolveAtlas(args.atlas, lang);
        // The values endpoint answers `{}` for a dimension the dataset does
        // not have: check it against the structure, one call earlier.
        const s = await fetchStructure(atlas.nodeId, atlas.code, id, lang);
        const dims = s.criteria.map((c) => c.id);
        if (!dims.includes(dim)) {
            throw new ArgumentError(`dataset ${id} has no dimension "${args.dimension}". Its dimensions: ${dims.join(', ')}`);
        }
        const values = await fetchValues(atlas.nodeId, id, dim, lang);
        if (values.length === 0) {
            throw new EmptyResultError(`aster values ${id} ${dim}`, 'the hub lists no value with data for this dimension');
        }
        return values.map((v) => ({
            dimension: dim,
            code: v.id,
            name: v.name ?? null,
            parent: v.parentId ?? null,
            selectable: v.isSelectable !== false,
        }));
    },
});
