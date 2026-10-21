/* Throwaway local-MySQL schema for e2e (never a real database): Session D's
   legacy fixture + Session C's app_users test accounts, seeded together. */
export const E2E_LEGACY_DB = process.env.E2E_LEGACY_DB || 'dnc_next_e2e';

/* Test-only account created by support/seed-app-users.php. */
export const E2E_USER = { username: 'e2etester', password: 'e2e-only-password', displayName: 'E2E Tester' };
