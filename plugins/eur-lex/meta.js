// Metadata of an EU act from the Cellar SPARQL endpoint.
import { cli, Strategy } from '@jackwener/opencli/registry';
import { EmptyResultError } from '@jackwener/opencli/errors';
import { resolveCelex, sparql, eurlexUrl } from './shared.js';

const PREFIXES = `PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>`;

cli({
    site: 'eur-lex',
    name: 'meta',
    access: 'read',
    description: 'Title, date, type, ELI, legal dates and EuroVoc concepts of an EU act',
    example: 'opencli eur-lex meta 32024R1689',
    domain: 'eur-lex.europa.eu',
    strategy: Strategy.PUBLIC,
    browser: false,
    args: [
        { name: 'celex', type: 'string', positional: true, required: true, help: 'CELEX number (32024R1689) or ELI (reg/2024/1689/oj)' },
        { name: 'lang', type: 'string', default: 'en', help: 'Language of titles and labels, ISO 639-1' },
    ],
    columns: ['celex', 'eli', 'date', 'type', 'in_force', 'entry_into_force', 'transposition', 'end_of_validity', 'title', 'eurovoc', 'work', 'url'],
    func: async (args) => {
        const celex = await resolveCelex(args.celex);
        const lang = String(args.lang ?? 'en').toLowerCase();
        const langUri = { en: 'ENG', it: 'ITA', fr: 'FRA', de: 'DEU', es: 'SPA' }[lang] ?? lang.toUpperCase();

        const head = await sparql(`${PREFIXES}
SELECT ?w ?eli ?date ?type ?title WHERE {
  ?w cdm:resource_legal_id_celex "${celex}"^^<http://www.w3.org/2001/XMLSchema#string> .
  OPTIONAL { ?w cdm:resource_legal_eli ?eli }
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

        // Separate query: entry into force is multi-valued for acts that apply
        // in stages (the AI Act has five dates), and would multiply the head rows.
        const legal = await sparql(`${PREFIXES}
SELECT (GROUP_CONCAT(DISTINCT STR(?eif); separator=" ") AS ?eif) (SAMPLE(?tr) AS ?tr) (SAMPLE(?end) AS ?end) (SAMPLE(?inf) AS ?inf) WHERE {
  ?w cdm:resource_legal_id_celex "${celex}"^^<http://www.w3.org/2001/XMLSchema#string> .
  OPTIONAL { ?w cdm:resource_legal_date_entry-into-force ?eif }
  OPTIONAL { ?w cdm:directive_date_transposition ?tr }
  OPTIONAL { ?w cdm:resource_legal_date_end-of-validity ?end }
  OPTIONAL { ?w cdm:resource_legal_in-force ?inf }
}`);
        const l = legal?.results?.bindings?.[0] ?? {};
        const inForce = l.inf?.value;
        const end = l.end?.value ?? null;

        return [{
            celex,
            // Adopted acts only: proposals have no ELI.
            eli: row.eli?.value ?? null,
            date: row.date?.value ?? null,
            // The resource-type URI ends with the code: REG, DIR, DEC…
            type: row.type?.value ? row.type.value.split('/').pop() : null,
            in_force: inForce == null ? null : inForce === 'true' || inForce === '1',
            entry_into_force: l.eif?.value ? l.eif.value.split(' ').sort().join('; ') : null,
            // Directives only: the deadline for Member States to transpose.
            transposition: l.tr?.value ?? null,
            // Cellar writes 9999-12-31 for an act with no end date.
            end_of_validity: end === '9999-12-31' ? null : end,
            title: row.title?.value ?? null,
            eurovoc: eurovoc.join('; '),
            work: row.w?.value ?? null,
            url: eurlexUrl(celex),
        }];
    },
});
