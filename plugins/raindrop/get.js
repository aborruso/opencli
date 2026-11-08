import { cli, Strategy } from '@jackwener/opencli/registry';
import { apiGet, bookmarkId, bookmarkRow, BOOKMARK_COLUMNS } from './shared.js';

cli({
    site: 'raindrop', name: 'get', access: 'read', browser: false,
    domain: 'api.raindrop.io', strategy: Strategy.PUBLIC,
    description: 'Get one saved Raindrop bookmark with its note, tags and metadata; requires RAINDROP_TOKEN',
    example: 'opencli raindrop get 1670248805',
    args: [{ name: 'id', type: 'string', positional: true, required: true, help: 'Bookmark id from search, not a collection id' }],
    columns: BOOKMARK_COLUMNS,
    func: async args => {
        const body = await apiGet('/raindrop/' + bookmarkId(args.id));
        return [bookmarkRow(body.item)];
    },
});
