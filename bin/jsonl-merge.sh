#!/usr/bin/env bash
# Merge tonight's dump into a JSON Lines archive: append, sort, drop
# identical lines. Refuses, with a non-zero exit and no output file, when the
# dump is empty, when a row does not have the expected fields, or when the
# merged archive would have fewer rows than the previous one.
#
# Usage: jsonl-merge.sh <name> <keys as a JSON array> <previous.jsonl or ""> <today.jsonl> <merged.jsonl>
# <keys> is the row shape: these keys, in this order, all strings.
set -euo pipefail

name=$1
KEYS=$2
prev=${3:-}
today=$4
out=$5

fail() { echo "$name-merge: $*" >&2; exit 1; }

check_schema() {
    # Prints the number of the first bad line, or nothing.
    jq -c --argjson k "$KEYS" 'select((keys_unsorted != $k) or ([.[] | type] | unique != ["string"])) | input_line_number' "$1" 2>/dev/null | head -1
}

rows() { if [[ -s $1 ]]; then wc -l < "$1"; else echo 0; fi; }

[[ -f $today ]] || fail "no dump file $today"
today_rows=$(rows "$today")
(( today_rows > 0 )) || fail "tonight's dump is empty"
jq -e . "$today" > /dev/null 2>&1 || fail "tonight's dump is not valid JSON Lines"
bad=$(check_schema "$today"); [[ -z $bad ]] || fail "tonight's dump, line $bad: fields differ from $KEYS"

prev_rows=0
if [[ -n $prev ]]; then
    [[ -f $prev ]] || fail "no previous archive $prev"
    prev_rows=$(rows "$prev")
    (( prev_rows > 0 )) || fail "the previous archive is empty"
    jq -e . "$prev" > /dev/null 2>&1 || fail "the previous archive is not valid JSON Lines"
    bad=$(check_schema "$prev"); [[ -z $bad ]] || fail "previous archive, line $bad: fields differ from $KEYS"
fi

tmp=$(mktemp)
trap 'rm -f "$tmp"' EXIT
cat ${prev:+"$prev"} "$today" | LC_ALL=C sort -u > "$tmp"
merged_rows=$(rows "$tmp")
(( merged_rows >= prev_rows )) || fail "merged archive has $merged_rows rows, fewer than the previous $prev_rows"

mv "$tmp" "$out"
trap - EXIT
echo "$name-merge: previous $prev_rows, tonight $today_rows, merged $merged_rows ($((merged_rows - prev_rows)) new)"
