// Tenders per country portal: the ids to pass as --country.
import { cli, Strategy } from '@jackwener/opencli/registry';
import { CommandExecutionError, EmptyResultError } from '@jackwener/opencli/errors';
import { apiFetch } from './shared.js';

cli({
    site: 'opentender',
    name: 'stats',
    access: 'read',
    description: 'OpenTender country portals with their number of tenders; the id is what --country takes (no browser)',
    example: 'opencli opentender stats',
    domain: 'opentender.eu',
    strategy: Strategy.PUBLIC,
    browser: false,
    args: [],
    columns: ['id', 'name', 'tenders'],
    func: async () => {
        const json = await apiFetch('portals/stats', {}, 'the portal list');
        if (!Array.isArray(json?.data)) {
            throw new CommandExecutionError('the portal list is not an array: the response shape changed');
        }
        if (json.data.length === 0) throw new EmptyResultError('opentender stats', 'the server listed no portal');
        return json.data.map((p) => ({ id: p.id, name: p.name, tenders: p.value }));
    },
});
