// From a permanent link of the Albo Pretorio to the same act in this archive.
// Both portals hold the same records with the same ALBCOD, so the act opens
// here once the link names the right section and table. The Albo's type (its
// TD) tells the section; an Ordinanza Dirigenziale can be in ODT or DDI, and
// an unknown type is tried on every section. Useful once the act has left the
// Albo, where its link stops working.
import { cli, Strategy } from '@jackwener/opencli/registry';
import { ArgumentError, EmptyResultError } from '@jackwener/opencli/errors';
import { Session, COLUMNS, SECTIONS, section, permalink, isDetail, parseDetail } from './shared.js';

// Albo TD → sections, checked on one act per type on 2026-09-24.
const BY_ALBO_TYPE = {
    2024: ['DGC'],
    2022: ['DCC'],
    1037940907: ['DCCIR'],
    1043492602: ['DCS'],
    1031149464: ['DCO'],
    2001: ['OS'],
    2011: ['OS'],
    2010: ['DDI'],
    2012: ['ODT', 'DDI'],
};

cli({
    site: 'palermo-delibere',
    name: 'from-albo',
    access: 'read',
    description: 'The same act in the permanent archive, from a permanent link of the Albo Pretorio of Palermo: deliberations, determinations and ordinances only',
    example: 'opencli palermo-delibere from-albo "https://albopretorio.comune.palermo.it/albopretorio/pu/push-tabella-delibere.do?nomeTabella=FO_SCEDELIBEREAP&TD=2024&ALBCOD=6271636279617070677D&sportello=albopretorio"',
    domain: 'servizionline.comune.palermo.it',
    strategy: Strategy.PUBLIC,
    browser: false,
    args: [
        { name: 'link', type: 'string', positional: true, required: true, help: 'A permanent link of the Albo Pretorio (albopretorio.comune.palermo.it), with TD and ALBCOD' },
    ],
    defaultFormat: 'json',
    columns: COLUMNS,
    func: async (args) => {
        let u;
        try {
            u = new URL(String(args.link ?? '').trim());
        } catch {
            throw new ArgumentError('give the permanent link of an act of the Albo Pretorio');
        }
        const td = u.searchParams.get('TD');
        const albcod = u.searchParams.get('ALBCOD');
        if (u.hostname !== 'albopretorio.comune.palermo.it' || !td || !albcod) {
            throw new ArgumentError('this is not a permanent link of the Albo Pretorio: it needs albopretorio.comune.palermo.it, TD and ALBCOD');
        }
        const candidates = (BY_ALBO_TYPE[td] ?? SECTIONS.map((s) => s.code)).map(section);
        for (const s of candidates) {
            const html = await new Session().get(permalink(s, albcod));
            if (isDetail(html)) return [parseDetail(html, s)];
        }
        throw new EmptyResultError('palermo-delibere from-albo', `the archive has no such act in ${candidates.map((s) => s.code).join(', ')}: notices, calls, banns and the other Albo types are not archived here`);
    },
});
