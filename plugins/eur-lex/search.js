// Full-text search on EUR-Lex, through the real browser.
//
// eur-lex.europa.eu is behind an AWS WAF: a plain HTTP client gets HTTP 202
// with a JavaScript challenge and an empty body. There is no machine-readable
// full-text search endpoint, so this command drives the site's own search page
// in your Chrome, exactly as a person would. No evasion: it uses the front door.
//
// Because the page can fail in ways that look like "no results", this command
// distinguishes them: a genuine zero-result search reports EMPTY_RESULT, while
// a page that is not a results page at all (challenge, outage, redirect) fails
// loudly instead of quietly returning nothing.
import { cli, Strategy } from '@jackwener/opencli/registry';
import { ArgumentError, CommandExecutionError, EmptyResultError } from '@jackwener/opencli/errors';

const BASE = 'https://eur-lex.europa.eu/search.html';

cli({
    site: 'eur-lex',
    name: 'search',
    access: 'read',
    description: 'Full-text search across EU law (drives the EUR-Lex search page in a real browser)',
    example: 'opencli eur-lex search "facial recognition"',
    domain: 'eur-lex.europa.eu',
    strategy: Strategy.UI,
    browser: true,
    args: [
        { name: 'query', type: 'string', positional: true, required: true, help: 'Search text. Several words match any of them unless you pass --exact. Append * for variations, ? for one character' },
        { name: 'exact', type: 'bool', default: false, help: 'Treat the query as an exact phrase instead of separate words' },
        { name: 'page', type: 'int', default: 1, help: 'Results page, one-based (ten results per page)' },
        { name: 'lang', type: 'string', default: 'en', help: 'Interface language; the row labels follow it' },
    ],
    // Scannable identifiers first, the long title last: in a table the last
    // column is the one that can overflow without pushing everything else off.
    // The result total is not a property of a row, so it goes in the footer.
    columns: ['celex', 'date', 'form', 'act', 'title', 'url'],
    footerExtra: (kwargs) => (kwargs._total != null ? `${kwargs._total} results in total` : undefined),
    func: async (page, args) => {
        const query = String(args.query ?? '').trim();
        if (!query) throw new ArgumentError('the query is empty');
        const pageNum = Number(args.page ?? 1);
        if (!Number.isInteger(pageNum) || pageNum < 1) throw new ArgumentError('page must be an integer >= 1');
        const lang = String(args.lang ?? 'en');
        // Several words are OR-ed by the site; quoting makes it a phrase.
        // Doing it here spares the caller a round of nested shell quoting.
        const text = args.exact && !/^".*"$/.test(query) ? `"${query}"` : query;

        const url = `${BASE}?scope=EURLEX&text=${encodeURIComponent(text)}&lang=${encodeURIComponent(lang)}&type=quick`
            + (pageNum > 1 ? `&page=${pageNum}` : '');
        await page.goto(url);

        const found = await page.evaluate(`(() => {
      const rows = [...document.querySelectorAll('.SearchResult')];
      const totalMatch = document.body.innerText.match(/Results\\s+\\d+\\s*-\\s*\\d+\\s+of\\s+([\\d\\s.,]+)/);
      // Read the dt/dd metadata by label: the labels are localised and their
      // order is not guaranteed, so never take them by position.
      const byLabel = (row) => {
        const out = {};
        const nodes = [...row.querySelectorAll('dt, dd')];
        for (let i = 0; i < nodes.length - 1; i++) {
          if (nodes[i].tagName === 'DT' && nodes[i + 1].tagName === 'DD') {
            out[nodes[i].textContent.trim().replace(/:$/, '')] = nodes[i + 1].textContent.trim();
          }
        }
        return out;
      };
      return {
        isResultsPage: /Search results/i.test(document.title),
        total: totalMatch ? totalMatch[1].replace(/[\\s.,]/g, '') : null,
        rows: rows.map((row) => {
          const a = row.querySelector('h2 a.title');
          const href = a ? a.getAttribute('href') || '' : '';
          const celex = (href.match(/CELEX:([^&]+)/) || [])[1] || null;
          const meta = byLabel(row);
          return {
            celex,
            title: a ? a.textContent.trim().replace(/\\s+/g, ' ') : null,
            form: meta['Form'] ?? null,
            // "14/05/2024; Date of signature" -> "14/05/2024"
            date: (meta['Date of document'] ?? '').split(';')[0].trim() || null,
          };
        }),
      };
    })()`);

        if (!found || !found.isResultsPage) {
            // Not a zero-result search: the page is not the results page at all.
            // Typically the WAF challenge, an outage, or a redirect.
            throw new CommandExecutionError(
                'EUR-Lex did not return its results page',
                'The browser may not have completed the site\'s challenge. Retry, or open the URL manually with "opencli browser <session> open".',
            );
        }
        if (found.rows.length === 0) {
            throw new EmptyResultError(`eur-lex search ${query}`, 'no act matches this query on this page');
        }
        args._total = found.total ? Number(found.total) : null;
        return found.rows.map((r) => ({
            celex: r.celex,
            date: r.date,
            form: r.form,
            // Short designation cut out of the title, e.g. "Regulation (EU) 2024/1358".
            // Derived, not a field the site publishes.
            act: r.title ? r.title.split(/\s+of\s+/)[0].trim() : null,
            title: r.title,
            url: r.celex ? `https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:${r.celex}` : null,
        }));
    },
});
