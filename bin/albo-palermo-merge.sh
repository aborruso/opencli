#!/usr/bin/env bash
# Merge tonight's albo-palermo dump into the archive, with the row shape of
# `opencli albo-palermo dump`. The logic and the checks are in jsonl-merge.sh.
# The dump runs with --known, so it can have no new act: an empty dump is
# accepted when there is a previous archive.
#
# Usage: albo-palermo-merge.sh <previous.jsonl or ""> <today.jsonl> <merged.jsonl>
ALLOW_EMPTY_DUMP=1 exec "$(dirname "$0")/jsonl-merge.sh" albo-palermo \
    '["category","td","type","number","date","subject","sector","published_from","published_to","attachments","permalink"]' \
    "${1:-}" "$2" "$3"
