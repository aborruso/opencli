---
schema_version: 1
page_id: procedure
url_patterns:
  - https://law-tracker.europa.eu/procedure/
purpose: scheda di una singola procedura legislativa, con la sua timeline
last_verified: 2026-08-28
source: local
---

# Pagina procedura

URL: `/procedure/<api-ref>?lang=en`, dove `<api-ref>` è la forma API del reference: `2021_106`, **non** `2021/0106(COD)`. Il numero perde gli zeri iniziali.

## Visual anchors

- a11y: `link` il cui testo è il reference in forma display, es. `2021/0106(COD)` - **questo è l'ancora di stato**, non il titolo del documento
- a11y: `link "Download XML file"`
- a11y: `button "Latest events"` e `button "Full timeline"`
- ⚠️ il `<title>` resta `EU Law Tracker - European Union`: identico a quello di una procedura inesistente, inutile come firma

## Actions on this page

### action:verify_procedure_exists
pre: navigazione a `/procedure/<api-ref>` completata
do: `opencli browser <sess> find --role link --text "<anno>/<numero>"`
post: il link esiste → la procedura esiste
fail: `semantic_not_found` - "Semantic locator matched 0 elements"
recover: il reference è sbagliato o inesistente; ricavare quello giusto da `opencli law-tracker search` o dalla pagina risultati. Vedi `pitfalls.md#silent_empty_procedure`
evidence: opencli browser <sess> find --role link --text "2021/0106" → matches_n 1, testo "2021/0106(COD)"; su /procedure/9999_1 la stessa find risponde semantic_not_found

### action:read_timeline
pre: pagina procedura valida
do: `opencli law-tracker timeline <reference>` (accetta sia `2021/0106(COD)` sia `2021_106`)
post: una riga per evento con `date, stage, event, typeIdentifier, documents, reference, url`
fail: errore ARGUMENT su reference malformato o inesistente | EMPTY se la notice non ha eventi
recover: correggere il reference; se il comando fallisce ripetutamente, adapter_health_update: opencli law-tracker timeline -> suspect, e leggere la timeline dalla pagina espandendo le voci con i bottoni `expand`
evidence: opencli law-tracker timeline 2021_106 -f csv → 13 righe, da 22/04/2021 PR a 12/07/2024 EOP

### action:export_xml
pre: pagina procedura valida
do: click su `link "Download XML file"`, oppure `GET /notice/export?reference=<api-ref>&lang=en`
post: file XML della notice ufficiale
fail: download non parte nel browser
recover: usare l'endpoint HTTP, che non richiede il browser
evidence: link "Download XML file" presente nello snapshot di /procedure/2021_106; endpoint documentato in eutrack (spec.yaml)

## Linked APIs

`notice_timeline` alimenta questa pagina. Vedi `endpoints.json`.
