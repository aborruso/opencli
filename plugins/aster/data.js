// The data of one dataset, as one row per observation.
import { cli, Strategy } from '@jackwener/opencli/registry';
import { ArgumentError, EmptyResultError } from '@jackwener/opencli/errors';
import {
    DEFAULT_ATLAS, checkLang, checkDatasetId, resolveAtlas, fetchStructure, fetchData, flattenJsonStat,
} from './shared.js';

/**
 * `--filter "SEX=1+2 DATA_TYPE=DEATHRATE"`: dimensions separated by spaces or
 * `;`, codes by `+`. `DIM=*` takes every value of the dimension.
 */
function parseFilter(input, dims) {
    const out = new Map();
    for (const part of String(input ?? '').split(/[\s;]+/).filter(Boolean)) {
        const m = part.match(/^([^=]+)=(.+)$/);
        if (!m) throw new ArgumentError(`invalid --filter part "${part}". Expected DIM=code1+code2, or DIM=* for every value`);
        const dim = m[1].trim().toUpperCase();
        if (!dims.includes(dim)) {
            throw new ArgumentError(`--filter names "${m[1]}", not a dimension of this dataset. Its dimensions: ${dims.join(', ')}`);
        }
        out.set(dim, m[2] === '*' ? '*' : m[2].split('+').map((c) => c.trim()).filter(Boolean));
    }
    return out;
}

function timeFilter(dim, args) {
    const last = args.last;
    const from = args.from;
    const to = args.to;
    if (last != null && (from || to)) throw new ArgumentError('use either --last or --from/--to, not both');
    if (last != null) {
        const n = Number(last);
        if (!Number.isInteger(n) || n < 1) throw new ArgumentError(`invalid --last "${last}": a whole number of periods, >= 1`);
        return { id: dim, filterValues: [], type: 'TimePeriod', period: n };
    }
    if (!from && !to) return null;
    // The hub takes full dates only: a bare year answers HTTP 400.
    const date = (v, end) => {
        const s = String(v).trim();
        if (/^\d{4}$/.test(s)) return end ? `${s}-12-31` : `${s}-01-01`;
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
        throw new ArgumentError(`invalid date "${v}": use YYYY or YYYY-MM-DD`);
    };
    return { id: dim, type: 'TimeRange', from: date(from ?? '1900', false), to: date(to ?? '2100', true) };
}

cli({
    site: 'aster',
    name: 'data',
    access: 'read',
    description: 'Data of one aster dataset, one row per observation with code and label of every dimension. Starts from the filter the web table opens with; --filter, --last, --from/--to change it (no browser)',
    example: 'opencli aster data "IT1,26_29,1.0" --filter "SEX=9 DATA_TYPE=LIFEEXP0" --last 3',
    domain: 'aster.istat.it',
    strategy: Strategy.PUBLIC,
    browser: false,
    args: [
        { name: 'id', type: 'string', positional: true, required: true, help: 'Dataset id as agency,id,version, e.g. IT1,26_29,1.0' },
        { name: 'atlas', type: 'string', default: DEFAULT_ATLAS, help: 'Atlas code or id, see `opencli aster atlases`' },
        { name: 'filter', type: 'string', help: 'Codes per dimension, e.g. "SEX=1+2 TERRITORIO=01+02"; DIM=* for every value. Dimensions not named keep the default of the web table (see `opencli aster dataset <id>`), codes from `opencli aster values <id> <DIM>`' },
        { name: 'last', type: 'int', help: 'Last N time periods' },
        { name: 'from', type: 'string', help: 'Start of the time range, YYYY or YYYY-MM-DD' },
        { name: 'to', type: 'string', help: 'End of the time range, YYYY or YYYY-MM-DD' },
        { name: 'lang', type: 'string', default: 'it', help: 'Language of the labels: it or en' },
    ],
    // No `columns`: they are the dimensions of the dataset, a code column and
    // a `_label` column each, then `value`. Every row has the same keys.
    func: async (args) => {
        const id = checkDatasetId(args.id);
        const lang = checkLang(args.lang);
        const atlas = await resolveAtlas(args.atlas, lang);
        const s = await fetchStructure(atlas.nodeId, atlas.code, id, lang);
        const dims = s.criteria.map((c) => c.id);
        const chosen = parseFilter(args.filter, dims);
        const timeDim = s.timeDimension;
        const time = timeDim ? timeFilter(timeDim, args) : null;
        if (!timeDim && (args.last != null || args.from || args.to)) {
            throw new ArgumentError(`dataset ${id} has no time dimension: --last, --from and --to do not apply`);
        }
        // The time dimension is filtered by period or range, never by codes:
        // the hub's time filters are TimePeriod and TimeRange.
        if (chosen.has(timeDim)) {
            throw new ArgumentError(`${timeDim} is set with --last or --from/--to, not with --filter`);
        }

        // Start from the web table's own filter, then apply the user's.
        const filters = new Map((s.template?.criteria ?? []).map((c) => [c.id, c]));
        for (const [dim, codes] of chosen) {
            if (codes === '*') filters.delete(dim);
            else filters.set(dim, { id: dim, filterValues: codes, type: 'CodeValues', period: 0 });
        }
        if (time) filters.set(timeDim, time);

        const rows = flattenJsonStat(await fetchData(atlas.nodeId, id, [...filters.values()], lang));
        if (rows.length === 0) {
            throw new EmptyResultError(`aster data ${id}`, 'no observation for this filter: check the codes with opencli aster values <id> <DIM>, and the time range');
        }
        return rows;
    },
});
