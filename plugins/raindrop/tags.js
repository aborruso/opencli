import { cli, Strategy } from '@jackwener/opencli/registry';
import { apiGet, itemsFrom, collectionId, shapeError, requireRows } from './shared.js';

cli({
    site: 'raindrop', name: 'tags', access: 'read', browser: false,
    domain: 'api.raindrop.io', strategy: Strategy.PUBLIC,
    description: 'List Raindrop tags with counts, optionally in one collection or matching a substring; requires RAINDROP_TOKEN',
    example: 'opencli raindrop tags --grep cli',
    args: [
        { name: 'collection', type: 'int', help: 'Optional collection id; omit for all collections' },
        { name: 'grep', type: 'string', help: 'Case-insensitive substring of the tag name' },
    ],
    columns: ['tag', 'count'],
    func: async args => {
        const path = args.collection === undefined ? '/tags' : '/tags/' + collectionId(args.collection);
        const items = itemsFrom(await apiGet(path));
        const grep = String(args.grep ?? '').toLowerCase();
        const rows = items.map(item => {
            if (!item || typeof item._id !== 'string' || !Number.isSafeInteger(item.count) || item.count < 0) throw shapeError('tag');
            return { tag: item._id, count: item.count };
        }).filter(row => row.tag.toLowerCase().includes(grep));
        return requireRows(rows, 'tags', 'No tags match; try omitting --grep or --collection.');
    },
});
