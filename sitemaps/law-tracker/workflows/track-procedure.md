---
schema_version: 1
workflow_id: track-procedure
intent: reconstruct the history of a procedure whose reference is known
last_verified: 2026-08-28
source: local
---

# Track a procedure

## Goal

Given a reference (`2021/0106(COD)` or `2021_106`), get the chronology of events, the current stage and the attached documents.

## State signature

The reference is the whole state. Both spellings are accepted as adapter input; the public URL always uses the API form.

## Best path

```bash
opencli law-tracker timeline 2021/0106\(COD\) -f csv
opencli law-tracker timeline 2021_106 -f json
```

Columns: `date, stage, event, typeIdentifier, documents, reference, url`. `stage` runs PR → FR → SR → CTR → EOP; `documents` is how many documents the event carries.

## Fallback path

```yaml
on_adapter_fail:
  - adapter_health_update: opencli law-tracker timeline -> suspect
  - goto /procedure/<api-ref>?lang=en
  - action:verify_procedure_exists in pages/procedure.md
  - action:read_timeline in pages/procedure.md (expand entries with the "expand" buttons)
  - for the full official document: action:export_xml in pages/procedure.md
```

## Avoid

- Building the URL with the display form: `/procedure/2021/0106(COD)` does not exist. It needs `2021_106`, with no leading zeros in the number.
- Trusting that the page loaded as proof the procedure exists: a non-existent reference still returns HTTP 200 with nothing but the site chrome.
- Looking for the rapporteur or the responsible institution in the timeline: those fields exist in the notice but are null on almost every event.

## State validation

The adapter returns at least one row and the display-form `reference` matches the one you asked for. On the page, the proof is the visible reference link.

## Stale markers

If `/notice/timeline` starts answering 404 (today it answers 400) on unknown references, or the actor fields start being populated, update the adapter and the notes.
