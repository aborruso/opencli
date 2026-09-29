// The free search of the Registro Imprese by company name, optionally within
// one province, through the real browser.
//
// The search form is a Liferay action POST guarded by reCAPTCHA Enterprise:
// the page executes the captcha, puts the token in a hidden field and submits,
// and the server checks the score. Without a token, or with a low score, the
// portal answers the same page with the results block empty and no message.
// Tokens are single use, so this cannot be a plain HTTP client: the command
// drives the site's own form in your Chrome, as a person would. Even for a
// person the first submit often comes back empty and the second works, so an
// empty results block is resubmitted, a few times, before giving up.
//
// The detail of a result is one click away and bound to the session that ran
// the search (its id is opaque and not reusable later), so `--detail` opens
// it here, row by row, and adds address, PEC, ATECO and the rest.
import { cli, Strategy } from '@jackwener/opencli/registry';
import { ArgumentError, CommandExecutionError, EmptyResultError } from '@jackwener/opencli/errors';
import { SITE, DOMAIN, SEARCH_URL, PROVINCES, suggestions } from './shared.js';

const NS = '_ricerca_ri_portlet_RiRicercaImpreseGratuitaPortlet_INSTANCE_o6uJEv91oybn_';
const RESULTS_PORTLET = 'p_p_id_ricerca_ri_portlet_RiRisultatiRicercaImpreseGratuitaPortlet_INSTANCE_qbyrOUi5rdhb_';
const SITE_KEY = '6LfzooUqAAAAAOuUJWKN_XmVsgxhsFc-YYjfjrej';
const SUBMITS = 3;
const PAGE_SIZES = [5, 10, 20, 30, 50, 75];
const COLUMNS = ['name', 'kind', 'city', 'legal_form', 'activity', 'status', 'address', 'province', 'phone', 'pec', 'ateco', 'ateco_label', 'id'];

/** A province by code, or by a piece of its name that picks exactly one. */
function provinceCode(value) {
    const s = String(value).trim().toUpperCase();
    if (PROVINCES[s]) return s;
    const hits = Object.entries(PROVINCES).filter(([, name]) => name.includes(s));
    if (hits.length === 1) return hits[0][0];
    throw new ArgumentError(`--province "${value}" matches ${hits.length ? `${hits.length} provinces: ${hits.map(([c, n]) => `${c} ${n}`).join('; ')}` : 'no province'}; give the two-letter code`);
}

/**
 * An activity or description of the suggester, by its exact text or by a
 * piece of it that picks exactly one: `{term, ateco, kind}` as the site's own
 * autocomplete would set them when that entry is picked.
 */
async function activityEntry(value) {
    const s = String(value).trim();
    const rows = (await suggestions(s)).filter((r) => r.kind !== 'name');
    const exact = rows.filter((r) => r.term.toLowerCase() === s.toLowerCase());
    const hits = exact.length ? exact : rows.filter((r) => r.term.toLowerCase().includes(s.toLowerCase()));
    if (hits.length === 1) return hits[0];
    const list = (hits.length ? hits : rows).map((r) => `${r.term} (${r.kind}, ATECO ${r.ateco})`).join('; ');
    throw new ArgumentError(`--activity "${s}" matches ${hits.length ? `${hits.length} entries` : 'no activity or description'} of the suggester${list ? `: ${list}` : ''}; see \`opencli registroimprese suggest\``);
}

// Runs in the page: fill the form as the autocomplete would, get a captcha
// token, submit. `activity` is the picked entry, or null for a name search.
function submitSearch(ns, siteKey, name, province, all, activity) {
    const form = document.getElementById(`${ns}searchForm`);
    if (!form || !window.grecaptcha?.enterprise) return 'no-form';
    form.querySelector('#inputSearchField').value = name;
    form.querySelector(`#${ns}filtroPdlSuggest`).value = activity ? activity.ateco : '';
    form.querySelector(`#${ns}filtroTipoSugg`).value = activity ? activity.site : '';
    form.querySelector(`#${ns}filtroProvincia`).value = province;
    form.querySelector('#filtroScoreText').value = all ? 'N' : 'S';
    form.querySelector('#soloNonCancellateText').value = 'S';
    form.querySelector(`#${ns}formDate`).value = String(Date.now());
    window.__opencliSubmitted = true; // gone once the next page loads
    return grecaptcha.enterprise.execute(siteKey, { action: 'submit' }).then((token) => {
        form.querySelector(`#${ns}captchaResp`).value = token;
        form.submit();
        return 'submitted';
    });
}

