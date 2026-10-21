import '../css/app.css';
import { createInertiaApp } from '@inertiajs/react';
import { createRoot } from 'react-dom/client';
import type { ComponentType } from 'react';

/* One chunk per page (W1 integration): the shell + engine no longer ship as a
   single >500 kB bundle; Inertia awaits the page module. */
const pages = import.meta.glob<{ default: ComponentType }>('./pages/**/*.tsx');

createInertiaApp({
    title: (title) => (title ? `${title} · DNC Quotation` : 'DNC Quotation'),
    resolve: async (name) => {
        const load = pages[`./pages/${name}.tsx`];
        if (!load) throw new Error(`Unknown Inertia page: ${name}`);
        return load();
    },
    setup({ el, App, props }) {
        createRoot(el).render(<App {...props} />);
    },
    progress: { color: '#1d4ed8', delay: 200 },
});
