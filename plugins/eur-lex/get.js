// Full text of an EU act, by CELEX number, straight from Cellar.
import { cli, Strategy } from '@jackwener/opencli/registry';
import { ArgumentError, EmptyResultError } from '@jackwener/opencli/errors';
import { checkCelex, cellarFetch, xhtmlToText, eurlexUrl } from './shared.js';

// Verified accept types. Bare application/xml, text/html and text/plain all 404;
// application/zip answers 400. Do not widen this table by guessing.
const FORMATS = {
    text: 'application/xhtml+xml',
    xhtml: 'application/xhtml+xml',
    notice: 'application/xml;notice=object',
    branch: 'application/xml;notice=branch',
};

cli({
    site: 'eur-lex',
    name: 'get',
    access: 'read',
    description: 'Full text of an EU act by CELEX number',
    example: 'opencli eur-lex get 32024R1689 --chars 4000',
    domain: 'eur-lex.europa.eu',
    strategy: Strategy.PUBLIC,
    browser: false,
    args: [
        { name: 'celex', type: 'string', positional: true, required: true, help: 'CELEX number, e.g. 32024R1689' },
        { name: 'as', type: 'string', default: 'text', help: `Which representation to fetch: ${Object.keys(FORMATS).join(', ')}` },
        { name: 'lang', type: 'string', default: 'eng', help: 'Language of the expression, ISO 639-3 (eng, ita, fra…)' },
        { name: 'chars', type: 'int', default: 0, help: 'Truncate to this many characters; 0 keeps everything' },
    ],
    columns: ['celex', 'representation', 'lang', 'chars', 'truncated', 'url', 'text'],
    func: async (args) => {
        const celex = checkCelex(args.celex);
        const format = String(args.as ?? 'text').toLowerCase();
        const accept = FORMATS[format];
        if (!accept) throw new ArgumentError(`invalid --as "${format}": expected one of ${Object.keys(FORMATS).join(', ')}`);
        const lang = String(args.lang ?? 'eng').toLowerCase();
        const limit = Number(args.chars ?? 0);
        if (!Number.isInteger(limit) || limit < 0) throw new ArgumentError('chars must be an integer >= 0');

        const raw = await cellarFetch(celex, accept, lang);
        const body = format === 'text' ? xhtmlToText(raw) : raw;
        if (!body) throw new EmptyResultError(`eur-lex get ${celex}`, 'Cellar returned an empty body');
        const truncated = limit > 0 && body.length > limit;
        return [{
            celex,
            representation: format,
            lang,
            chars: body.length,
            truncated,
            url: eurlexUrl(celex),
            text: truncated ? body.slice(0, limit) : body,
        }];
    },
});
