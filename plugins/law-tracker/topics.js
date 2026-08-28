// Vocabolari controllati che alimentano "Browse by topic" e la Advanced Search.
import { cli, Strategy } from '@jackwener/opencli/registry';
import { ArgumentError, EmptyResultError } from '@jackwener/opencli/errors';
import { apiGet } from './shared.js';

// I 21 domini EuroVoc sono le tessere di "Browse by topic" della homepage.
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
    description: 'Vocabolari controllati per costruire le ricerche (EuroVoc, policy area, tipi di procedura…)',
    example: 'opencli law-tracker topics eurovoc',
    domain: 'law-tracker.europa.eu',
    strategy: Strategy.PUBLIC,
    browser: false,
    args: [
        { name: 'kind', type: 'string', positional: true, required: false, default: 'eurovoc', help: `Vocabolario: ${Object.keys(KINDS).join(', ')}` },
        { name: 'lang', type: 'string', default: 'en', help: 'Lingua dell\'interfaccia' },
    ],
    columns: ['code', 'label', 'hasChildren'],
    func: async (args) => {
        const kind = String(args.kind ?? 'eurovoc');
        const table = KINDS[kind];
        if (!table) throw new ArgumentError(`kind "${kind}" non valido: attesi ${Object.keys(KINDS).join(', ')}`);
        const res = await apiGet('/advanced-search/dropdown/nodes', { dropdownTables: table }, args.lang ?? 'en');
        const nodes = Array.isArray(res?.[table]) ? res[table] : [];
        if (nodes.length === 0) {
            throw new EmptyResultError(`law-tracker topics ${kind}`, 'Vocabolario vuoto');
        }
        return nodes.map((n) => ({
            code: n.code ?? null,
            label: n.label ?? null,
            hasChildren: Boolean(n.hasChildren),
        }));
    },
});
