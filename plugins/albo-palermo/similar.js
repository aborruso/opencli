// A question in plain words against the index of the nightly archive
// (albo-palermo.sqlite, an asset of the release albo-palermo-data): the acts
// whose "type / office / subject" text is closest. Two rankings, fused by
// reciprocal rank: the cosine between the question's vector and the vector
// of every act (openai/text-embedding-3-small; the question is embedded
// through OpenRouter, the only thing that leaves the machine) and BM25 over
// the same text in FTS5, where every word of the question is a prefix.
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
const COLUMNS = ['score', 'vector_rank', 'keyword_rank', 'category', 'type', 'number', 'date', 'subject', 'sector', 'published_to', 'permalink'];
const MODES = ['hybrid', 'vector', 'keyword'];
const RRF_K = 60;

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

// Function words of a question in Italian, which BM25 would otherwise match.
const STOP = new Set('a ad al alla alle allo agli ai all da dal dalla dalle dallo dagli dai di del della delle dello degli dei de in nel nella nelle nello negli nei su sul sulla sulle sullo sugli sui con per tra fra e ed o od il lo la le gli i un uno una che chi cui non come dove quando quale quali questo questa questi queste quello quella quelli quelle ci si ne vi mi ti lo è sono sia essere avere ha hanno anche ma se più meno molto poco tutti tutte tutto ogni altro altri altra altre atti atto pubblicazione pubblicazioni'.split(' '));

/** Every meaningful word of the question as a prefix, ORed: FTS5 has no Italian stemmer. */
function ftsQuery(question) {
    const words = (question.toLowerCase().match(/[\p{L}\p{N}]{2,}/gu) ?? []).filter((w) => !STOP.has(w));
    return words.map((w) => `"${w}"*`).join(' OR ');
}

/** Fuse ranked lists of permalinks: sum of 1/(k + rank). */
function fuse(lists) {
    const score = new Map();
    for (const list of lists) {
        list.forEach((id, i) => score.set(id, (score.get(id) ?? 0) + 1 / (RRF_K + i + 1)));
    }
    return score;
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
    description: 'The acts of the nightly archive closest to a question in plain words: meaning (vector of type, office and subject, question embedded through OpenRouter) and words (BM25), fused; the ranking is local',
    example: 'opencli albo-palermo similar "aree bruciate dagli incendi" --limit 5',
    domain: 'albopretorio.comune.palermo.it',
    strategy: Strategy.PUBLIC,
    browser: false,
    args: [
        { name: 'question', type: 'string', positional: true, required: true, help: 'The question or topic, in Italian, e.g. "chiusura di strade per lavori"' },
        { name: 'limit', type: 'int', default: 10, help: 'Acts to return, 1 to 100' },
        { name: 'type', type: 'string', default: '', help: 'Only acts of this document type (exact name, e.g. "Ordinanze Sindacali")' },
        { name: 'mode', type: 'string', default: 'hybrid', help: `${MODES.join(', ')}: both rankings fused, the vector one alone, the BM25 one alone` },
        { name: 'index', type: 'string', default: '', help: `Path of the index; default: the release asset, cached in ${CACHE} for 12 hours` },
    ],
    defaultFormat: 'table',
    columns: COLUMNS,
    footerExtra: (kwargs) => (kwargs._n == null ? undefined : `${kwargs._n} acts in the index, ${kwargs._mode}${kwargs._kw == null ? '' : `, ${kwargs._kw} match the words`}${kwargs._cost == null ? '' : `; the question cost $${kwargs._cost}`}`),
    func: async (args) => {
        const question = String(args.question ?? '').trim();
        if (!question) throw new ArgumentError('give a question');
        const n = Number(args.limit);
        if (!Number.isInteger(n) || n < 1 || n > 100) throw new ArgumentError('--limit must be 1 to 100');
        const mode = String(args.mode ?? 'hybrid').toLowerCase();
        if (!MODES.includes(mode)) throw new ArgumentError(`--mode must be one of ${MODES.join(', ')}`);
        const db = new DatabaseSync(await indexPath(args.index), { readOnly: true });
        const typeSql = args.type ? ' AND type = ?' : '';
        const typeArgs = args.type ? [String(args.type)] : [];
        const rows = db.prepare(`SELECT category, type, number, date, subject, sector, published_to, permalink, vec FROM acts WHERE model = ?${typeSql}`).all(MODEL, ...typeArgs);
        if (!rows.length) throw new EmptyResultError('albo-palermo similar', args.type ? `no act of type "${args.type}" in the index` : 'the index is empty');
        const byId = new Map(rows.map((r) => [r.permalink, r]));

        let vectorRank = new Map();
        let cost = null;
        if (mode !== 'keyword') {
            const { vec: q, cost: c } = await embed(question);
            cost = c;
            const qn = Math.sqrt(q.reduce((s, x) => s + x * x, 0));
            const ranked = rows.map((r) => [cosine(q, qn, r.vec), r.permalink]).sort((a, b) => b[0] - a[0]);
            vectorRank = new Map(ranked.map(([, id], i) => [id, i + 1]));
        }
        let keywordRank = new Map();
        if (mode !== 'vector') {
            const match = ftsQuery(question);
            const hits = match
                ? db.prepare(`SELECT f.permalink FROM acts_fts f JOIN acts a ON a.permalink = f.permalink WHERE acts_fts MATCH ? AND a.model = ?${typeSql} ORDER BY bm25(acts_fts)`).all(match, MODEL, ...typeArgs)
                : [];
            keywordRank = new Map(hits.map((h, i) => [h.permalink, i + 1]));
        }
        const lists = [];
        if (mode !== 'keyword') lists.push([...vectorRank.keys()]);
        if (mode !== 'vector') lists.push([...keywordRank.keys()]);
        const fused = fuse(lists);
        if (!fused.size) throw new EmptyResultError('albo-palermo similar', `no act matches the words of "${question}"`);
        args._n = rows.length;
        args._mode = mode;
        args._kw = mode === 'vector' ? null : keywordRank.size;
        args._cost = cost;
        return [...fused.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([id, score]) => {
            const r = byId.get(id);
            return {
                score: Number((score * 100).toFixed(2)),
                vector_rank: vectorRank.get(id) ?? '',
                keyword_rank: keywordRank.get(id) ?? '',
                category: r.category, type: r.type, number: r.number, date: r.date, subject: r.subject, sector: r.sector, published_to: r.published_to, permalink: r.permalink,
            };
        });
    },
});
