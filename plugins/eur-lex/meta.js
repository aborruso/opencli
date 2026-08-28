// Metadata of an EU act from the Cellar SPARQL endpoint.
import { cli, Strategy } from '@jackwener/opencli/registry';
import { EmptyResultError } from '@jackwener/opencli/errors';
import { checkCelex, sparql, eurlexUrl } from './shared.js';

const PREFIXES = `PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>`;

cli({
    site: 'eur-lex',
    name: 'meta',
    access: 'read',
    description: 'Title, date, type and EuroVoc concepts of an EU act',
    example: 'opencli eur-lex meta 32024R1689',
    domain: 'eur-lex.europa.eu',
    strategy: Strategy.PUBLIC,
    browser: false,
    args: [
        { name: 'celex', type: 'string', positional: true, required: true, help: 'CELEX number, e.g. 32024R1689' },
        { name: 'lang', type: 'string', default: 'en', help: 'Language of titles and labels, ISO 639-1' },
    ],
    columns: ['celex', 'date', 'type', 'title', 'eurovoc', 'work', 'url'],
    func: async (args) => {
        const celex = checkCelex(args.celex);
        const lang = String(args.lang ?? 'en').toLowerCase();
        const langUri = { en: 'ENG', it: 'ITA', fr: 'FRA', de: 'DEU', es: 'SPA' }[lang] ?? lang.toUpperCase();

        const head = await sparql(`${PREFIXES}
SELECT ?w ?date ?type ?title WHERE {
  ?w cdm:resource_legal_id_celex "${celex}"^^<http://www.w3.org/2001/XMLSchema#string> .
  OPTIONAL { ?w cdm:work_date_document ?date }
  OPTIONAL { ?w cdm:work_has_resource-type ?type }
  OPTIONAL {
    ?e cdm:expression_belongs_to_work ?w ;
       cdm:expression_uses_language <http://publications.europa.eu/resource/authority/language/${langUri}> ;
       cdm:expression_title ?title
  }
} LIMIT 1`);
        const row = head?.results?.bindings?.[0];
        if (!row) throw new EmptyResultError(`eur-lex meta ${celex}`, 'no work with this CELEX in Cellar');

        const topics = await sparql(`${PREFIXES}
SELECT ?label WHERE {
  ?w cdm:resource_legal_id_celex "${celex}"^^<http://www.w3.org/2001/XMLSchema#string> ;
     cdm:work_is_about_concept_eurovoc ?c .
  ?c skos:prefLabel ?label . FILTER(lang(?label) = "${lang}")
} LIMIT 40`);
        const eurovoc = (topics?.results?.bindings ?? []).map((b) => b.label?.value).filter(Boolean);

        return [{
            celex,
            date: row.date?.value ?? null,
            // The resource-type URI ends with the code: REG, DIR, DEC…
            type: row.type?.value ? row.type.value.split('/').pop() : null,
            title: row.title?.value ?? null,
            eurovoc: eurovoc.join('; '),
            work: row.w?.value ?? null,
            url: eurlexUrl(celex),
        }];
    },
});
