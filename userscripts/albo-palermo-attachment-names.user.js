// ==UserScript==
// @name         Albo Pretorio Palermo - attachment names
// @namespace    https://github.com/aborruso/opencli
// @version      0.1.1
// @description  Shows the real file name of each attachment on the act pages of the Albo Pretorio of the Comune di Palermo, instead of "(Acrobat Kb ...)"
// @match        https://albopretorio.comune.palermo.it/albopretorio/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

// The page links each attachment as `viewDocument?col=ALLEGATI&idx=N`, with
// only its type and size. The file name is in the `content-disposition`
// header of that URL, and the portal answers HEAD with the headers alone.
// The request runs from the page, so it carries the session cookies the
// index depends on. One request at a time: the portal answers bursts with
// HTTP 429, and that blocks the whole site for this address for a while.
(async () => {
    const links = [...document.querySelectorAll('a[href*="viewDocument?col=ALLEGATI"]')];
    // The attachments sit in a box fixed at 250px, sized for "(Acrobat Kb ...)":
    // long names would wrap at every hyphen.
    const box = links[0]?.closest('.container-field');
    if (box) box.style.width = 'auto';
    for (const a of links) {
        let resp;
        try {
            resp = await fetch(a.href, { method: 'HEAD', credentials: 'same-origin' });
        } catch {
            continue;
        }
        if (resp.status === 429) break;
        if (!resp.ok || (resp.headers.get('content-type') ?? '').startsWith('text/html')) continue;
        const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(resp.headers.get('content-disposition') ?? '');
        if (!m) continue;
        const full = decodeURIComponent(m[1].trim());
        // The portal appends the act id and the upload date to every name:
        // `..._1800989618_20260917.pdf`. Same for all attachments of an act, so drop it.
        const name = full.replace(/_\d{6,}_\d{8}(\.[^.]+)$/, '$1');
        const label = document.createElement('span');
        label.textContent = ` ${name}`;
        label.title = full;
        label.style.fontWeight = 'bold';
        a.insertBefore(label, a.lastChild);
    }
})();
