// The autocomplete of the search box: company names, activities and
// "declaratorie" (activity descriptions) that start like the text. No browser,
// no captcha: the suggester is a plain JSON endpoint. Activities and
// descriptions carry the ATECO code the site searches by when one is picked.
import { cli, Strategy } from '@jackwener/opencli/registry';
import { ArgumentError, EmptyResultError } from '@jackwener/opencli/errors';
import { SITE, DOMAIN, KINDS, suggestions } from './shared.js';

cli({
    site: SITE,
    name: 'suggest',
    access: 'read',
    description: 'Suggestions of the search box for a piece of a company name or activity, with the ATECO code of activities and descriptions (the site offers up to 10; no browser)',
    example: 'opencli registroimprese suggest infocam',
    domain: DOMAIN,
    strategy: Strategy.PUBLIC,
    browser: false,
    args: [
        { name: 'text', type: 'string', positional: true, required: true, help: 'Start of a company name or of an activity, 2 characters at least' },
        { name: 'kind', type: 'string', default: '', help: `Keep one kind only: ${Object.values(KINDS).join(', ')}` },
    ],
    defaultFormat: 'json',
    columns: ['kind', 'term', 'ateco'],
    func: async (args) => {
        const text = String(args.text ?? '').trim();
        if (text.length < 2) throw new ArgumentError('give at least 2 characters');
        const kind = String(args.kind ?? '').trim();
        if (kind && !Object.values(KINDS).includes(kind)) throw new ArgumentError(`--kind must be one of ${Object.values(KINDS).join(', ')}`);

        const rows = (await suggestions(text)).filter((r) => !kind || r.kind === kind);
        if (!rows.length) throw new EmptyResultError(`registroimprese suggest ${text}`, 'the suggester has nothing for this text');
        return rows;
    },
});
