#!/usr/bin/env bash
# Merge tonight's albo-palermo dump into the archive, with the row shape of
# `opencli albo-palermo dump`. The logic and the checks are in jsonl-merge.sh.
#
# Usage: albo-palermo-merge.sh <previous.jsonl or ""> <today.jsonl> <merged.jsonl>
exec "$(dirname "$0")/jsonl-merge.sh" albo-palermo \
    '["category","td","type","number","date","subject","sector","published_from","published_to","attachments","permalink"]' \
    "${1:-}" "$2" "$3"
