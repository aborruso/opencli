// One dataset of the ISTAT Data Browser, by its id.
//
// Straight from the node catalog: no AI call, so this one does not spend any of
// the node's search budget. It is what `ask` gives you for a single id you
// already know, plus the SDMX structure URL.
import { cli, Strategy } from '@jackwener/opencli/registry';
import { ArgumentError } from '@jackwener/opencli/errors';
import {
    checkLang, checkDatasetId, fetchCatalog, buildIndex,
    tableUrl, sdmxUrls, categoryPath,
} from './shared.js';

cli({
    site: 'istatdata',
    name: 'dataset',
    access: 'read',
    description: 'Title, category path and download URLs of one ISTAT dataset, by id (no browser, no AI call)',
    example: 'opencli istatdata dataset "IT1,41_287_DF_DCIS_INDINCIDENT_1,1.0"',
    domain: 'esploradati.istat.it',
    strategy: Strategy.PUBLIC,
    browser: false,
    args: [
        { name: 'id', type: 'string', positional: true, required: true, help: 'Dataset id as agency,id,version, e.g. IT1,41_287_DF_DCIS_INDINCIDENT_1,1.0' },
        { name: 'lang', type: 'string', default: 'it', help: 'Language of titles and category labels: it or en' },
        { name: 'node', type: 'int', default: 1, help: 'Data Browser node id' },
    ],
    columns: ['id', 'title', 'category', 'datasetType', 'table', 'data', 'structure', 'referenceMetadata'],
    func: async (args) => {
        const id = checkDatasetId(args.id);
        const lang = checkLang(args.lang);
        const node = Number(args.node ?? 1);
        if (!Number.isInteger(node) || node < 1) throw new ArgumentError('node must be an integer >= 1');

        const index = buildIndex(await fetchCatalog(node, lang));
        const meta = index.get(id);
        // An id that is not in the catalog is a bad argument, not an empty
        // result: the catalog is the full list of what this node publishes.
        if (!meta) {
            throw new ArgumentError(`node ${node} has no dataset "${id}". Find the right id with: opencli istatdata ask "<question>"`);
        }

        const links = sdmxUrls(id);
        return [{
            id,
            title: meta.title || null,
            category: categoryPath(meta.categoryLabels),
            datasetType: meta.datasetType || null,
            table: tableUrl(id, meta.categoryIds, lang),
            data: links.data,
            structure: links.structure,
            referenceMetadata: meta.referenceMetadata || null,
        }];
    },
});
