import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { getRegistry } from '@jackwener/opencli/registry';
import { apiGet, searchBookmarks, bookmarkRow, BOOKMARK_COLUMNS } from '../shared.js';
import '../search.js';
import '../get.js';
import '../collections.js';
import '../tags.js';

const originalFetch = globalThis.fetch;
const originalToken = process.env.RAINDROP_TOKEN;
afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalToken === undefined) delete process.env.RAINDROP_TOKEN;
    else process.env.RAINDROP_TOKEN = originalToken;
});
const item = (id, overrides = {}) => ({
    _id: id, title: 'Example', link: 'https://x.com/example/status/1',
    excerpt: '', note: '', tags: ['cli'], collection: { $id: 1 },
    created: '2026-04-03T12:00:00.000Z', lastUpdate: '2026-04-04T00:00:00.000Z',
    type: 'link', important: false, ...overrides,
});
function mock(handler) {
    process.env.RAINDROP_TOKEN = 'synthetic-secret';
    const calls = [];
    globalThis.fetch = async (url, options) => {
        calls.push({ url: new URL(url), options });
        return handler(new URL(url), options);
    };
    return calls;
}
const ok = (body) => new Response(JSON.stringify(body), { status: 200 });
const command = (name) => getRegistry().get('raindrop/' + name);
const execute = (name, args = {}) => command(name).func(args);

