import { execFileSync } from 'node:child_process';
import { E2E_LEGACY_DB } from './support/env';

export default function globalTeardown() {
    try {
        execFileSync('php', ['-r', `(new PDO('mysql:host=127.0.0.1;port=3306','root',''))->exec('DROP DATABASE IF EXISTS \`${E2E_LEGACY_DB}\`');`], { stdio: 'pipe' });
    } catch {
        /* nothing to clean */
    }
}
