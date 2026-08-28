---
schema_version: 1
last_verified: 2026-08-28
source: local
---

# Trappole di law-tracker.europa.eu

### pitfall:filters_ignored_with_free_text
trigger: `POST /search` con `quickSearch` o `title` valorizzati **insieme** a `status` o `stage`
symptom: la risposta contiene righe che non rispettano il filtro - status `WIT` con filtro `ong`, stage corrente `EOP` con filtro `FR`. Nessun errore, nessun avviso.
workaround: non combinarli. Usare `--keyword` al posto del testo libero - a differenza di status e stage non viene ignorato: con `quickSearch` attivo la risposta si restringe a zero righe invece di restituire il risultato del solo testo - oppure filtrare a valle sulle colonne `status` e `currentStage`. `opencli law-tracker search` rifiuta la combinazione con un errore ARGUMENT.
verified_at: 2026-08-28 (due prove: stage FR + "artificial intelligence" → righe EOP; title "artificial intelligence" + status ong → una procedura WIT. Da soli i filtri funzionano; `topics` e `procedure` restano invece in AND.)

### pitfall:total_results_zero
trigger: leggere `totalResults` dalla risposta di `/search` con `countResults:false`
symptom: vale `0` anche quando `searchResults` contiene righe
workaround: non usarlo come conteggio; non è mappato in nessuna colonna dell'adapter
verified_at: 2026-08-28

### pitfall:sparse_search_body
trigger: mandare a `/search` solo i campi che servono
symptom: conteggi diversi da quelli della UI a parità di filtro
workaround: mandare sempre l'envelope SearchCriteria completo e sovrascrivere i campi attivi
verified_at: 2026-08-28 (origine: progetto eutrack, riconfermato qui)

### pitfall:cookie_banner_intercepts_clicks
trigger: primo click sulla homepage con un profilo browser nuovo
symptom: `Element is covered by <a … inside div#cookie-consent-banner>`; il click cade sul banner
workaround: chiudere il banner (`Accept only essential cookies`) prima di tutto, oppure evitare del tutto la homepage navigando all'URL `/results?...`
verified_at: 2026-08-28

### pitfall:generic_page_title
trigger: usare il titolo del documento come firma di stato
symptom: `EU Law Tracker - European Union` è identico su homepage e su una procedura inesistente. Solo `/results` ha un titolo proprio (`Search results`).
workaround: ancorarsi al contenuto - il `textbox "Quick search"` per la homepage, il link col reference per la procedura
verified_at: 2026-08-28

### pitfall:silent_empty_procedure
trigger: navigare a `/procedure/<ref>` con un reference inesistente
symptom: HTTP 200, nessun messaggio d'errore, pagina con solo header, menu e footer
workaround: verificare la presenza in pagina del link col reference (`find --role link --text "<anno>/<numero>"`); via API il segnale è netto (HTTP 400)
verified_at: 2026-08-28 (`/procedure/9999_1`: find risponde `semantic_not_found`, mentre su `/procedure/2021_106` trova 1 match)

### pitfall:reference_two_spellings
trigger: costruire un URL o chiamare l'API con il reference in forma display
symptom: `/procedure/2021/0106(COD)` non esiste; `/notice/timeline?reference=2021/0106(COD)` risponde 400
workaround: convertire in forma API `2021_106` - anno, underscore, numero senza zeri iniziali. Gli adapter accettano entrambe.
verified_at: 2026-08-28

### pitfall:timeline_400_not_404
trigger: `/notice/timeline` con reference sconosciuto o malformato
symptom: HTTP 400 con `ParseError at [row,col]:[1,1] Message: Content is not allowed in prolog` - messaggio che parla di XML e non dice nulla del reference
workaround: trattarlo come errore di argomento, non come risultato vuoto
verified_at: 2026-08-28

### pitfall:eurovoc_code_is_compound
trigger: passare il codice EuroVoc così come lo stampa il vocabolario, es. `52,DOM`
symptom: la risposta di `/search` non contiene affatto la chiave `searchResults`
workaround: spezzarlo in `{"code":"52","type":"DOM"}`. L'adapter accetta la grafia `52,DOM` e la spezza da sé.
verified_at: 2026-08-28

### pitfall:timeline_actor_fields_null
trigger: cercare relatore, commissione o istituzione responsabile negli eventi della timeline
symptom: `committeeResponsible`, `rapporteur`, `responsibleBody`, `membersResponsible` sono null in quasi tutti gli eventi
workaround: non contarci; l'adapter non li espone per non avere una colonna sempre vuota
verified_at: 2026-08-28 (13 eventi di 2021/0106(COD): un solo `membersResponsible`, un solo `responsibleBody`)

### pitfall:site_name_alias
trigger: `opencli browser` deve risolvere il nome del sito per trovare questa sitemap
symptom: senza adapter registrato il nome ripiega sull'etichetta SLD, cioè `europa`, che collide con qualunque altro sito europa.eu
workaround: aggancio al solo nome `law-tracker`. Verificato a runtime: con l'adapter registrato `opencli browser open` risolve `site: "law-tracker"`, non il fallback. **L'alias `europa` è stato provato e poi respinto**: il fallback SLD fa risolvere su `europa` anche `eur-lex.europa.eu` e `commission.europa.eu`, che si sarebbero visti servire questa sitemap come contesto di navigazione. Meglio non trovare la sitemap che darne una sbagliata. Resta da verificare, col Browser Bridge collegato, che a runtime il nome risolto sia davvero `law-tracker`.
verified_at: 2026-08-28
