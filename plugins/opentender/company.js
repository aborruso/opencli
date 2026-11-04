// One OpenTender supplier record by id: address, identifiers, contacts,
// contracts and their total value. One record is one spelling of the name:
// other records of the same organisation are found with `companies`.
import { cli, Strategy } from '@jackwener/opencli/registry';
import { checkCountry, getById, recordRow, RECORD_COLUMNS } from './shared.js';

cli({
    site: 'opentender',
    name: 'company',
    access: 'read',
    description: 'One OpenTender supplier record by id: address, identifiers, contacts, contracts and their total value (no browser)',
    example: 'opencli opentender company EU_body_a616d08cfd6050245824772190bd099bebf890c05604849933c1d88bb2977f59',
    domain: 'opentender.eu',
    strategy: Strategy.PUBLIC,
    browser: false,
    args: [
        { name: 'id', positional: true, required: true, help: 'Record id, from `opencli opentender companies`' },
        { name: 'country', type: 'string', default: 'all', help: 'Portal id, only used for the page link' },
    ],
    columns: RECORD_COLUMNS,
    func: async (args) => {
        const cc = checkCountry(args.country);
        return [recordRow(cc, 'company', await getById(cc, 'company', String(args.id).trim()))];
    },
});
