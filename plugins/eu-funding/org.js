// The Organisation Public Data service: one participant organisation, by its
// 9-digit PIC - profile, projects, partner searches, in a single document.
import { cli, Strategy } from '@jackwener/opencli/registry';
import { ArgumentError, EmptyResultError } from '@jackwener/opencli/errors';
import {
    KEYS, first, all, day, parseJson, boolQuery, terms,
    document, facets, labelMaps, decode,
} from './shared.js';

cli({
    site: 'eu-funding',
    name: 'org',
    access: 'read',
    description: 'Public data of one organisation registered on the EU Funding & Tenders Portal, by PIC: profile, project count, consortium roles, programmes (Organisation Public Data API, no browser)',
    example: 'opencli eu-funding org 999991722',
    domain: 'ec.europa.eu',
    strategy: Strategy.PUBLIC,
    browser: false,
    args: [
        { name: 'pic', type: 'string', positional: true, required: true, help: 'The 9-digit Participant Identification Code, e.g. 999991722' },
    ],
    defaultFormat: 'json',
    columns: ['pic', 'name', 'city', 'country', 'organisation_type', 'legal_status', 'validation', 'vat', 'registration', 'projects', 'roles', 'partner_searches', 'programmes', 'keywords', 'deprecated_pics', 'modified', 'url'],
    func: async (args) => {
        const pic = String(args.pic ?? '').trim();
        if (!/^\d{9}$/.test(pic)) throw new ArgumentError(`invalid PIC "${args.pic}": it is 9 digits, e.g. 999991722`);
        // The codes (country, type, programmes) are labelled by the facet API
        // filtered on this PIC alone: small and quick.
        const [doc, facetList] = await Promise.all([
            document(pic, KEYS.partners),
            facets({ key: KEYS.partners, query: boolQuery([terms('pic', [pic])]) }),
        ]);
        if (!doc) throw new EmptyResultError(`eu-funding org ${pic}`, 'no organisation has this PIC');
        const label = labelMaps(facetList);
        const m = doc.metadata ?? {};
        const roles = (parseJson(m.consortiumRoles) ?? []).map((r) => `${r.key}: ${r.value}`).join('; ');
        return [{
            pic: first(m.pic) || pic,
            name: first(m.name) || doc.summary,
            city: first(m.city),
            country: decode(m.country, label.get('country')),
            organisation_type: decode(m.organisationType, label.get('organisationType')),
            legal_status: first(m.legalEntityStatus),
            validation: decode(m.validationStatus, label.get('validationStatus')),
            vat: first(m.vat),
            registration: first(m.registrationNum),
            projects: first(m.noOfProjects),
            roles,
            partner_searches: first(m.noOfPartnerSearch),
            programmes: decode(m.programmes, label.get('programmes')),
            keywords: all(m.keywords),
            deprecated_pics: all(m.deprecatedPics),
            modified: day(m.lastModified),
            url: doc.url ?? first(m.url),
        }];
    },
});
