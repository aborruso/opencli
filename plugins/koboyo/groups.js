// The taxonomy behind `--group`, so it can be chosen rather than guessed.
//
// The sidebar of koboyo.com/icons lists five groups and about ninety
// subgroups, and nothing else publishes that list: the data endpoints answer
// for a pair you already know. So this reads the sidebar, which the site
// renders on the server.
import { cli, Strategy } from '@jackwener/opencli/registry';
import { ArgumentError, EmptyResultError } from '@jackwener/opencli/errors';
import { taxonomy, BASE } from './shared.js';

cli({
    site: 'koboyo',
    name: 'groups',
    access: 'read',
    description: 'The icon taxonomy: every group/subgroup accepted by `search --group`, with how many icons each holds',
    example: 'opencli koboyo groups --group object',
    domain: 'koboyo.com',
    strategy: Strategy.PUBLIC,
    browser: false,
    args: [
        { name: 'group', type: 'string', default: '', help: 'Only the subgroups of one group: face, mark, object, people or scene' },
    ],
    columns: ['group', 'subgroup', 'count', 'filter', 'url'],
    func: async (args) => {
        const only = String(args.group ?? '').trim().toLowerCase();
        if (only && !/^[a-z0-9-]+$/.test(only)) {
            throw new ArgumentError(`invalid --group "${args.group}": expected a single group name, e.g. object`);
        }
        const rows = await taxonomy();
        const kept = only ? rows.filter((r) => r.group === only) : rows;
        if (kept.length === 0) {
            const groups = [...new Set(rows.map((r) => r.group))].join(', ');
            throw new EmptyResultError(`koboyo groups --group ${only}`, `no group called "${only}". The groups are ${groups}`);
        }
        return kept.map((r) => ({
            group: r.group,
            subgroup: r.subgroup,
            count: r.count,
            // Ready to paste after `search --group`.
            filter: `${r.group}/${r.subgroup}`,
            url: `${BASE}/icons/set/${r.group}/${r.subgroup}`,
        }));
    },
});
