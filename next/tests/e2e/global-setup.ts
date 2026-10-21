import { execFileSync } from 'node:child_process';
import { E2E_LEGACY_DB } from './support/env';

/* W1 integration: ONE throwaway local-MySQL schema serves the whole e2e run —
   Session D's legacy fixture (companies, quotations, revisions, …) plus
   Session C's test-only app_users accounts. Never a real database. Without a
   local MySQL, the signed-in and seeded specs skip; guest / redirect /
   validation specs still run, and the "no data source" states are covered by
   Pest (tests/Feature/Legacy/ReadPagesTest.php). */
export default function globalSetup() {
    try {
        execFileSync('php', ['tests/e2e/support/legacy-fixture.php', 'up', E2E_LEGACY_DB], { stdio: 'pipe' });
        execFileSync('php', ['tests/e2e/support/seed-app-users.php', E2E_LEGACY_DB, '--into-existing'], { stdio: 'pipe' });
        process.env.E2E_AUTH_DB = '1';
        process.env.E2E_LEGACY_SEEDED = '1';
    } catch {
        process.env.E2E_AUTH_DB = '0';
    }
}
