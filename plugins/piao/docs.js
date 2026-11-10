// The files of one administration's PIAO plans: listed, or saved to disk.
import path from 'node:path';
import { cli, Strategy } from '@jackwener/opencli/registry';
import { CommandExecutionError, EmptyResultError } from '@jackwener/opencli/errors';
import { FILE_COLUMNS, fileRows, latestOnly, saveFile, targetPath } from './shared.js';
import { loadEnte, ENTE_ARGS } from './ente-records.js';

cli({
    site: 'piao',
    name: 'docs',
    access: 'read',
    description: 'Files of one administration\'s PIAO plans by exact IPA code, one row per file: kind is piao, act (the approving act) or attachment (no browser, no key). Lists URLs by default; --download saves them. status, bytes and path are filled only with --download',
    example: [
        'opencli piao docs c_g273 --anno 2026-2028',
        'opencli piao docs c_g273 --anno 2026-2028 --latest --download ./piao',
    ].join('\n'),
    domain: 'piao.dfp.gov.it',
    strategy: Strategy.PUBLIC,
    browser: false,
    args: [
        ...ENTE_ARGS,
        { name: 'download', type: 'string', help: 'Folder to save into, as <folder>/<ipa code>/<triennium>_v<version>/<kind>-<n>_<file name>. Files already there are skipped, so a failed run can be repeated. Exits with an error if any file fails, after trying them all' },
    ],
    columns: FILE_COLUMNS,
    func: async (args) => {
        const records = await loadEnte('docs', args);
        const rows = (args.latest ? latestOnly(records) : records).flatMap(fileRows);
        if (rows.length === 0) throw new EmptyResultError('piao docs', 'the matching records carry no files');
        if (!args.download) return rows.map(({ index, ...row }) => ({ ...row, status: null, bytes: null, path: null }));

        const dir = path.resolve(args.download);
        const out = [];
        const failed = [];
        for (const { index, ...row } of rows) {
            const file = targetPath(dir, { ...row, index });
            try {
                out.push({ ...row, ...(await saveFile(row.url, file)), path: file });
            } catch (e) {
                failed.push(`${row.file_name}: ${e.message}`);
            }
        }
        if (failed.length) {
            throw new CommandExecutionError(`${failed.length} of ${rows.length} files failed, ${out.length} saved in ${dir}. Run the command again to retry only the missing ones. ${failed.join('; ')}`);
        }
        return out;
    },
});
