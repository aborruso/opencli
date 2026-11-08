import { cli, Strategy } from '@jackwener/opencli/registry';
import { apiGet, itemsFrom, shapeError, requireRows } from './shared.js';

cli({
    site: 'raindrop', name: 'collections', access: 'read', browser: false,
    domain: 'api.raindrop.io', strategy: Strategy.PUBLIC,
    description: 'List root and nested Raindrop collections and their bookmark counts; requires RAINDROP_TOKEN',
    example: 'opencli raindrop collections',
    args: [],
    columns: ['id', 'title', 'parent_id', 'count'],
    func: async () => {
        const roots = itemsFrom(await apiGet('/collections'));
        const children = itemsFrom(await apiGet('/collections/childrens'));
        // The child endpoint can repeat a root record. A collection has one id.
        const records = new Map();
        const rows = [...roots, ...children].map(item => {
            if (!item || !Number.isSafeInteger(item._id) || typeof item.title !== 'string' ||
                !Number.isSafeInteger(item.count) || item.count < 0) throw shapeError('collection');
            return { id: item._id, title: item.title, parent_id: item.parent?.$id ?? null, count: item.count };
        });
        for (const row of rows) records.set(row.id, row);
        return requireRows([...records.values()], 'collections', 'No user collections exist. Search collection 0 (all except Trash) or -1 (Unsorted).');
    },
});
