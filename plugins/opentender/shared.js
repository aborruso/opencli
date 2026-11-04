// Shared helpers for the opentender adapters.
//
// opentender.eu (Government Transparency Institute) sits behind a Cloudflare
// managed challenge: every path of the portal answers 403 to a script. The data
// server behind it, api.opentender.eu, answers without key or cookie. It is an
// undocumented product-internal API: routes from yigit-serin/opentender-backend
// (server.js, lib/queries.js), filter fields from arnese/opentender-frontend
// (src/app/model/filters.ts), every contract below checked live.
//
// Verified live on 2026-11-04:
//   GET  /api/portals/stats                  tenders per country portal
//   GET  /api/{cc}/sector/list/main          CPV divisions with counts
//   POST /api/{cc}/tender|company|authority/search
//   GET  /api/{cc}/tender|company|authority/id/{id}
// {cc} is a portal id (it, de, uk, eu, ...) or `all`; a portal adds a country
// term to the query. An unknown portal answers HTTP 404.
//
// No rate limit is declared. The commands call the server serially.
import { ArgumentError, CommandExecutionError, EmptyResultError } from '@jackwener/opencli/errors';

export const API = 'https://api.opentender.eu/api';
export const PORTAL = 'https://opentender.eu';
const UA = 'opencli-opentender/0.1';

// Elasticsearch window: from + size beyond 10000 answers HTTP 400.
export const MAX_RESULTS = 10000;
const PAGE = 100;

export function checkCountry(input) {
    const cc = String(input ?? 'all').trim().toLowerCase();
    if (!/^(all|[a-z]{2})$/.test(cc)) {
        throw new ArgumentError(`invalid --country "${input}": a two-letter portal id (it, de, uk, eu, ...) or all; see \`opencli opentender stats\``);
    }
    return cc;
}

export function checkLimit(input) {
    const n = Number(input);
    if (!Number.isInteger(n) || n < 1 || n > MAX_RESULTS) {
        throw new ArgumentError(`invalid --limit "${input}": 1 to ${MAX_RESULTS}, the most the server returns for one search`);
    }
    return n;
}

/**
 * One call to the data server. Returns the parsed body, or null on HTTP 404
 * when `notFoundIsNull` (an unknown id); any other 404 is an unknown portal.
 */
export async function apiFetch(path, { body, notFoundIsNull = false } = {}, what = 'the OpenTender data server') {
    let res;
    try {
        res = await fetch(`${API}/${path}`, {
            method: body ? 'POST' : 'GET',
            headers: {
                accept: 'application/json',
                'user-agent': UA,
                ...(body ? { 'content-type': 'application/json' } : {}),
            },
            body: body ? JSON.stringify(body) : undefined,
        });
    } catch (e) {
        throw new CommandExecutionError(`${what} is unreachable: ${e.message}${e.cause?.code ? ` (${e.cause.code})` : ''}`);
    }
    if (res.status === 404) {
        if (notFoundIsNull) return null;
        throw new ArgumentError(`the OpenTender data server answered 404 for /api/${path.split('/')[0]}/: unknown portal, see \`opencli opentender stats\` for the ids`);
    }
    if (res.status === 429) {
        throw new CommandExecutionError('the OpenTender data server refused the request for rate limiting (HTTP 429): retry later');
    }
    if (!res.ok) throw new CommandExecutionError(`${what} answered HTTP ${res.status}`);
    let json;
    try {
        json = await res.json();
    } catch {
        throw new CommandExecutionError(`non-JSON response from ${what}`);
    }
    if (json && json.error) throw new CommandExecutionError(`${what} answered with an error: ${json.error}`);
    return json;
}

/**
 * Runs a search and pages through it, PAGE hits at a time, up to `limit`.
 * Returns { hits, total }.
 */
export async function search(cc, entity, filters, { limit, sort } = {}) {
    const hits = [];
    let total = null;
    while (hits.length < limit) {
        const size = Math.min(PAGE, limit - hits.length);
        const body = { filters, size, from: hits.length };
        if (sort) body.sort = sort;
        const json = await apiFetch(`${cc}/${entity}/search`, { body }, `the ${entity} search`);
        const page = json?.data?.hits;
        if (!page || !Array.isArray(page.hits)) {
            throw new CommandExecutionError(`the ${entity} search answered without data.hits: the response shape changed`);
        }
        total = page.total?.value ?? total;
        hits.push(...page.hits);
        if (page.hits.length < size) break;
    }
    return { hits, total };
}

