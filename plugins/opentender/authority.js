// One OpenTender contracting authority record by id: address, identifiers, contacts,
// contracts and their total value. One record is one spelling of the name:
// other records of the same organisation are found with `authorities`.
import { cli, Strategy } from '@jackwener/opencli/registry';
import { checkCountry, getById, recordRow, RECORD_COLUMNS } from './shared.js';

cli({
    site: 'opentender',
    name: 'authority',
    access: 'read',
    description: 'One OpenTender contracting authority record by id: address, identifiers, contacts, contracts and their total value (no browser)',
    example: 'opencli opentender authority IT_body_1b74e560d58428feca3d5e9b27af3282f2365a923afd7db4c16a86761d9d30f9',
    domain: 'opentender.eu',
    strategy: Strategy.PUBLIC,
    browser: false,
    args: [
        { name: 'id', positional: true, required: true, help: 'Record id, from `opencli opentender authorities`' },
        { name: 'country', type: 'string', default: 'all', help: 'Portal id, only used for the page link' },
    ],
    columns: RECORD_COLUMNS,
    func: async (args) => {
        const cc = checkCountry(args.country);
        return [recordRow(cc, 'authority', await getById(cc, 'authority', String(args.id).trim()))];
    },
});
