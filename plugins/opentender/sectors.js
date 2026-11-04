// CPV divisions (2-digit sectors) with their number of tenders.
import { cli, Strategy } from '@jackwener/opencli/registry';
import { CommandExecutionError, EmptyResultError } from '@jackwener/opencli/errors';
import { apiFetch, checkCountry } from './shared.js';

cli({
    site: 'opentender',
    name: 'sectors',
    access: 'read',
    description: 'CPV divisions (2-digit market sectors) with their number of tenders; the code is what `tenders --cpv` takes (no browser)',
    example: 'opencli opentender sectors --country it',
    domain: 'opentender.eu',
    strategy: Strategy.PUBLIC,
    browser: false,
    args: [
        { name: 'country', type: 'string', default: 'all', help: 'Portal id (it, de, uk, eu, ...) or all; see `opencli opentender stats`' },
    ],
    columns: ['cpv', 'name', 'tenders'],
    func: async (args) => {
        const cc = checkCountry(args.country);
        const json = await apiFetch(`${cc}/sector/list/main`, {}, 'the sector list');
        const data = json?.data;
        if (!data || typeof data !== 'object') {
            throw new CommandExecutionError('the sector list has no data object: the response shape changed');
        }
        const rows = Object.entries(data)
            .map(([cpv, s]) => ({ cpv, name: s.name ?? null, tenders: s.value ?? null }))
            .sort((a, b) => a.cpv.localeCompare(b.cpv));
        if (rows.length === 0) {
            throw new EmptyResultError(`opentender sectors --country ${cc}`, 'no sector: the tenders of this portal may carry no CPV code');
        }
        return rows;
    },
});
