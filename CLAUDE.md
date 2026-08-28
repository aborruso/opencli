# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Cos'è questo repo

**Non contiene codice**: è un bundle di note personali e documentazione mirrorata su [OpenCLI](https://github.com/jackwener/OpenCLI) (tool esterno che trasforma siti web in comandi da terminale). Non ci sono build, lint o test. Struttura modellata sui bundle `ai-specs/specs/<slug>` (stile OKF): mirror verbatim upstream + provenienza + note a mano.

## Regola critica: file mirrorati vs file a mano

`docs/meta.yml` è la **fonte di verità della provenienza**. Ogni `.md` elencato nel suo blocco `files:` è una **copia verbatim** dell'upstream e **non va MAI editato a mano** (README.md, SKILL-*.md, guide-*.md). I due file editabili a mano sono:

- `docs/notes.md` — le note pratiche personali (il refresh del mirror non lo tocca). È il punto di partenza e il contenuto originale del repo.
- `LOG.md` — log di progetto (voci datate `YYYY-MM-DD`, più recente in alto).

`meta.yml` stesso non va editato a mano se non nella parte generata (sha256/bytes vengono rigenerati dal refresh).

Sono a mano - non mirrorati - anche `sitemaps/` (le sitemap OpenCLI di questo repo), `bin/` (script di sync) e `tasks/`.

## Aggiornare il mirror (refresh)

Per aggiornare i `.md` verbatim: riscaricare dagli `url` in `docs/meta.yml`, poi rigenerare `sha256` e `bytes` per ogni file. Aggiornare anche `cli_version_al_fetch` e `ultimo_fetch`. **Non** toccare `notes.md`.

## Contesto d'uso di OpenCLI (per aiutare sulle note)

Distinzione chiave che struttura le note — OpenCLI ha due "transport":

- **Adapter PUBLIC**: passano dal daemon locale (porta 19825, auto-start), leggono API pubbliche, **non serve Chrome** (es. `opencli hackernews top`).
- **Comandi/adapter browser**: richiedono l'**estensione Chrome "Browser Bridge"** nel proprio Chrome loggato (es. `opencli browser <sess> open …`, `opencli twitter …`).

Trappola già documentata in `notes.md`: `OPENCLI_CDP_ENDPOINT` copre solo gli adapter desktop/Electron; i comandi `opencli browser` lo ignorano e pretendono l'estensione. Su WSL2 l'estensione va caricata nel Chrome **di WSL** (non Windows) e Chrome va lanciato da una shell utente persistente (altrimenti exit 144). Vedi `docs/notes.md` per il setup completo WSL2 + X410.
