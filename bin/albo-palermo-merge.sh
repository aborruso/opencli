#!/usr/bin/env bash
# Merge tonight's albo-palermo dump into the archive: append, sort, drop
# identical lines. Refuses, with a non-zero exit and no output file, when the
# dump is empty, when a row does not have the expected fields, or when the
# merged archive would have fewer rows than the previous one.
#
# Usage: albo-palermo-merge.sh <previous.jsonl or ""> <today.jsonl> <merged.jsonl>
set -euo pipefail

prev=${1:-}
today=$2
out=$3

# The row shape of `opencli albo-palermo dump`: these keys, in this order, all strings.
KEYS='["category","td","type","number","date","subject","sector","published_from","published_to","attachments","permalink"]'

fail() { echo "albo-palermo-merge: $*" >&2; exit 1; }

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
echo "albo-palermo-merge: previous $prev_rows, tonight $today_rows, merged $merged_rows ($((merged_rows - prev_rows)) new)"
