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

/* ── Shell contracts consumed by Wave 1 Session A (see
   components/shell/NOTES.md). Every one is OPTIONAL: the shell renders an
   honest placeholder when a provider (Session C / D) has not shipped yet. */

/** Named, authenticated user (Session C shares it as `auth.user`). */
export interface ShellUser {
    id: number | string;
    username: string;
    displayName: string;
}

/** One row of Home's "Recent Quotations" (Session D provides the data). */
export interface RecentQuotation {
    id: number | string;
    refNo: string;
    customer: string;
    /** As the server formats it (display only). */
    date: string;
    /** Preformatted string is shown verbatim; a number is shown to 2 dp. */
    total: string | number | null;
}

export interface ShellSharedProps extends SharedProps {
    auth?: { user?: ShellUser | null } | null;
    workspace?: { url?: string | null } | null;
}
