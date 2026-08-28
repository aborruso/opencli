---
schema_version: 1
page_id: results
url_patterns:
  - https://law-tracker.europa.eu/results
purpose: elenco delle procedure che soddisfano una ricerca, con facet laterali e paginazione
last_verified: 2026-08-28
source: local
---

# Pagina risultati

**Deep-linkabile**: tutti i parametri di ricerca stanno nell'URL, quindi si arriva qui con una sola navigazione, senza toccare la homepage e senza incrociare il banner cookie.

## Forma dell'URL

```
/results?quickSearch=<testo>&sort=REL&page=0&pageSize=10&lang=en
/results?eurovoc=%5B%22<code>,DOM%22%5D&searchType=topics&sort=DOCD_DESC&page=0&pageSize=10&lang=en
/results?searchType=advanced&statusType=ONG&stage=%5B%22FR%22%5D&sort=REL&page=0&pageSize=10&lang=en
```

`sort`: `REL` | `DATE` | `DOCD_DESC`. Attenzione: sono i valori dell'**URL**; nel body dell'API l'ordinamento per data si chiama `DOCD` e `DATE` dà 400 (vedi `pitfalls.md#sort_date_is_docd`). `pageSize`: 5 | 10 | 20 (sono le sole voci del menu "View"). `page` è zero-based. `statusType` nell'URL è maiuscolo (`ONG`, `ADO`, `NAD`, `WIT`), mentre nel body dell'API è minuscolo.

## Visual anchors

- text: titolo del documento = `Search results` - **è l'unica pagina del sito con un `<title>` proprio**, quindi è una firma di stato affidabile (`opencli browser <sess> state` → `title: Search results`)
- a11y: `heading "Search results" level=2`
- a11y: `combobox "Sort by:"` e `combobox "View"`
- a11y: i risultati sono `link` il cui accessible name inizia con il reference (`2021/0106(COD) …`) e il cui `href` è `/procedure/<api-ref>`

## Actions on this page

### action:list_results
pre: URL `/results?...` caricato, rete a riposo
do: snapshot degli elementi interattivi con gli href e filtro sui link verso `/procedure/`
post: una riga per procedura, ognuna con reference nel nome e `api-ref` nell'href
fail: zero link verso `/procedure/` | la pagina resta sul solo chrome del sito
recover: verificare che l'URL contenga `lang=en`; se il filtro è troppo stretto allargarlo; per un elenco strutturato preferire `opencli law-tracker search`
evidence: agent-browser open '/results?quickSearch=artificial%20intelligence&sort=DATE&page=0&pageSize=5&lang=en' + snapshot -i -c -u → 3 link /procedure/ (2022_303, 2021_106, 2025_359)

### action:open_procedure_from_results
pre: elenco risultati visibile
do: leggere l'`href` del link e navigare a quell'URL (non serve cliccare)
post: URL `/procedure/<api-ref>`, si applica `pages/procedure.md`
fail: navigazione riuscita ma pagina senza contenuto (reference inesistente)
recover: verificare la presenza del link con il reference in pagina, vedi `pitfalls.md#silent_empty_procedure`
evidence: snapshot -i -u su /results → url=https://law-tracker.europa.eu/procedure/2021_106

## Facet laterali

La colonna sinistra ha filtri per anno e per dominio EuroVoc con i conteggi (es. `ENVIRONMENT(2)`), e un bottone `Apply filters`. Sono l'unica cosa di questa pagina che gli adapter non restituiscono: se servono i conteggi per facet, il browser è la strada.

## Linked APIs

`search` (POST). L'adapter `opencli law-tracker search` copre le stesse ricerche con i filtri di prima classe.
