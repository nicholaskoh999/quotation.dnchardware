/* Throwaway local-MySQL schema for e2e sign-in (never a real database). */
export const E2E_LEGACY_DB = process.env.E2E_LEGACY_DB || 'quo_next_e2e_auth';

/* Test-only account created by support/seed-app-users.php. */
export const E2E_USER = { username: 'e2etester', password: 'e2e-only-password', displayName: 'E2E Tester' };