export async function getById(cc, entity, id) {
    const json = await apiFetch(`${cc}/${entity}/id/${encodeURIComponent(id)}`, { notFoundIsNull: true }, `the ${entity} record`);
    // tender/id puts the record in .data, company and authority in .data.<entity>
    const rec = json?.data?.[entity] ?? (entity === 'tender' ? json?.data : null);
    if (!rec || !rec.id) {
        throw new EmptyResultError(`opentender ${entity} ${id}`, `no ${entity} with this id on the "${cc}" portal; ids come from \`opencli opentender ${entity === 'company' ? 'companies' : entity === 'authority' ? 'authorities' : 'tenders'}\``);
    }
    return rec;
}

export const text = (field, value) => ({ field, type: 'text', value: [value] });

/** Portal page of a record. Route from the frontend; the portal itself is behind Cloudflare. */
export const pageUrl = (cc, entity, id) => `${PORTAL}/${cc}/${entity}/${id}`;

export const round2 = (v) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 100) / 100 : null);

/** One row of a company or authority record (search hit or id lookup). */
export function bodyRow(cc, entity, rec) {
    const b = rec.body ?? {};
    const row = {
        id: rec.id,
        name: b.name ?? null,
        city: b.address?.city ?? null,
        country: b.address?.country ?? null,
        contracts: b.contractsCount ?? null,
        total_value_eur: round2(b.totalValueOfContracts),
        years: b.dates?.awardDecisionYearsMinMax ?? null,
    };
    return { ...row, url: pageUrl(cc, entity, rec.id) };
}

const joinUnique = (xs) => {
    const out = [...new Set(xs.filter((x) => x != null && x !== ''))];
    return out.length ? out.join('; ') : null;
};

/**
 * One row of a tender. Three amounts, never summed into one: some sources
 * repeat the whole tender value on every lot (TED notice 444671-2016, two lots
 * of 21.4 M EUR for a 21.4 M EUR tender), so a sum of the winning bids can
 * double count. They are listed as they are, lot by lot.
 */
export function tenderRow(cc, t) {
    const lots = t.lots ?? [];
    const winning = lots.flatMap((l) => (l.bids ?? []).filter((b) => b.isWinning));
    const mainCpv = (t.cpvs ?? []).find((c) => c.isMain) ?? (t.cpvs ?? [])[0];
    const bidsEur = winning.map((b) => round2(b.price?.netAmountEur)).filter((v) => v != null);
    return {
        id: t.id,
        country: t.country ?? null,
        year: t.tenderYear ?? null,
        date: t.tenderPublicationDate ?? null,
        title: t.title ?? t.titleEnglish ?? null,
        buyers: joinUnique((t.buyers ?? []).map((b) => b.name)),
        winners: joinUnique(winning.flatMap((b) => (b.bidders ?? []).map((x) => x.name))),
        final_eur: round2(t.finalPrice?.netAmountEur),
        estimated_eur: round2(t.estimatedPrice?.netAmountEur),
        winning_bids_eur: bidsEur.length ? bidsEur.join('; ') : null,
        cpv: mainCpv?.code ?? null,
        procedure: t.procedureType ?? null,
        source: joinUnique((t.publications ?? []).map((p) => p.humanReadableUrl)),
        url: pageUrl(cc, 'tender', t.id),
    };
}

/**
 * The full row of one company or authority record: the search columns plus
 * address, identifiers, contacts and the record's provenance.
 */
export function recordRow(cc, entity, rec) {
    const b = rec.body ?? {};
    const a = b.address ?? {};
    const ids = (b.bodyIds ?? []).filter((x) => x.id).map((x) => `${x.type ?? 'ID'}:${x.id}`);
    const market = b.sector?.mostFrequentMarket;
    const { url, ...head } = bodyRow(cc, entity, rec);
    return {
        ...head,
        street: a.street ?? null,
        postcode: a.postcode ?? null,
        nuts: (a.nuts ?? [])[0] ?? null,
        identifiers: ids.length ? [...new Set(ids)].join('; ') : null,
        is_sme: b.isSme ?? null,
        buyer_type: b.buyerType ?? null,
        main_activities: (b.mainActivities ?? []).join('; ') || null,
        main_market: market?.key ? `${market.key} ${market.label ?? ''}`.trim() : null,
        email: b.email ?? null,
        phone: b.phone ?? null,
        website: a.url ?? null,
        integrity_score: round2(b.indicator?.integrityIndicatorCompositionScore),
        transparency_score: round2(b.indicator?.transparencyIndicatorCompositionScore),
        datasets: (rec.datasets ?? []).join('; ') || null,
        url,
    };
}

export const RECORD_COLUMNS = ['id', 'name', 'city', 'country', 'contracts', 'total_value_eur', 'years', 'street', 'postcode', 'nuts', 'identifiers', 'is_sme', 'buyer_type', 'main_activities', 'main_market', 'email', 'phone', 'website', 'integrity_score', 'transparency_score', 'datasets', 'url'];
