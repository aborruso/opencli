import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getRegistry } from '@jackwener/opencli/registry';
import { MAX_PAGES, annoFilter, fetchPiao, latestOnly, piaoRow, targetPath } from '../shared.js';
import '../search.js';
import '../recent.js';
import '../enti.js';
import '../ente.js';
import '../docs.js';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

const rec = (ipa, years, version = 1, extra = {}) => ({
    administrationIpaCode: ipa,
    administrationName: `Ente ${ipa}`,
    version,
    years: `Anno ${years}`,
    content: {
        approvalDate: { value: '2026-01-31' },
        estremiAtto: { value: '74' },
        autorita: { value: ' GIUNTA ' },
        nDipendenti: { value: { label: 'Sì', value: 'Sì' } },
        piaoPDF: { files: [{ url: 'https://x.test/p.pdf', fileName: 'p.pdf', mimeType: 'application/pdf' }] },
        atto: { files: [] },
        attachments: { files: [{ url: 'https://x.test/a.pdf', fileName: '../../a.pdf', mimeType: 'application/pdf' }] },
        linkPiaoPA: { value: 'https://pa.test' },
        ...extra,
    },
});
const json = (body) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
function serve(all, pageSize = 6) {
    const calls = [];
    globalThis.fetch = async (url) => {
        const u = new URL(url);
        calls.push(u);
        const page = Number(u.searchParams.get('page'));
        const list = all.slice(page * pageSize, (page + 1) * pageSize);
        return json({ success: true, result: [all.length ? { list, count: list.length, total: all.length } : { list: [], count: 0 }] });
    };
    return calls;
}
const run = (name, args) => getRegistry().get(`piao/${name}`).func(args);

test('pages until the total, without an extra call', async () => {
    const calls = serve(Array.from({ length: 13 }, (_, i) => rec(`c${i}`, '2026-2028')));
    const { records, total } = await fetchPiao({ name: 'comune di x' });
    assert.equal(records.length, 13);
    assert.equal(total, 13);
    assert.equal(calls.length, 3);
    assert.equal(calls[0].searchParams.get('administrationName'), 'comune di x');
});

test('an empty result has no total and is not an error of fetchPiao', async () => {
    serve([]);
    assert.deepEqual(await fetchPiao({ ipa: 'zzz' }), { records: [], total: 0 });
});

test('limit stops the paging', async () => {
    const calls = serve(Array.from({ length: 60 }, (_, i) => rec(`c${i}`, '2026-2028')));
    assert.equal((await fetchPiao({ limit: 7 })).records.length, 7);
    assert.equal(calls.length, 2);
});

test('the page cap fails instead of returning a partial list', async () => {
    const calls = serve(Array.from({ length: 6 * (MAX_PAGES + 5) }, (_, i) => rec(`c${i}`, '2022-2024')));
    await assert.rejects(fetchPiao({ keep: () => false }), /read 1200 of 1230 records/);
    assert.equal(calls.length, MAX_PAGES);
});

test('success=false and a changed shape are errors', async () => {
    globalThis.fetch = async () => json({ success: false });
    await assert.rejects(fetchPiao({}), /success=false/);
    globalThis.fetch = async () => json({ success: true, result: [{}] });
    await assert.rejects(fetchPiao({}), /shape changed/);
});

test('--anno: a year covers trienni, a range is exact, anything else is refused', () => {
    assert.equal(annoFilter('2027')(rec('a', '2026-2028')), true);
    assert.equal(annoFilter('2029')(rec('a', '2026-2028')), false);
    assert.equal(annoFilter('2026-2028')(rec('a', '2026-2028')), true);
    assert.equal(annoFilter('2026-2028')(rec('a', '2025-2027')), false);
    assert.equal(annoFilter('')(rec('a', '2025-2027')), true);
    assert.throws(() => annoFilter('26'), /invalid --anno/);
});

test('latestOnly keeps the highest version per triennium, whatever the order', () => {
    const rows = latestOnly([rec('a', '2025-2027', 1), rec('a', '2025-2027', 2), rec('a', '2024-2026', 1), rec('b', '2025-2027', 1)]);
    assert.deepEqual(rows.map((r) => [r.administrationIpaCode, r.years, r.version]), [['a', 'Anno 2025-2027', 2], ['a', 'Anno 2024-2026', 1], ['b', 'Anno 2025-2027', 1]]);
});