// Runs in the page: where are we after the submit?
function resultsState(portletId) {
    // The marker goes with the old document; the new one is read only once
    // fully loaded, or a half-parsed table passes for the whole result.
    if (window.__opencliSubmitted || document.readyState !== 'complete') return 'pending';
    if (document.querySelector('table.tableRisultatiGratuita')) return 'rows';
    const portlet = document.getElementById(portletId);
    if (!portlet || !portlet.querySelector('.portlet-body')) return 'pending';
    // No match: "Non abbiamo trovato alcuna impresa corrispondente a ...".
    // Captcha rejected: the block holds nothing but its own title.
    if (/Non abbiamo trovato/.test(portlet.innerText) || portlet.querySelector('.spanHaiCercato')) return 'none';
    return 'empty';
}

// Runs in the page: the rows of the results table.
function readRows() {
    const clean = (s) => (s ?? '').replace(/\s+/g, ' ').trim();
    const body = clean(document.body.innerText);
    const related = body.match(/Vedi tutti i risultati correlati[^(]*\(\s*(\d+)\s*\)/);
    const shown = body.match(/Visualizzati da \d+ a \d+ di (\d+) risultati/);
    const rows = [...document.querySelectorAll('table.tableRisultatiGratuita td.gratuitaTd')].map((td) => {
        const a = td.querySelector('a.linkRisultatiRicercaTabella[href*="visualizzaDettaglio"]');
        const href = a ? a.getAttribute('href') : '';
        const id = decodeURIComponent((href.match(/Portlet_INSTANCE_\w+_id=([^&]+)/) || [])[1] || '');
        // The desktop cells, in the page's own order: kind of office, city, legal form.
        const cells = [...td.querySelectorAll('.span1.hidden-phone span.hidden-phone')].map((e) => clean(e.textContent)).filter(Boolean);
        return {
            name: clean(td.querySelector('.spanDenominazioneLista')?.textContent),
            kind: cells[0] ?? null,
            city: cells[1] ?? null,
            legal_form: cells[2] ?? null,
            // The cell ends with the page's own "...Leggi tutto" toggle.
            activity: clean(td.querySelector('.dimLimit')?.textContent).replace(/\s*\.{3}\s*Leggi tutto$/, '') || null,
            status: clean(td.querySelector('.descr-stato-mobile strong')?.textContent) || null,
            id: id || null,
            url: href,
        };
    });
    const delta = document.querySelector('.pagination-custom-select select.options');
    return {
        rows,
        total: shown ? Number(shown[1]) : rows.length,
        related: related ? Number(related[1]) : null,
        deltaHref: delta ? (delta.getAttribute('onchange').match(/'([^']+)'/) || [])[1] : null,
    };
}

// Runs in the page: load the same results with another page size (a captcha
// token is needed here too, the page's own changeItemsForPage does the same).
function changePageSize(siteKey, href, delta) {
    window.__opencliSubmitted = true;
    return grecaptcha.enterprise.execute(siteKey, { action: 'submit' }).then((token) => {
        location.href = `${href}&delta=${delta}&captcha=${token}`;
        return 'submitted';
    });
}

// Runs in the page: the free detail of one company.
function readDetail() {
    const clean = (s) => (s ?? '').replace(/\s+/g, ' ').trim();
    const hidden = (n) => { const v = document.getElementById(`0_${n}`)?.value ?? ''; return v === 'null' ? '' : clean(v); };
    const byLabel = {};
    for (const dt of document.querySelectorAll('dt')) {
        const dd = dt.nextElementSibling;
        if (dd && dd.tagName === 'DD') byLabel[clean(dt.textContent)] = clean(dd.textContent);
    }
    if (!('Indirizzo Impresa' in byLabel)) return null;
    const ateco = byLabel['Classificazione ATECO'] ?? '';
    const m = ateco.match(/^([\d.]+)\s*-\s*(.*)$/);
    const street = [hidden('via'), hidden('numeroCivico')].filter(Boolean).join(' ');
    const address = [street, hidden('frazione'), hidden('cap')].filter(Boolean).join(', ');
    return {
        legal_form: byLabel['Forma giuridica (generico)'] || null,
        activity: byLabel['Descrizione Attività'] || null,
        status: clean(document.querySelector('.text-success-ri strong')?.textContent) || null,
        address: address || (byLabel['Indirizzo Impresa'] || '').split('Mostra mappa')[0].trim() || null,
        province: hidden('provincia') || null,
        phone: hidden('telefono') || null,
        pec: clean(document.querySelector('input.ddPec')?.value) || null,
        ateco: m ? m[1] : (ateco || null),
        ateco_label: m ? m[2] : null,
    };
}

async function pollState(page) {
    for (let i = 0; i < 20; i++) {
        await page.sleep(1);
        let state = 'pending';
        try { state = await page.evaluate(resultsState, RESULTS_PORTLET); } catch { /* navigating */ }
        if (state !== 'pending') return state;
    }
    return 'pending';
}

cli({
    site: SITE,
    name: 'search',
    access: 'read',
    description: 'Search companies by name, or by activity with --activity, in one province or all of Italy: the free search of the Registro Imprese, driven in your Chrome (reCAPTCHA); --detail adds address, PEC and ATECO',
    example: 'opencli registroimprese search infocamere --province RM --detail',
    domain: DOMAIN,
    strategy: Strategy.UI,
    browser: true,
    args: [
        { name: 'name', type: 'string', positional: true, required: false, help: 'Company name, or a piece of it; leave it out with --activity' },
        { name: 'activity', type: 'string', default: '', help: 'Search by activity instead of name: an activity or description of the suggester, by its text or a piece that picks one (`suggest` lists them with their ATECO code)' },
        { name: 'province', type: 'string', default: '', help: 'Two-letter province code (e.g. BA), or a piece of its name that picks one; empty for all of Italy' },
        { name: 'all', type: 'bool', default: false, help: 'Every related result ("Vedi tutti i risultati correlati"), not only the first ones the site picks' },
        { name: 'detail', type: 'bool', default: false, help: 'Open the detail of each row: address, province, phone, PEC, ATECO (one page per row)' },
        { name: 'limit', type: 'int', default: 20, help: `Rows to return, at most 75 (the site's page sizes: ${PAGE_SIZES.join(', ')})` },
    ],
    defaultFormat: 'json',
    columns: COLUMNS,
    footerExtra: (kwargs) => {
        const parts = [];
        if (kwargs._total != null) parts.push(`${kwargs._total} results by the site's count`);
        if (kwargs._related != null) parts.push(`${kwargs._related} related results in all (--all)`);
        if (kwargs._submits > 1) parts.push(`${kwargs._submits} submits`);
        return parts.length ? parts.join('; ') : undefined;
    },
    func: async (page, args) => {
        let name = String(args.name ?? '').trim();
        let activity = null;
        if (args.activity) {
            if (name) throw new ArgumentError('give a name or --activity, not both');
            const entry = await activityEntry(args.activity);
            // The site's own values for the picked entry: the term in the box,
            // the code and the list it came from in the hidden fields.
            activity = { ateco: entry.ateco, site: entry.kind === 'activity' ? 'attivita' : 'declaratorie' };
            name = entry.term;
        }
        if (!name) throw new ArgumentError('give a company name, or --activity');
        const province = args.province ? provinceCode(args.province) : '';
        const limit = Number(args.limit ?? 20);
        if (!Number.isInteger(limit) || limit < 1 || limit > 75) throw new ArgumentError('--limit must be an integer from 1 to 75');

        await page.goto(SEARCH_URL);
        let state = 'empty';
        let submits = 0;
        while (state === 'empty' && submits < SUBMITS) {
            submits++;
            const sent = await page.evaluate(submitSearch, NS, SITE_KEY, name, province, Boolean(args.all), activity);
            if (sent !== 'submitted') throw new CommandExecutionError('registroimprese: the search form or the captcha is not on the page', 'Open the URL with "opencli browser <session> open" and look at what the site shows.');
            state = await pollState(page);
        }
        args._submits = submits;
        if (state === 'empty') throw new CommandExecutionError(`registroimprese: the portal answered an empty results block ${submits} times`, 'The reCAPTCHA score of this browser may be too low. Retry later, or from a Chrome profile that has browsed the site.');
        if (state === 'pending') throw new CommandExecutionError('registroimprese: the results page did not load', 'Retry; if it persists open the search by hand with "opencli browser <session> open".');
        if (state === 'none') throw new EmptyResultError(`registroimprese search ${name}`, `no company matches this ${activity ? 'activity' : 'name'}${province ? ` in ${PROVINCES[province]}` : ''}`);

        let found = await page.evaluate(readRows);
        if (limit > 20 && found.total > 20 && found.deltaHref) {
            const size = PAGE_SIZES.find((n) => n >= limit) ?? 75;
            await page.evaluate(changePageSize, SITE_KEY, found.deltaHref, size);
            const again = await pollState(page);
            if (again !== 'rows') throw new CommandExecutionError('registroimprese: the page with more rows did not load');
            found = await page.evaluate(readRows);
        }
        args._total = found.total;
        args._related = found.related;
        const rows = found.rows.slice(0, limit);

        const out = [];
        for (const row of rows) {
            let detail = null;
            if (args.detail && row.url) {
                await page.goto(row.url);
                detail = await page.evaluate(readDetail);
                if (!detail) throw new CommandExecutionError(`registroimprese: the detail of "${row.name}" did not load`);
            }
            out.push({
                name: row.name,
                kind: row.kind,
                city: row.city,
                legal_form: detail?.legal_form ?? row.legal_form,
                activity: detail?.activity ?? row.activity,
                status: detail?.status ?? row.status,
                address: detail?.address ?? null,
                province: detail?.province ?? null,
                phone: detail?.phone ?? null,
                pec: detail?.pec ?? null,
                ateco: detail?.ateco ?? null,
                ateco_label: detail?.ateco_label ?? null,
                id: row.id,
            });
        }
        return out;
    },
});
