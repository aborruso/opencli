// A question in plain words against the semantic index of the nightly archive:
// the acts whose "type / office / subject" text is closest in meaning. The
// index (albo-palermo.sqlite, an asset of the release albo-palermo-data) holds
// one vector per act from openai/text-embedding-3-small; the question is
// embedded with the same model through OpenRouter, the ranking is a cosine
// computed here. Nothing else leaves the machine.
import { readFileSync, writeFileSync, mkdirSync, statSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { cli, Strategy } from '@jackwener/opencli/registry';
import { ArgumentError, CommandExecutionError, EmptyResultError } from '@jackwener/opencli/errors';

const INDEX_URL = 'https://github.com/aborruso/opencli/releases/download/albo-palermo-data/albo-palermo.sqlite';
const CACHE = join(homedir(), '.cache', 'opencli-albo-palermo', 'albo-palermo.sqlite');
const FRESH_MS = 12 * 3600 * 1000;
const EMBED_URL = 'https://openrouter.ai/api/v1/embeddings';
const MODEL = 'openai/text-embedding-3-small';
const COLUMNS = ['score', 'category', 'type', 'number', 'date', 'subject', 'sector', 'published_to', 'permalink'];

/** The index: the given file, or the release asset cached for 12 hours. */
async function indexPath(given) {
    if (given) {
        if (!existsSync(given)) throw new ArgumentError(`--index ${given}: no such file`);
        return given;
    }
    const age = existsSync(CACHE) ? Date.now() - statSync(CACHE).mtimeMs : Infinity;
    if (age < FRESH_MS) return CACHE;
    const resp = await fetch(INDEX_URL, { redirect: 'follow' });
    if (!resp.ok) {
        if (existsSync(CACHE)) return CACHE;
        throw new CommandExecutionError(`albo-palermo similar: cannot download the index (${resp.status} ${INDEX_URL})`);
    }
    mkdirSync(join(CACHE, '..'), { recursive: true });
    writeFileSync(CACHE, Buffer.from(await resp.arrayBuffer()));
    return CACHE;
}

async function embed(text) {
    const key = process.env.OPENROUTER_API_KEY;
    if (!key) throw new CommandExecutionError('albo-palermo similar: set OPENROUTER_API_KEY (the question is embedded through OpenRouter)');
    const resp = await fetch(EMBED_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: MODEL, input: [text] }),
    });
    const body = await resp.json().catch(() => ({}));
    if (!resp.ok || !body.data?.[0]?.embedding) {
        throw new CommandExecutionError(`albo-palermo similar: embedding failed (${resp.status}): ${JSON.stringify(body).slice(0, 300)}`);
    }
    return { vec: body.data[0].embedding, cost: body.usage?.cost ?? null };
}

function cosine(q, qn, blob) {
    const v = new Float32Array(blob.buffer, blob.byteOffset, blob.byteLength / 4);
    let dot = 0;
    let vn = 0;
    for (let i = 0; i < v.length; i++) {
        dot += q[i] * v[i];
        vn += v[i] * v[i];
    }
    return dot / (qn * Math.sqrt(vn));
}

cli({
    site: 'albo-palermo',
    name: 'similar',
    access: 'read',
    description: 'The acts of the nightly archive closest in meaning to a question in plain words (semantic index of type, office and subject; the question is embedded through OpenRouter, the ranking is local)',
    example: 'opencli albo-palermo similar "aree bruciate dagli incendi" --limit 5',
    domain: 'albopretorio.comune.palermo.it',
    strategy: Strategy.PUBLIC,
    browser: false,
    args: [
        { name: 'question', type: 'string', positional: true, required: true, help: 'The question or topic, in Italian, e.g. "chiusura di strade per lavori"' },
        { name: 'limit', type: 'int', default: 10, help: 'Acts to return, 1 to 100' },
        { name: 'type', type: 'string', default: '', help: 'Only acts of this document type (exact name, e.g. "Ordinanze Sindacali")' },
        { name: 'index', type: 'string', default: '', help: `Path of the index; default: the release asset, cached in ${CACHE} for 12 hours` },
    ],
    defaultFormat: 'table',
    columns: COLUMNS,
    footerExtra: (kwargs) => (kwargs._n == null ? undefined : `${kwargs._n} acts in the index (${kwargs._model}); the question cost $${kwargs._cost ?? '?'}`),
    func: async (args) => {
        const question = String(args.question ?? '').trim();
        if (!question) throw new ArgumentError('give a question');
        const n = Number(args.limit);
        if (!Number.isInteger(n) || n < 1 || n > 100) throw new ArgumentError('--limit must be 1 to 100');
        const db = new DatabaseSync(await indexPath(args.index), { readOnly: true });
        const { vec: q, cost } = await embed(question);
        const qn = Math.sqrt(q.reduce((s, x) => s + x * x, 0));
        const sql = `SELECT category, type, number, date, subject, sector, published_to, permalink, vec FROM acts WHERE model = ?${args.type ? ' AND type = ?' : ''}`;
        const rows = db.prepare(sql).all(...(args.type ? [MODEL, String(args.type)] : [MODEL]));
        if (!rows.length) throw new EmptyResultError('albo-palermo similar', args.type ? `no act of type "${args.type}" in the index` : 'the index is empty');
        const scored = rows.map((r) => ({ score: cosine(q, qn, r.vec), ...r, vec: undefined }));
        scored.sort((a, b) => b.score - a.score);
        args._n = rows.length;
        args._model = MODEL;
        args._cost = cost;
        return scored.slice(0, n).map((r) => ({ ...r, score: Number(r.score.toFixed(3)) }));
    },
});
