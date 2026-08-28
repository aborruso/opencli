---
schema_version: 1
page_id: homepage
url_patterns:
  - https://law-tracker.europa.eu/homepage
  - https://law-tracker.europa.eu/homepage?lang=en
purpose: punto d'ingresso; ospita quick search, Browse by topic e il pannello Advanced Search
last_verified: 2026-08-28
source: local
---

# Homepage

Tutte e tre le modalità di ricerca vivono qui e producono un URL `/results?...` deep-linkabile. **Se sai già cosa cercare, non passare da questa pagina**: costruisci direttamente l'URL dei risultati (vedi `pages/results.md`) o usa `opencli law-tracker search`.

## Visual anchors

- text: `EU Law Tracker` come `heading level=1` (presente su ogni pagina, non basta da solo)
- a11y: `textbox "Quick search"` + `button "Search"` - questa coppia identifica la homepage
- a11y: `button "Browse by topics"` e `button "Advanced Search"` (`expanded=false` da chiusa)

## Actions on this page

### action:dismiss_cookie_banner
pre: prima visita del profilo browser; è presente `region "Cookies policy"`
do: click sul link `Accept only essential cookies` dentro la region
post: la region "Cookies policy" sparisce dallo snapshot; i click sui bottoni della pagina non vengono più intercettati
fail: `Element is covered by <a ... inside div#cookie-consent-banner>` su un click qualsiasi
recover: rieseguire questa action prima di ogni altra; oppure saltare del tutto la pagina e navigare all'URL `/results?...`
evidence: agent-browser click @e30 → errore "covered by ... #cookie-consent-banner"; agent-browser click @e6 (Accept only essential cookies) → banner via

### action:quick_search
pre: homepage caricata, banner cookie già chiuso
do: fill del `textbox "Quick search"` con il testo, poi click sul `button "Search"`
post: URL diventa `/results?quickSearch=<q>&sort=REL&page=0&pageSize=10&lang=en`, titolo pagina `Search results`
fail: il click non ha effetto e l'URL resta `/homepage` | errore "covered by"
recover: eseguire `action:dismiss_cookie_banner`, poi ripetere; oppure navigare direttamente all'URL dei risultati
evidence: agent-browser fill @e27 "climate" + click @e26 → https://law-tracker.europa.eu/results?quickSearch=climate&sort=REL&page=0&pageSize=10&lang=en

### action:browse_by_topic
pre: homepage caricata, banner chiuso
do: click su `button "Browse by topics"`, check della casella del dominio voluto (21 tessere EuroVoc), click su `button "Continue"`
post: URL `/results?eurovoc=["<code>,DOM"]&searchType=topics&sort=DOCD_DESC&page=0&pageSize=10&lang=en`, titolo `Search results`
fail: `button "Continue"` resta `disabled` (nessun topic selezionato)
recover: selezionare almeno una casella prima di premere Continue
evidence: agent-browser click @e17 → check @e57 (Environment) → find role button click --name "Continue" → results?eurovoc=%5B%2252,DOM%22%5D&searchType=topics

### action:advanced_search
pre: homepage caricata, banner chiuso
do: click su `button "Advanced Search"` (accordion, non cambia URL), impostare i campi voluti, click sul `button "Search"` in fondo al pannello
post: URL `/results?searchType=advanced&<filtri>&sort=REL&page=0&pageSize=10&lang=en`
fail: l'accordion non si apre (`expanded` resta false) | il click cade sul `button "Search"` della quick search invece che su quello del pannello
recover: prendere il ref del bottone Search **interno al pannello** dallo snapshot dopo l'apertura, non quello della quick search
evidence: agent-browser find role button click --name "Advanced Search" → click @e54 (Ongoing) + @e64 (First reading) + @e44 → results?searchType=advanced&statusType=ONG&stage=%5B%22FR%22%5D

## Campi del pannello Advanced Search

Proposal title (Title) · Procedure reference (Year, Number, Type) · Status (All / Ongoing / Adopted / Not adopted / Withdrawn, più filtri per data) · Stage (Proposal, First reading, Second reading, Conciliation and third reading, End of procedure) · Events (EU institution/body, Event, date).

I codici che finiscono nell'URL e nel body API si leggono con `opencli law-tracker topics <kind>`.

## Linked APIs

`advanced_search_dropdown_nodes` popola i menu del pannello e le tessere di Browse by topic. `search` è la POST che parte alla pressione di Search. Vedi `endpoints.json`.
