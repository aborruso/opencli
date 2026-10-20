// The structure of one dataset: its dimensions and the filter the web table
// opens with.
import { cli, Strategy } from '@jackwener/opencli/registry';
import {
    DEFAULT_ATLAS, checkLang, checkDatasetId, resolveAtlas, fetchStructure, tableUrl,
} from './shared.js';

// Above this many codes the default filter is only counted, not spelled out:
// a municipal dataset opens on ~8,000 territory codes.
const MAX_DEFAULT_CODES = 20;

function describeDefault(filter) {
    if (!filter) return { count: null, text: null };
    if (filter.type === 'TimePeriod') return { count: null, text: `last ${filter.period}` };
    if (filter.type === 'TimeRange') return { count: null, text: `${filter.from}..${filter.to}` };
    const values = filter.filterValues ?? [];
    return { count: values.length, text: values.length <= MAX_DEFAULT_CODES ? values.join('+') : null };
}

cli({
    site: 'aster',
    name: 'dataset',
    access: 'read',
    description: 'Dimensions of one aster dataset: label, codelist, role and the default filter of the web table (no browser)',
    example: 'opencli aster dataset "IT1,26_29,1.0"',
    domain: 'aster.istat.it',
    strategy: Strategy.PUBLIC,
    browser: false,
    args: [
        { name: 'id', type: 'string', positional: true, required: true, help: 'Dataset id as agency,id,version, e.g. IT1,26_29,1.0' },
        { name: 'atlas', type: 'string', default: DEFAULT_ATLAS, help: 'Atlas code or id, see `opencli aster atlases`' },
        { name: 'lang', type: 'string', default: 'it', help: 'Language of the labels: it or en' },
    ],
    columns: ['dataset', 'title', 'dimension', 'label', 'codelist', 'role', 'default_count', 'default', 'table'],
    func: async (args) => {
        const id = checkDatasetId(args.id);
        const lang = checkLang(args.lang);
        const atlas = await resolveAtlas(args.atlas, lang);
        const s = await fetchStructure(atlas.nodeId, atlas.code, id, lang);

        const defaults = new Map((s.template?.criteria ?? []).map((c) => [c.id, c]));
        const title = s.template?.title?.[lang] ?? null;
        const table = tableUrl(atlas.code, id, lang);
        return s.criteria.map((c) => {
            const d = describeDefault(defaults.get(c.id));
            const role = c.id === s.territorialDimension ? 'territory'
                : c.id === s.timeDimension ? 'time'
                    : c.id === s.freqDimension ? 'frequency' : null;
            return {
                dataset: id,
                title,
                dimension: c.id,
                label: c.label || null,
                codelist: c.extra?.DataStructureRef ?? null,
                role,
                default_count: d.count,
                default: d.text,
                table,
            };
        });
    },
});
