# Note — OpenCLI (uso personale)

_(annotazioni a mano; il refresh del mirror non tocca questo file)_

## Cos'è, in una riga

`opencli` trasforma **siti web in comandi da terminale**: invece di navigare col browser, scrivi `opencli hackernews top` e ottieni dati strutturati. Pensato sia per umani sia per agenti AI.

- Pacchetto: `@jackwener/opencli` (npm globale). Richiede **Node ≥ 20**.
- Installazione: `npm install -g @jackwener/opencli`
- Verifica: `opencli --version`, elenco comandi: `opencli list`

## L'architettura in 3 pezzi

1. **CLI** (`opencli`) — il comando che digiti; da solo non naviga.
2. **Daemon** — processo in sottofondo su WSL (porta `19825`, auto-start); l'"ufficio smistamento".
3. **Browser + estensione** — un Chrome *vero* con l'estensione "Browser Bridge", collegata al daemon, che sa pilotare le pagine.

Non tutti i comandi usano tutti e 3. Da qui i tre casi.

## Il modello mentale: TRE casi

**Prima domanda — serve un browser?**
- **No** → adapter **PUBLIC**: il daemon chiama le API pubbliche del sito. Nessun Chrome. (es. HackerNews)
- **Sì** → adapter **browser**: serve Chrome+estensione, perché il sito si legge solo aprendo davvero la pagina. (es. Reddit, Twitter)

**Seconda domanda (solo se serve il browser) — lo devo *vedere*?** Dipende dal login, non dal fatto che sia "headless".

| Caso | Esempio | Browser? | Come | Finestra visibile? |
|---|---|---|---|---|
| **A** | `hackernews top` | ❌ daemon → API | niente | — |
| **B** | `reddit hot` (no login) | ✅ | **Xvfb** (schermo virtuale) → `opencli-bridge` | No, invisibile |
| **C** | `twitter` (login) | ✅ | **X410** (schermo vero) → `opencli-bridge-login`, poi torni a B | Sì, la 1ª volta per loggarti |

⚠️ **"Invisibile" ≠ "headless".** L'estensione usa `chrome.debugger`, che in Chrome `--headless` **non si aggancia** (`attach_failed`): Reddit in headless NON funziona, e **non c'entra il login**. La soluzione è **Xvfb** = Chrome *normale* (non headless) su uno **schermo finto** che nessuno vede → l'estensione funziona e non vedi finestre. Il login conta solo perché, per digitare le credenziali, devi *vedere* la pagina (schermo vero, X410) — ma una volta sola: poi il profilo la ricorda e torni invisibile.

⚠️ **CDP non è una scorciatoia.** `OPENCLI_CDP_ENDPOINT` copre solo gli adapter desktop/Electron; i comandi `opencli browser` lo **ignorano** e pretendono l'estensione.

## Ciao mondo (PUBLIC, niente browser)

```bash
opencli hackernews top --limit 5
opencli hackernews top --limit 3 -f json | jq -r '.[] | "\(.score)\t\(.title)"'
opencli hackernews top --limit 3 -f csv
```

Formati output (`-f` / `--format`): `table` (default), `json`, `yaml`, `md`, `csv`.
Regola: `table` per leggere, `json`/`csv` per pipeline e per darlo in pasto a strumenti/LLM.

## Setup Browser Bridge su WSL2 (la parte non ovvia)

L'estensione **non è nel pacchetto npm** → va scaricata dalle Release GitHub e caricata come *unpacked* in un **Chrome dentro WSL** (non Windows: `localhost:19825` deve essere il daemon di WSL). E Chrome va lanciato **da una shell utente persistente**, non da dentro un tool sandboxed. Default: invisibile via **Xvfb**; **X410** solo per il login (caso C).

### Una tantum: scaricare e scompattare l'estensione

```bash
mkdir -p ~/.opencli
# asset della release taggata come la CLI (verifica la versione su github.com/jackwener/OpenCLI/releases)
curl -sfL -o /tmp/opencli-ext.zip \
  "https://github.com/jackwener/OpenCLI/releases/download/v1.8.6/opencli-extension-v1.0.22.zip"
rm -rf ~/.opencli/extension && unzip -oq /tmp/opencli-ext.zip -d ~/.opencli/extension
ls ~/.opencli/extension/manifest.json   # deve esistere
```

### Due modi di lanciare il ponte (secondo il caso d'uso)

⚠️ **`--headless` non funziona**: l'estensione si connette al daemon ma non riesce a pilotare le tab (`chrome.debugger` → `attach_failed`). Confermato da 3 fonti: test diretto, CI del repo (`.github/workflows/e2e-headed.yml`, `docs/advanced/remote-chrome.md` usano `xvfb-run`), e DeepWiki. Serve **un display** (reale o virtuale).

