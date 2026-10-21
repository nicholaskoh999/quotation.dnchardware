import { execFileSync } from 'node:child_process';
import { E2E_LEGACY_DB } from './support/env';

/* Seeds the throwaway local-MySQL app_users schema the e2e server signs in
   against. Without a local MySQL the sign-in specs skip (E2E_AUTH_DB=0); the
   guest/redirect/validation specs still run. */
export default function globalSetup() {
    try {
        execFileSync('php', ['tests/e2e/support/seed-app-users.php', E2E_LEGACY_DB], { stdio: 'pipe' });
        process.env.E2E_AUTH_DB = '1';
    } catch {
        process.env.E2E_AUTH_DB = '0';
    }
}
