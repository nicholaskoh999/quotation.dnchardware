/* Shared contracts between Laravel (Inertia shared props) and React. Kept here,
   not inside components, so server and client agree on one shape. */

export interface ReleaseInfo {
    version: string;
    sha: string | null;
    shortSha: string | null;
    builtAt: string | null;
    environment: string;
}

export interface SharedProps {
    appName: string;
    release: ReleaseInfo;
    flash: { success?: string | null; error?: string | null };
    [key: string]: unknown;
}
