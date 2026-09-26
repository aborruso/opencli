#!/usr/bin/env python3
"""Acts of the albo-palermo index closest to a question.

Usage: albo-palermo-similar.py <index.sqlite> "<question>" [-n 10] [--type <type name>] [--json]

Embeds the question with the same model as the index and ranks every act by
cosine similarity, in Python, no extension. Needs OPENROUTER_API_KEY.
"""
import argparse
import json
import math
import sqlite3
import struct
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from importlib import import_module
index = import_module('albo-palermo-index')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('index')
    ap.add_argument('question')
    ap.add_argument('-n', type=int, default=10)
    ap.add_argument('--type', help='only acts of this document type (exact name)')
    ap.add_argument('--json', action='store_true', help='JSON Lines instead of a table')
    a = ap.parse_args()
    db = sqlite3.connect(a.index)
    (qv,), _ = index.embed([a.question])
    qn = math.sqrt(sum(x * x for x in qv))
    sql = 'SELECT permalink, type, date, number, subject, sector, dims, vec FROM acts WHERE model = ?'
    args = [index.MODEL]
    if a.type:
        sql += ' AND type = ?'
        args.append(a.type)
    scored = []
    for permalink, type_, date, number, subject, sector, dims, blob in db.execute(sql, args):
        v = struct.unpack(f'{dims}f', blob)
        dot = sum(x * y for x, y in zip(qv, v))
        vn = math.sqrt(sum(y * y for y in v))
        scored.append((dot / (qn * vn), permalink, type_, date, number, subject, sector))
    scored.sort(reverse=True)
    for score, permalink, type_, date, number, subject, sector in scored[:a.n]:
        if a.json:
            print(json.dumps({'score': round(score, 4), 'type': type_, 'date': date, 'number': number, 'subject': subject, 'sector': sector, 'permalink': permalink}, ensure_ascii=False))
        else:
            print(f'{score:.3f}  {date}  {type_[:30]:30}  {subject[:110]}')


if __name__ == '__main__':
    main()
