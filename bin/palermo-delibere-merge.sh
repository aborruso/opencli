#!/usr/bin/env bash
# Merge the palermo-delibere dump into the archive, with the row shape of
# `opencli palermo-delibere dump`. The logic and the checks are in jsonl-merge.sh.
# The dump runs with --known, so it can have no new act: an empty dump is
# accepted when there is a previous archive.
#
# Usage: palermo-delibere-merge.sh <previous.jsonl or ""> <today.jsonl> <merged.jsonl>
ALLOW_EMPTY_DUMP=1 exec "$(dirname "$0")/jsonl-merge.sh" palermo-delibere \
    '["section","type","number","date","act_number","act_date","subject","sector","published_to","attachments","permalink"]' \
    "${1:-}" "$2" "$3"
