---
schema_version: 1
workflow_id: track-procedure
intent: ricostruire l'iter di una procedura di cui si conosce il reference
last_verified: 2026-08-28
source: local
---

# Seguire una procedura

## Goal

Dato un reference (`2021/0106(COD)` oppure `2021_106`), ottenere la cronologia degli eventi, la fase corrente e i documenti collegati.

## State signature

Il reference è tutto lo stato. Le due grafie sono equivalenti in ingresso agli adapter; l'URL pubblico usa sempre la forma API.

## Best path

```bash
opencli law-tracker timeline 2021/0106\(COD\) -f csv
opencli law-tracker timeline 2021_106 -f json
```

Colonne: `date, stage, event, typeIdentifier, documents, reference, url`. `stage` segue l'ordine PR → FR → SR → CTR → EOP; `documents` è il numero di documenti allegati all'evento.

## Fallback path

```yaml
on_adapter_fail:
  - adapter_health_update: opencli law-tracker timeline -> suspect
  - goto /procedure/<api-ref>?lang=en
  - action:verify_procedure_exists in pages/procedure.md
  - action:read_timeline in pages/procedure.md (espandere le voci con i bottoni "expand")
  - per il documento ufficiale completo: action:export_xml in pages/procedure.md
```

## Avoid

- Costruire l'URL con la forma display: `/procedure/2021/0106(COD)` non esiste. Serve `2021_106`, senza zeri iniziali nel numero.
- Fidarsi del caricamento della pagina come prova che la procedura esiste: un reference inesistente rende comunque HTTP 200 con solo il chrome del sito.
- Cercare in timeline il nome del relatore o dell'istituzione responsabile: quei campi esistono nella notice ma sono null nella quasi totalità degli eventi.

## State validation

L'adapter restituisce almeno una riga e `reference` in forma display coincide con quello atteso. Sulla pagina, la prova è il link con il reference visibile.

## Stale markers

Se `/notice/timeline` inizia a rispondere 404 (oggi risponde 400) su reference inesistenti, o se i campi di attore si popolano, aggiornare adapter e note.
