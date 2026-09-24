#!/usr/bin/env bash
# Merge the palermo-delibere dump into the archive, with the row shape of
# `opencli palermo-delibere dump`. The logic and the checks are in jsonl-merge.sh.
#
# Usage: palermo-delibere-merge.sh <previous.jsonl or ""> <today.jsonl> <merged.jsonl>
exec "$(dirname "$0")/jsonl-merge.sh" palermo-delibere \
    '["section","type","number","date","subject","sector","published_to","attachments","permalink"]' \
    "${1:-}" "$2" "$3"
