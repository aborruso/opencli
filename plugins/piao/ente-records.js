// What `ente` and `docs` share: the records of one exact IPA code.
import { ArgumentError, EmptyResultError } from '@jackwener/opencli/errors';
import { annoFilter, fetchPiao } from './shared.js';

export const ENTE_ARGS = [
    { name: 'ipa', type: 'string', positional: true, required: true, help: 'Exact IPA code, case-sensitive, from `opencli piao enti`. The server matches codes as substrings: rows of other codes are dropped here' },
    { name: 'anno', type: 'string', help: 'Local filter: 2026 keeps every triennium covering that year, 2026-2028 only that triennium' },
    { name: 'latest', type: 'boolean', default: false, help: 'Keep only the highest version of each triennium; by default every version is listed' },
];

export async function loadEnte(command, args) {
    const ipa = String(args.ipa ?? '').trim();
    if (!ipa) throw new ArgumentError('give an IPA code, from `opencli piao enti`');
    const inAnno = annoFilter(args.anno);
    const { records } = await fetchPiao({ ipa, keep: (r) => r.administrationIpaCode === ipa && inAnno(r) });
    if (records.length === 0) {
        throw new EmptyResultError(`piao ${command}`, `no PIAO for IPA code "${ipa}"${args.anno ? ` and --anno ${args.anno}` : ''}: codes are exact and case-sensitive, find them with \`opencli piao enti <name>\``);
    }
    return records;
}
