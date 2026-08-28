// Controlled vocabularies behind "Browse by topic" and Advanced Search.
import { cli, Strategy } from '@jackwener/opencli/registry';
import { ArgumentError, EmptyResultError } from '@jackwener/opencli/errors';
import { apiGet } from './shared.js';

// The 21 EuroVoc domains are the homepage's "Browse by topic" tiles.
const KINDS = {
    eurovoc: 'EUROVOC',
    'policy-area': 'POLICY_AREA',
    'procedure-types': 'PROCEDURE_TYPES',
    'document-types': 'DOCUMENT_TYPES',
    'legal-basis-treaties': 'LEGAL_BASIS_TREATIES',
    'agent-names': 'AGENT_NAMES',
    'activity-types': 'ACTIVITY_TYPES',
    'activities-agents': 'ACTIVITIES_AGENTS',
};

cli({
    site: 'law-tracker',
    name: 'topics',
    access: 'read',
    description: 'Controlled vocabularies for building searches (EuroVoc, policy areas, procedure types…)',
    example: 'opencli law-tracker topics eurovoc',
    domain: 'law-tracker.europa.eu',
    strategy: Strategy.PUBLIC,
    browser: false,
    args: [
        { name: 'kind', type: 'string', positional: true, required: false, default: 'eurovoc', help: `Vocabulary: ${Object.keys(KINDS).join(', ')}` },
        { name: 'lang', type: 'string', default: 'en', help: 'Interface language' },
    ],
    columns: ['code', 'label', 'hasChildren'],
    func: async (args) => {
        const kind = String(args.kind ?? 'eurovoc');
        const table = KINDS[kind];
        if (!table) throw new ArgumentError(`invalid kind "${kind}": expected one of ${Object.keys(KINDS).join(', ')}`);
        const res = await apiGet('/advanced-search/dropdown/nodes', { dropdownTables: table }, args.lang ?? 'en');
        const nodes = Array.isArray(res?.[table]) ? res[table] : [];
        if (nodes.length === 0) {
            throw new EmptyResultError(`law-tracker topics ${kind}`, 'Empty vocabulary');
        }
        return nodes.map((n) => ({
            code: n.code ?? null,
            label: n.label ?? null,
            hasChildren: Boolean(n.hasChildren),
        }));
    },
});