test('missing token fails without a request', async () => {
    delete process.env.RAINDROP_TOKEN;
    globalThis.fetch = () => assert.fail('must not fetch');
    await assert.rejects(apiGet('/user'), { code: 'AUTH_REQUIRED' });
});
test('GET uses only the fixed API origin, bearer token, timeout and no redirects', async () => {
    const calls = mock(() => ok({ result: true, items: [] }));
    await apiGet('/raindrops/0', { search: 'a & b #cli' });
    assert.equal(calls[0].url.origin, 'https://api.raindrop.io');
    assert.equal(calls[0].url.searchParams.get('search'), 'a & b #cli');
    assert.equal(calls[0].options.method, 'GET');
    assert.equal(calls[0].options.headers.Authorization, 'Bearer synthetic-secret');
    assert.equal(calls[0].options.redirect, 'error');
    assert.ok(calls[0].options.signal);
    await assert.rejects(apiGet('https://elsewhere.example'), { code: 'ARGUMENT' });
});
test('HTTP errors, invalid JSON and result:false are explicit and never echo bodies', async () => {
    for (const status of [401, 403, 404, 429, 500]) {
        mock(() => new Response('synthetic-secret', { status }));
        await assert.rejects(apiGet('/user'), (error) => {
            assert.ok(!error.message.includes('synthetic-secret'));
            assert.equal(error.code, status === 401 || status === 403 ? 'AUTH_REQUIRED' : 'COMMAND_EXEC');
            return true;
        });
    }
    mock(() => new Response('not JSON'));
    await assert.rejects(apiGet('/user'), /JSON/);
    mock(() => ok({ result: false, errorMessage: 'synthetic-secret' }));
    await assert.rejects(apiGet('/user'), (e) => !e.message.includes('synthetic-secret'));
    mock(() => { throw new Error('synthetic-secret'); });
    await assert.rejects(apiGet('/user'), (e) => !e.message.includes('synthetic-secret'));
});
test('filter before limit; continue past full pages with zero local matches', async () => {
    const calls = mock((url) => ok({ result: true, items: url.searchParams.get('page') === '0'
        ? Array.from({ length: 50 }, (_, n) => item(n + 1, { link: 'https://example.com' }))
        : [item(51), item(52)] }));
    const rows = await searchBookmarks({ domain: 'x.com,twitter.com', limit: 1 });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].id, 51);
    assert.equal(calls.length, 2);
});
test('inclusive UTC dates, exact hostname/subdomain matching, no URL substring matches', async () => {
    mock(() => ok({ result: true, items: [
        item(1, { created: '2026-04-03T00:00:00.000Z' }),
        item(2, { created: '2026-04-03T23:59:59.999Z', link: 'https://mobile.twitter.com/a' }),
        item(3, { link: 'https://notx.com/a' }),
        item(4, { link: 'https://example.com/x.com' }),
        item(5, { link: 'https://x.com.evil.example/a' }),
        item(6, { created: '2026-04-04T00:00:00.000Z' }),
    ] }));
    const rows = await searchBookmarks({ from: '2026-04-03', to: '2026-04-03', domain: 'x.com,twitter.com', limit: 0 });
    assert.deepEqual(rows.map(r => r.id), [1, 2]);
});
test('query is preserved and collection/nested/sort reach the API', async () => {
    const calls = mock(() => ok({ result: true, items: [item(1)] }));
    await searchBookmarks({ query: '#cli "for agents"', collection: 42, nested: true, sort: 'score' });
    assert.equal(calls[0].url.pathname, '/rest/v1/raindrops/42');
    assert.equal(calls[0].url.searchParams.get('search'), '#cli "for agents"');
    assert.equal(calls[0].url.searchParams.get('nested'), 'true');
    assert.equal(calls[0].url.searchParams.get('sort'), 'score');
});
test('invalid arguments fail before a network request', async () => {
    globalThis.fetch = () => assert.fail('must not fetch');
    for (const args of [
        { from: '2026-02-30' }, { to: 'yesterday' }, { from: '2026-04-04', to: '2026-04-03' },
        { domain: 'https://x.com' }, { domain: 'x.com,' }, { limit: -1 }, { limit: 1.5 },
        { collection: -2 }, { collection: 'bad' }, { sort: 'random' }, { sort: 'score' },
        { nested: 'maybe' },
    ]) await assert.rejects(searchBookmarks(args), { code: 'ARGUMENT' });
    await assert.rejects(execute('get', { id: 'bad' }), { code: 'ARGUMENT' });
    await assert.rejects(execute('tags', { collection: -2 }), { code: 'ARGUMENT' });
});
test('empty and malformed payloads are not successful empty fallbacks', async () => {
    mock(() => ok({ result: true, items: [] }));
    await assert.rejects(execute('search'), { code: 'EMPTY_RESULT' });
    for (const items of [null, {}, [null], [{ _id: 1 }]]) {
        mock(() => ok({ result: true, items }));
        await assert.rejects(execute('search'), { code: 'COMMAND_EXEC' });
    }
});
test('duplicates across pages are not emitted twice', async () => {
    mock(url => ok({ result: true, items: url.searchParams.get('page') === '0'
        ? Array.from({ length: 50 }, (_, i) => item(i + 1))
        : [item(50), item(51)] }));
    const rows = await searchBookmarks({ limit: 0 });
    assert.equal(rows.length, 51);
});
test('newest-first date boundary stops paging, but other sorts do not', async () => {
    const page = Array.from({ length: 50 }, (_, i) => item(i + 1, { created: '2025-12-31T00:00:00.000Z' }));
    let calls = mock(() => ok({ result: true, items: page }));
    assert.deepEqual(await searchBookmarks({ from: '2026-01-01', limit: 0 }), []);
    assert.equal(calls.length, 1);
    calls = mock(url => ok({ result: true, items: url.searchParams.get('page') === '0' ? page : [item(51)] }));
    const rows = await searchBookmarks({ from: '2026-01-01', sort: 'title', limit: 0 });
    assert.equal(calls.length, 2);
    assert.deepEqual(rows.map(row => row.id), [51]);
});
test('a repeated full page fails instead of looping or returning partial success', async () => {
    mock(() => ok({ result: true, items: Array.from({ length: 50 }, (_, i) => item(i + 1)) }));
    await assert.rejects(searchBookmarks({ limit: 0 }), /pagination made no progress/);
});
test('get and collection discovery reject missing records and genuine empty results', async () => {
    mock(() => ok({ result: true }));
    await assert.rejects(execute('get', { id: 1 }), { code: 'COMMAND_EXEC' });
    mock(() => ok({ result: true, items: [] }));
    await assert.rejects(execute('collections'), { code: 'EMPTY_RESULT' });
    mock(() => ok({ result: true, items: [{}] }));
    await assert.rejects(execute('collections'), { code: 'COMMAND_EXEC' });
});
test('all four commands declare read-only Node execution and matching columns', async () => {
    for (const name of ['search', 'get', 'collections', 'tags']) {
        const cmd = command(name);
        assert.ok(cmd);
        assert.equal(cmd.access, 'read');
        assert.equal(cmd.browser, false);
        assert.ok(cmd.columns.every(c => !/[A-Z]/.test(c)));
    }
    assert.deepEqual(Object.keys(bookmarkRow(item(1))), BOOKMARK_COLUMNS);
    mock(() => ok({ result: true, item: item(1) }));
    const rows = await execute('get', { id: 1 });
    assert.equal(rows.length, 1);
    assert.deepEqual(Object.keys(rows[0]), command('get').columns);
    assert.equal(rows[0].note, '');
});
test('collections combine root and child records with parent ids', async () => {
    mock(url => ok({ result: true, items: url.pathname.endsWith('/childrens')
        ? [{ _id: 1, title: 'Root', count: 5 }, { _id: 2, title: 'Child', parent: { $id: 1 }, count: 3 }]
        : [{ _id: 1, title: 'Root', count: 5 }] }));
    const rows = await execute('collections');
    assert.equal(rows.length, 2);
    assert.equal(rows[0].parent_id, null);
    assert.equal(rows[1].parent_id, 1);
    assert.deepEqual(Object.keys(rows[0]), command('collections').columns);
});
test('tags are filterable and validate the upstream shape', async () => {
    const calls = mock(() => ok({ result: true, items: [{ _id: 'CLI', count: 2 }, { _id: 'other', count: 1 }] }));
    const rows = await execute('tags', { collection: 42, grep: 'cli' });
    assert.deepEqual(rows, [{ tag: 'CLI', count: 2 }]);
    assert.equal(calls[0].url.pathname, '/rest/v1/tags/42');
    assert.deepEqual(Object.keys(rows[0]), command('tags').columns);
    await assert.rejects(execute('tags', { grep: 'missing' }), { code: 'EMPTY_RESULT' });
    mock(() => ok({ result: true, items: [{}] }));
    await assert.rejects(execute('tags'), { code: 'COMMAND_EXEC' });
});
