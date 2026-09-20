// One icon of koboyo.com/icons, by slug.
import { cli, Strategy } from '@jackwener/opencli/registry';
import { EmptyResultError } from '@jackwener/opencli/errors';
import { checkSlug, slugMeta, fetchSvg, iconUrl, svgUrl } from './shared.js';

cli({
    site: 'koboyo',
    name: 'get',
    access: 'read',
    description: 'Name, taxonomy, keywords and URLs of one koboyo icon; --svg prints the SVG markup instead',
    example: 'opencli koboyo get acoustic-guitar',
    domain: 'koboyo.com',
    strategy: Strategy.PUBLIC,
    browser: false,
    args: [
        { name: 'slug', type: 'string', positional: true, required: true, help: 'The icon slug, as the search returns it, e.g. acoustic-guitar' },
        { name: 'svg', type: 'boolean', default: false, help: 'Print the SVG markup in the row instead of only its URL' },
    ],
    // One icon, a description of a couple of lines and a long keyword list: the
    // default table would be one very wide row. `plain` prints it as a block.
    defaultFormat: 'plain',
    columns: ['slug', 'name', 'group', 'style', 'keywords', 'description', 'url', 'svg', 'markup'],
    func: async (args) => {
        const slug = checkSlug(args.slug);
        const meta = await slugMeta(slug);
        if (!meta) {
            throw new EmptyResultError(`koboyo get ${slug}`, 'no icon with this slug. Find one with `opencli koboyo search`');
        }
        const markup = args.svg ? await fetchSvg(slug) : null;
        return [{
            slug,
            name: meta.name ?? null,
            group: meta.group && meta.subgroup ? `${meta.group}/${meta.subgroup}` : null,
            // Empty means `original`, which is the site's own default rather
            // than a missing value.
            style: meta.style || 'original',
            keywords: Array.isArray(meta.keywords) ? meta.keywords.join(', ') : null,
            description: meta.description ?? null,
            url: iconUrl(slug),
            svg: svgUrl(slug),
            markup,
        }];
    },
});
