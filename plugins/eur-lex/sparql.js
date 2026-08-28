// Raw SPARQL against the Publications Office endpoint, in long format.
import { cli, Strategy } from '@jackwener/opencli/registry';
import { ArgumentError, EmptyResultError } from '@jackwener/opencli/errors';
import { sparql } from './shared.js';

cli({
    site: 'eur-lex',
    name: 'sparql',
    access: 'read',
    description: 'Run a SPARQL query against the Cellar endpoint (one row per binding)',
    example: 'opencli eur-lex sparql "SELECT ?s WHERE { ?s ?p ?o } LIMIT 5"',
    domain: 'eur-lex.europa.eu',
    strategy: Strategy.PUBLIC,
    browser: false,
    args: [
        { name: 'query', type: 'string', positional: true, required: true, help: 'The SPARQL query' },
    ],
    // Bindings are not known ahead of time, so results come back long:
    // one row per variable per result row.
    columns: ['row', 'variable', 'value'],
    func: async (args) => {
        const query = String(args.query ?? '').trim();
        if (!query) throw new ArgumentError('the query is empty');
        const res = await sparql(query);
        const bindings = res?.results?.bindings ?? [];
        if (bindings.length === 0) throw new EmptyResultError('eur-lex sparql', 'the query returned no bindings');
        const out = [];
        bindings.forEach((b, i) => {
            for (const [variable, cell] of Object.entries(b)) {
                out.push({ row: i, variable, value: cell?.value ?? null });
            }
        });
        return out;
    },
});