Ho aggiunto al `~/.zshrc` (backup: `~/.zshrc.bak-2026-07-04`) tre funzioni:

| Comando | Modo | Quando | X410? |
|---|---|---|---|
| `opencli-bridge` | Chrome **invisibile** via **Xvfb** | siti **senza login** (o già loggati) | ❌ no |
| `opencli-bridge-login` | Chrome **visibile** via **X410** | fare il **login** a un sito la 1ª volta | ✅ sì |
| `opencli-bridge-stop` | chiude il ponte | a fine lavoro | — |

**Caso 1 — senza login (default, invisibile):** niente finestra, niente X410. Xvfb è il modo ufficiale usato anche dalla CI di OpenCLI.

```bash
opencli-bridge                 # avvia Chrome invisibile in Xvfb, attende la connessione
opencli reddit hot --limit 5   # funziona, nessuna finestra
```

**Caso 2 — con login (visibile una tantum):** serve X410 attivo su Windows per *vedere* la finestra e digitare le credenziali. Dopo il login il profilo `~/.opencli/chrome-profile` lo ricorda → le volte successive basta `opencli-bridge` (invisibile).

```bash
opencli-bridge-login           # apre Chrome via X410 → fai login a mano nel sito
opencli twitter timeline       # ora l'adapter usa la tua sessione loggata
```

I comandi equivalenti "a mano" (se non usi le funzioni):

```bash
# invisibile (Xvfb)
xvfb-run -a google-chrome --user-data-dir="$HOME/.opencli/chrome-profile" \
  --load-extension="$HOME/.opencli/extension" --disable-extensions-except="$HOME/.opencli/extension" \
  --no-first-run --no-default-browser-check --disable-gpu about:blank &

# visibile (X410): calcola DISPLAY, poi google-chrome SENZA xvfb-run (vedi funzione opencli-bridge-login)
```

### Verifica e primo comando browser

```bash
opencli doctor                                   # atteso: [OK] Extension: connected
opencli browser hello open https://news.ycombinator.com
opencli browser hello state                      # url, titolo, elementi interattivi numerati [1],[2]…
opencli browser hello extract                    # pagina in markdown pulito (ottimo per LLM)
```

Da qui: `click <N>`, `type`, `fill`, `select`, `keys`, `wait`, `screenshot`, `network`, `tab …`.
Il `<session>` (`hello` qui) è un nome libero: stesso nome = stessa tab/stato tra chiamate.

## Trappole viste sul campo

- **`--headless` non pilota le tab**: l'estensione si connette ma `chrome.debugger` dà `attach_failed`. Usare Xvfb (display virtuale) → `opencli-bridge`.
- **`OPENCLI_CDP_ENDPOINT` non guida i comandi `opencli browser`** → serve l'estensione. Non perdere tempo con la strada CDP per i primitivi browser.
- **Chrome su Windows non va bene**: la sua `localhost` non è quella di WSL dove gira il daemon. Caricare l'estensione nel **Chrome di WSL**.
- **Un solo Chrome per profilo**: `opencli-bridge` e `opencli-bridge-login` usano lo stesso `--user-data-dir` → non avviarli insieme (lock). `opencli-bridge-stop` prima di cambiare modo.
- **`OPENCLI_WINDOW=background` / `--window background`**: mette la finestra in secondo piano anche con un display presente (utile con X410, ridondante con Xvfb).
- Chiudendo il ponte, `doctor` torna a `Extension: not connected` — normale. Gli adapter PUBLIC continuano a funzionare.

## Estendere (quando serve)

- Wrappare una CLI locale: `opencli external register <name>` → poi `opencli <name> …`.
- Nuovo adapter per un sito: skill `opencli-adapter-author` + `opencli browser analyze <url>` → `opencli browser <sess> init …` → scrivi adapter → `verify`. Vedi `SKILL-opencli-adapter-author.md` e `guide-extending-opencli.md`.
- Exit code stile `sysexits.h` (`0` ok, `66` vuoto, `69` bridge down, `75` timeout, `77` auth, `78` config): vedi `guide-exit-codes.md`.

## Rinfrescare il mirror

I `.md` in questa cartella sono copie verbatim upstream (provenienza + `sha256` in `meta.yml`). Per aggiornarli: riscaricare dagli `url` in `meta.yml` e rigenerare `sha256`/`bytes`. Questo `notes.md` NON va toccato dal refresh.
