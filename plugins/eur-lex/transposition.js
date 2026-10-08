// National measures that transpose an EU directive, from the Cellar SPARQL endpoint.
//
// Member States notify their implementing measures to the Commission, and
// Cellar stores each one as a work pointing at the directive with
// cdm:measure_national_implementing_implements_resource_legal. Regulations
// apply directly and have none.
import { cli, Strategy } from '@jackwener/opencli/registry';
import { ArgumentError, EmptyResultError } from '@jackwener/opencli/errors';
import { resolveCelex, sparql } from './shared.js';

const COUNTRY = 'http://publications.europa.eu/resource/authority/country/';

cli({
    site: 'eur-lex',
    name: 'transposition',
    access: 'read',
    description: 'National measures transposing an EU directive, by Member State',
    example: 'opencli eur-lex transposition 32016L0680 --country ITA',
    domain: 'eur-lex.europa.eu',
    strategy: Strategy.PUBLIC,
    browser: false,
    args: [
        { name: 'celex', type: 'string', positional: true, required: true, help: 'CELEX number (32016L0680) or ELI (dir/2016/680/oj) of the directive' },
        { name: 'country', type: 'string', default: '', help: 'Only this Member State, ISO 3166 alpha-3 (ITA, FRA, DEU…)' },
    ],
    // The national title is long and in the national language: last column.
    columns: ['country', 'date', 'type', 'celex', 'eli', 'link', 'title'],
    func: async (args) => {
        const celex = await resolveCelex(args.celex);
        const country = String(args.country ?? '').trim().toUpperCase();
        if (country && !/^[A-Z]{3}$/.test(country)) {
            throw new ArgumentError(`invalid --country "${args.country}": expected an ISO 3166 alpha-3 code such as ITA`);
        }

        const res = await sparql(`PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>
SELECT ?country ?celex ?date ?type ?title ?link ?eli WHERE {
  ?w cdm:resource_legal_id_celex "${celex}"^^<http://www.w3.org/2001/XMLSchema#string> .
  ?m cdm:measure_national_implementing_implements_resource_legal ?w ;
     cdm:resource_legal_id_celex ?celex .
  # A measure often transposes several directives and has one CELEX per
  # directive (sector 7 + the directive's number): keep the one for this one.
  FILTER(STRSTARTS(?celex, "7${celex.slice(1)}"))
  ${country ? `?m cdm:measure_national_implementing_implemented_by_country <${COUNTRY}${country}> .` : ''}
  OPTIONAL { ?m cdm:measure_national_implementing_implemented_by_country ?country }
  OPTIONAL { ?m cdm:work_date_document ?date }
  OPTIONAL { ?m cdm:measure_national_implementing_type_act ?type }
  OPTIONAL { ?m cdm:work_title ?title }
  OPTIONAL { ?m cdm:measure_national_implementing_national_website_link ?link }
  OPTIONAL { ?m cdm:eli ?eli }
} ORDER BY ?country ?date ?celex`);
        const rows = res?.results?.bindings ?? [];
        if (rows.length === 0) {
            throw new EmptyResultError(
                `eur-lex transposition ${celex}${country ? ` --country ${country}` : ''}`,
                'no national implementing measures in Cellar. Only directives are transposed; regulations apply directly',
            );
        }
        return rows.map((b) => ({
            country: b.country?.value ? b.country.value.split('/').pop() : null,
            date: b.date?.value ?? null,
            type: b.type?.value ?? null,
            celex: b.celex?.value ?? null,
            // Some Member States publish an ELI or a link to the national text; Italy, so far, neither.
            eli: b.eli?.value ?? null,
            link: b.link?.value ?? null,
            title: b.title?.value ?? null,
        }));
    },
});
