// Timeline completa di una procedura: fasi, eventi, base giuridica, istituzioni.
import { cli, Strategy } from '@jackwener/opencli/registry';
import { EmptyResultError } from '@jackwener/opencli/errors';
import { apiGet, toApiRef, procedureUrl } from './shared.js';

cli({
    site: 'law-tracker',
    name: 'timeline',
    access: 'read',
    description: 'Eventi di una procedura legislativa, dal più vecchio al più recente',
    example: 'opencli law-tracker timeline 2021/0106(COD)',
    domain: 'law-tracker.europa.eu',
    strategy: Strategy.PUBLIC,
    browser: false,
    args: [
        { name: 'reference', type: 'string', positional: true, required: true, help: 'Reference, in forma 2021/0106(COD) o 2021_106' },
        { name: 'lang', type: 'string', default: 'en', help: 'Lingua dell\'interfaccia' },
    ],
    columns: ['date', 'stage', 'event', 'typeIdentifier', 'documents', 'reference', 'url'],
    func: async (args) => {
        const apiRef = toApiRef(args.reference);
        const lang = args.lang ?? 'en';
        const notice = await apiGet('/notice/timeline', { reference: apiRef, version: 'null' }, lang);
        const events = Array.isArray(notice?.events) ? notice.events : [];
        if (events.length === 0) {
            throw new EmptyResultError(`law-tracker timeline ${apiRef}`, 'Nessun evento nella notice');
        }
        const displayRef = notice?.noticeHeader?.reference ?? apiRef;
        const url = procedureUrl(apiRef, lang);
        return events.map((e) => ({
            date: e.date ?? null,
            stage: e.stage ?? null,
            event: e.type ?? null,
            typeIdentifier: e.typeIdentifier ?? null,
            documents: Array.isArray(e.documentLinks) ? e.documentLinks.length : 0,
            reference: displayRef,
            url,
        }));
    },
});
