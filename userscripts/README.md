# userscripts

Small scripts for a browser's userscript manager. They change how a page looks in your own browser, nothing else.

## albo-palermo-attachment-names

On the act pages of the [Albo Pretorio of the Comune di Palermo](https://albopretorio.comune.palermo.it/albopretorio/jsp/home.jsp?modo=info&info=servizi.jsp), and of the [deliberations and ordinances archive](https://servizionline.comune.palermo.it/portcitt/jsp/home.jsp?modo=info&info=servizi.jsp&SERCOD=60&SERCODROOT=60) of the online services portal (the same SISPI application, acts past their publication included), each attachment is shown only as "(Acrobat Kb 134,03)". The script adds the real file name in front of it, `Parere_Contabile_DC_PROP_614_2026.pdf (Acrobat Kb 134,03)`. The full name, with the id and date the portal appends, is in the tooltip. The name is whatever the office uploaded: on some acts it is only the id and the date, e.g. `1792335239_2026_08_18_3.pdf`.

The name is not in the page. It is in the `content-disposition` header of each attachment, so the script sends one HEAD request per attachment, from the page and on its session, one at a time. The portal answers bursts with HTTP 429 and then blocks the whole site for your address for a while; if that happens the script stops.

### Install

1. Install a userscript manager: [Violentmonkey](https://violentmonkey.github.io/) or Tampermonkey, for Firefox or Chrome.
2. Open [albo-palermo-attachment-names.user.js](https://raw.githubusercontent.com/aborruso/opencli/main/userscripts/albo-palermo-attachment-names.user.js). The manager recognises the `.user.js` and offers to install it.
3. Chrome only: in the extension details of the manager, turn on "Allow User Scripts".

Then open an act, e.g. [Delibera di Consiglio 548](https://albopretorio.comune.palermo.it/albopretorio/pu/push-tabella-delibere.do?nomeTabella=FO_SCEDELIBEREAP&TD=2022&ALBCOD=62716360706B70756474&sportello=albopretorio): the names appear one after another within a few seconds.

To download the attachments rather than read their names, use `opencli albo-palermo attachments <permanent link>`.
