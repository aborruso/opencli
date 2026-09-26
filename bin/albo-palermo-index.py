#!/usr/bin/env python3
"""Update the semantic index of the albo-palermo archive.

Usage: albo-palermo-index.py <archive.jsonl> <index.sqlite>

One row per act, keyed by permalink. The text embedded is the type of act, the
proposing office and the subject. Only rows missing from the index, or whose
text changed, are sent to the embedding model; the rest is kept. Needs
OPENROUTER_API_KEY. Python 3 standard library only.
"""
import json
import os
import sqlite3
import struct
import sys
import urllib.request

MODEL = 'openai/text-embedding-3-small'
ENDPOINT = 'https://openrouter.ai/api/v1/embeddings'
BATCH = 100
COLUMNS = ['category', 'td', 'type', 'number', 'date', 'subject', 'sector', 'published_from', 'published_to', 'attachments', 'permalink']


def act_text(row):
    return f"Tipo di atto: {row['type']}. Ufficio: {row['sector']}. Oggetto: {row['subject']}"


def embed(texts):
    key = os.environ.get('OPENROUTER_API_KEY')
    if not key:
        sys.exit('albo-palermo-index: OPENROUTER_API_KEY is not set')
    req = urllib.request.Request(ENDPOINT, data=json.dumps({'model': MODEL, 'input': texts}).encode(),
                                 headers={'Authorization': f'Bearer {key}', 'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=120) as resp:
        body = json.load(resp)
    if 'data' not in body or len(body['data']) != len(texts):
        sys.exit(f'albo-palermo-index: unexpected answer from the embedding endpoint: {json.dumps(body)[:300]}')
    return [d['embedding'] for d in body['data']], body.get('usage', {})


def open_index(path):
    db = sqlite3.connect(path)
    db.execute(f"""CREATE TABLE IF NOT EXISTS acts (
        permalink TEXT PRIMARY KEY,
        {', '.join(f'{c} TEXT' for c in COLUMNS if c != 'permalink')},
        text TEXT NOT NULL,
        model TEXT NOT NULL,
        dims INTEGER NOT NULL,
        vec BLOB NOT NULL)""")
    # The keyword side of the hybrid search: FTS5 over the same text, BM25
    # built in. No Italian stemmer in FTS5, so the query side uses prefixes.
    db.execute("CREATE VIRTUAL TABLE IF NOT EXISTS acts_fts USING fts5(permalink UNINDEXED, text, tokenize='unicode61 remove_diacritics 2')")
    return db


def refresh_fts(db):
    db.execute('DELETE FROM acts_fts')
    db.execute('INSERT INTO acts_fts (permalink, text) SELECT permalink, text FROM acts')
    db.commit()


def main():
    if len(sys.argv) != 3:
        sys.exit(__doc__.strip())
    archive, path = sys.argv[1:3]
    rows = [json.loads(line) for line in open(archive, encoding='utf-8') if line.strip()]
    db = open_index(path)
    known = dict(db.execute('SELECT permalink, text FROM acts WHERE model = ?', (MODEL,)))
    todo = [r for r in rows if known.get(r['permalink']) != act_text(r)]
    tokens, cost = 0, 0.0
    for i in range(0, len(todo), BATCH):
        chunk = todo[i:i + BATCH]
        vecs, usage = embed([act_text(r) for r in chunk])
        tokens += usage.get('total_tokens', 0)
        cost += usage.get('cost', 0) or 0
        db.executemany(
            f"INSERT OR REPLACE INTO acts (permalink, {', '.join(c for c in COLUMNS if c != 'permalink')}, text, model, dims, vec) "
            f"VALUES ({', '.join('?' for _ in COLUMNS)}, ?, ?, ?, ?)",
            [tuple(str(r.get(c, '') or '') for c in ['permalink'] + [c for c in COLUMNS if c != 'permalink'])
             + (act_text(r), MODEL, len(v), struct.pack(f'{len(v)}f', *v)) for r, v in zip(chunk, vecs)])
        db.commit()
    if todo or db.execute('SELECT count(*) FROM acts_fts').fetchone()[0] != db.execute('SELECT count(*) FROM acts').fetchone()[0]:
        refresh_fts(db)
    total = db.execute('SELECT count(*) FROM acts').fetchone()[0]
    print(f'albo-palermo-index: {len(rows)} acts in the archive, {len(todo)} embedded ({tokens} tokens, ${cost:.5f}), {total} in the index', file=sys.stderr)


if __name__ == '__main__':
    main()
