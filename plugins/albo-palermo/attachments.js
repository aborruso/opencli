// The attachments of one act, saved to disk. They have no permanent URL: the
// detail page links them as `viewDocument?col=ALLEGATI&idx=N`, an index into
// the detail last opened in the session. Without that session the portal
// answers 200 with an HTML page, "Sessione scaduta". So this opens the act
// and downloads its attachments on the same cookie jar, one at a time.
// Next to them it saves the act itself: `act.json`, the row `get` returns,
// and `act.html`, the detail page with the attachment links pointing at the
// local files and every other link made absolute, so the page keeps the
// portal's styles when opened from disk.
import fs from 'node:fs';
import path from 'node:path';
import { cli, Strategy } from '@jackwener/opencli/registry';
import { CommandExecutionError, EmptyResultError } from '@jackwener/opencli/errors';
import { Session, BASE, actUrl, isDetail, parseDetail, attachmentLinks } from './shared.js';

/** `filename=a.pdf`, `filename="a.pdf"` or `filename*=UTF-8''a.pdf`, reduced to a safe basename. */
function filenameOf(disposition, idx) {
    const d = disposition ?? '';
    const star = /filename\*=(?:UTF-8'')?([^;]+)/i.exec(d);
    const plain = /filename="?([^";]+)"?/i.exec(d);
    let name = star ? decodeURIComponent(star[1].trim()) : plain ? plain[1].trim() : '';
    name = path.basename(name.replace(/\\/g, '/')).replace(/[\x00-\x1f<>:"|?*]/g, '_');
    return name && name !== '.' && name !== '..' ? name : `attachment-${idx}.pdf`;
}

/** The detail page as a local file: attachments point at their saved copy, the rest at the portal. */
function localPage(html, pageUrl, files) {
    return html
        .replace(/\b(href|src)=(['"])(?!https?:|#|data:|javascript:|mailto:)([^'"]+)\2/g,
            (m, attr, q, link) => `${attr}=${q}${new URL(link, pageUrl).href}${q}`)
        .replace(/href=(['"])[^'"]*viewDocument\?col=ALLEGATI&(?:amp;)?idx=(\d+)\1/g,
            (m, q, idx) => (files.has(Number(idx)) ? `href=${q}${encodeURI(files.get(Number(idx)))}${q}` : m));
}

/** Write `data` to `file` unless it is already there. */
function save(file, data) {
    if (fs.existsSync(file)) return 'exists';
    fs.writeFileSync(file, data, { flag: 'wx' });
    return 'written';
}

cli({
    site: 'albo-palermo',
    name: 'attachments',
    access: 'read',
    description: 'Download the attachments of one act of the Albo Pretorio of Palermo, from its permanent link (or its ALBCOD plus --type)',
    example: 'opencli albo-palermo attachments "https://albopretorio.comune.palermo.it/albopretorio/pu/push-tabella-delibere.do?nomeTabella=FO_SCEDELIBEREAP&TD=2022&ALBCOD=62716360706B70756474&sportello=albopretorio"',
    domain: 'albopretorio.comune.palermo.it',
    strategy: Strategy.PUBLIC,
    browser: false,
    args: [
        { name: 'act', type: 'string', positional: true, required: true, help: 'The permanent link, or only its ALBCOD value (then --type is needed)' },
        { name: 'type', type: 'string', default: '', help: 'Document type, TD code or exact name, when `act` is a bare ALBCOD' },
        { name: 'dir', type: 'string', default: '', help: 'Folder to save into; default ./albo-<TD>-<protocol number>. The act is saved there too, as act.html and act.json. Files already there are skipped, never overwritten' },
    ],
    defaultFormat: 'json',
    columns: ['idx', 'filename', 'bytes', 'signed', 'status', 'path'],
    func: async (args) => {
        const url = await actUrl(args.act, args.type);
        const session = new Session();
        const html = await session.get(url);
        if (!isDetail(html)) {
            throw new EmptyResultError('albo-palermo attachments', 'the portal shows no act at this link: it may be out of publication, or TD and ALBCOD do not match');
        }
        const links = attachmentLinks(html);
        if (!links.length) throw new EmptyResultError('albo-palermo attachments', 'this act has no attachments');
        const act = parseDetail(html);
        const td = new URL(act.permalink).searchParams.get('TD');
        const dir = path.resolve(args.dir || `albo-${td}-${act.number || new URL(act.permalink).searchParams.get('ALBCOD')}`);
        fs.mkdirSync(dir, { recursive: true });

        const rows = [];
        for (const a of links) {
            const resp = await session.send(`${BASE}/viewDocument?col=ALLEGATI&idx=${a.idx}`);
            const type = resp.headers.get('content-type') ?? '';
            if (type.startsWith('text/html')) {
                const body = await resp.text();
                const reason = /Sessione scaduta/.test(body) ? 'session expired' : 'an HTML page instead of a file';
                throw new CommandExecutionError(`albo-palermo: attachment ${a.idx} came back as ${reason}`);
            }
            const filename = filenameOf(resp.headers.get('content-disposition'), a.idx);
            const file = path.join(dir, filename);
            const row = { idx: a.idx, filename, signed: a.signed, path: file };
            // The name is only known from the response headers: stop the body
            // there when the file is already on disk.
            if (fs.existsSync(file)) {
                await resp.body?.cancel();
                rows.push({ ...row, bytes: fs.statSync(file).size, status: 'exists' });
                continue;
            }
            const bytes = Buffer.from(await resp.arrayBuffer());
            fs.writeFileSync(file, bytes, { flag: 'wx' });
            rows.push({ ...row, bytes: bytes.length, status: 'downloaded' });
        }
        const files = new Map(rows.map((r) => [r.idx, r.filename]));
        const page = path.join(dir, 'act.html');
        const meta = path.join(dir, 'act.json');
        rows.push({ idx: '', filename: 'act.html', signed: false, path: page, status: save(page, localPage(html, url, files)) });
        rows.push({ idx: '', filename: 'act.json', signed: false, path: meta, status: save(meta, `${JSON.stringify(act, null, 2)}\n`) });
        for (const r of rows.slice(-2)) r.bytes = fs.statSync(r.path).size;
        return rows;
    },
});
