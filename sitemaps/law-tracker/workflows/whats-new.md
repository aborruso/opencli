---
schema_version: 1
workflow_id: whats-new
intent: sapere cosa si è mosso di recente nel processo legislativo europeo
last_verified: 2026-08-28
source: local
---

# Novità recenti

## Goal

Elenco delle ultime proposte della Commissione e degli ultimi eventi su tutti i fascicoli, per un monitoraggio periodico.

## State signature

Nessuno. I due feed sono senza sessione e ordinati dal più recente.

## Best path

```bash
opencli law-tracker proposals --limit 20 -f json
opencli law-tracker events --limit 20 -f csv
opencli law-tracker events --limit 20 --offset 20    # pagina successiva
```

Entrambi restituiscono `reference`, `initiationDate`, `title` e un `url` citabile; `events` aggiunge la colonna `event` con il tipo di evento ("Vote in EP plenary", "Debate in EP plenary", …).

## Fallback path

```yaml
on_adapter_fail:
  - adapter_health_update: opencli law-tracker proposals -> suspect
  - goto /homepage?lang=en
  - action:dismiss_cookie_banner in pages/homepage.md
  - i due feed sono nei riquadri espandibili della homepage (bottoni "expand"); leggere di lì è più lento e meno strutturato
```

## Avoid

- Chiedere `--limit` molto alto sperando in tutto lo storico: sono feed di novità, non un archivio. Per lo storico si passa da `workflows/find-procedures.md` con l'ordinamento per data.

## State validation

Le date in `initiationDate` sono decrescenti e la prima è recente. Se il feed torna vuoto, l'adapter solleva EMPTY invece di restituire una lista vuota.

## Stale markers

Se `startingPosition`/`size` smettono di essere obbligatori, o se compaiono campi nuovi nel feed, riverificare.
