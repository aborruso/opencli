---
schema_version: 1
workflow_id: find-procedures
intent: trovare le procedure legislative che riguardano un tema, uno stato o una fase
last_verified: 2026-08-28
source: local
---

# Trovare procedure

## Goal

Da una domanda in linguaggio naturale ("le proposte ancora aperte in prima lettura sull'ambiente") a un elenco di procedure con reference e URL citabile.

## State signature

Nessuno stato da mantenere: la ricerca è senza sessione e senza login. Se hai già un URL `/results?...` sei a metà strada.

## Best path

`opencli law-tracker search` con i filtri di prima classe.

```bash
opencli law-tracker search "artificial intelligence" -f json     # solo testo libero
opencli law-tracker search --status ong --stage FR --size 20     # solo filtri
opencli law-tracker search --eurovoc "52,DOM" -f csv             # per dominio EuroVoc
opencli law-tracker topics eurovoc                               # i 21 domini e i loro codici
opencli law-tracker topics policy-area                           # codici policy area
```

**Regola che non si può aggirare: testo libero e filtri `--status`/`--stage` non vanno insieme.** Il backend, quando riceve testo, ignora quei due filtri e restituisce righe che non li rispettano. L'adapter rifiuta la combinazione con un errore ARGUMENT invece di consegnare dati sbagliati. Se serve restringere una ricerca testuale, usare `--keyword` (che è un filtro strutturato e resta in AND) oppure filtrare a valle sulle colonne `status` e `currentStage`.

## Fallback path

```yaml
on_adapter_fail:
  - adapter_health_update: opencli law-tracker search -> suspect
  - navigare direttamente all'URL dei risultati, senza passare dalla homepage:
      /results?quickSearch=<testo>&sort=REL&page=0&pageSize=10&lang=en
      /results?searchType=advanced&statusType=ONG&stage=%5B%22FR%22%5D&sort=REL&page=0&pageSize=10&lang=en
      /results?eurovoc=%5B%22<code>,DOM%22%5D&searchType=topics&sort=DOCD_DESC&page=0&pageSize=10&lang=en
  - action:list_results in pages/results.md
```

Se la navigazione diretta non è praticabile, allora e solo allora passare dalla homepage: `action:dismiss_cookie_banner` → `action:quick_search` / `action:browse_by_topic` / `action:advanced_search` in `pages/homepage.md`.

## Avoid

- Compilare i form della homepage quando l'URL dei risultati si può costruire: si spendono turni e si incrocia il banner cookie.
- Leggere `totalResults` dalla risposta di `/search`: vale 0 anche quando i risultati ci sono.
- Ricavare il numero di procedure contando le righe di una pagina: la pagina è di 20 elementi al massimo.

## State validation

Ogni riga ha un `reference` in forma display e un `url` verso `/procedure/<api-ref>`. Se l'`url` manca, il reference non era interpretabile.

## Stale markers

Se i parametri d'URL della pagina risultati cambiano nome, o `--status`/`--stage` cominciano a funzionare **anche** con il testo libero, questa pagina è vecchia: riverificare e aggiornare `pitfalls.md`.