test('piaoRow flattens a record and tolerates missing fields', () => {
    const row = piaoRow(rec('a', '2026-2028', 2));
    assert.equal(row.triennium, '2026-2028');
    assert.equal(row.authority, 'GIUNTA');
    assert.equal(row.n_dipendenti, 'Sì');
    assert.equal(row.piao_url, 'https://x.test/p.pdf');
    assert.equal(row.act_url, null);
    assert.equal(row.attachments, 1);
    assert.equal(piaoRow({ administrationIpaCode: 'a', years: 'Anno 2026-2028' }).piao_url, null);
});

test('ente keeps only the exact code from the substring match', async () => {
    serve([rec('cciaa_mo', '2026-2028'), rec('cciaa', '2026-2028'), rec('cciaa', '2025-2027')]);
    const rows = await run('ente', { ipa: 'cciaa' });
    assert.deepEqual(rows.map((r) => r.ipa_code), ['cciaa', 'cciaa']);
});

test('ente with no record is an empty result pointing at enti', async () => {
    serve([]);
    await assert.rejects(run('ente', { ipa: 'zzz' }), (e) => e.code === 'EMPTY_RESULT' && /opencli piao enti/.test(e.hint));
});

test('search needs a filter and applies --anno after the server filter', async () => {
    await assert.rejects(run('search', {}), /--ipa/);
    serve([rec('a', '2026-2028'), rec('b', '2022-2024')]);
    const args = { name: 'x', anno: '2026', limit: 20 };
    const rows = await run('search', args);
    assert.deepEqual(rows.map((r) => r.ipa_code), ['a']);
    assert.equal(args._total, 2);
});

test('enti takes a name or a code, not both, and flags a full page', async () => {
    await assert.rejects(run('enti', { name: 'a', ipa: 'b', limit: 2 }), /either/);
    globalThis.fetch = async (url) => {
        assert.equal(new URL(url).searchParams.get('limit'), '2');
        return json({ success: true, result: [{ administrationIpaCode: 'a', administrationName: 'A ' }, { administrationIpaCode: 'b', administrationName: 'B' }] });
    };
    const args = { name: 'x', limit: 2 };
    assert.deepEqual((await run('enti', args))[0], { ipa_code: 'a', administration: 'A' });
    assert.equal(args._full, true);
});

test('target paths stay inside the folder', () => {
    const file = targetPath('/out', { ipa_code: '../evil', triennium: '2026-2028', version: 1, kind: 'attachment', index: 2, file_name: '../../a:b.pdf' });
    assert.equal(file, '/out/evil/2026-2028_v1/attachment-2_a_b.pdf');
});

test('docs lists without touching the disk, one row per file', async () => {
    serve([rec('a', '2026-2028')]);
    const rows = await run('docs', { ipa: 'a' });
    assert.deepEqual(rows.map((r) => r.kind), ['piao', 'attachment']);
    assert.equal(rows[0].path, null);
    assert.equal('index' in rows[0], false);
});

test('docs --download saves, skips what exists, and reports a failure after trying all', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'piao-'));
    const list = () => json({ success: true, result: [{ list: [rec('a', '2026-2028')], count: 1, total: 1 }] });
    let attachment = new Response('nope', { status: 404 });
    globalThis.fetch = async (url) => {
        if (String(url).includes('/api/piao')) return list();
        if (String(url).endsWith('p.pdf')) return new Response('%PDF-1', { status: 200, headers: { 'content-type': 'application/pdf' } });
        return attachment;
    };
    await assert.rejects(run('docs', { ipa: 'a', download: dir }), /1 of 2 files failed, 1 saved.*HTTP 404/);
    assert.equal(fs.readFileSync(path.join(dir, 'a/2026-2028_v1/piao-1_p.pdf'), 'utf8'), '%PDF-1');

    attachment = new Response('%PDF-2', { status: 200, headers: { 'content-type': 'application/pdf' } });
    const rows = await run('docs', { ipa: 'a', download: dir });
    assert.deepEqual(rows.map((r) => r.status), ['exists', 'downloaded']);
    assert.equal(fs.readdirSync(path.join(dir, 'a/2026-2028_v1')).some((f) => f.endsWith('.part')), false);
    fs.rmSync(dir, { recursive: true });
});

test('an HTML answer is not saved as a document', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'piao-'));
    globalThis.fetch = async (url) => (String(url).includes('/api/piao')
        ? json({ success: true, result: [{ list: [rec('a', '2026-2028')], count: 1, total: 1 }] })
        : new Response('<html>', { status: 200, headers: { 'content-type': 'text/html' } }));
    await assert.rejects(run('docs', { ipa: 'a', download: dir }), /HTML page/);
    assert.equal(fs.existsSync(path.join(dir, 'a')), false);
    fs.rmSync(dir, { recursive: true });
});
