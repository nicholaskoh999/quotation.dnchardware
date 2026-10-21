import '../css/app.css';
import { createInertiaApp } from '@inertiajs/react';
import { createRoot } from 'react-dom/client';
import type { ComponentType } from 'react';

const pages = import.meta.glob<{ default: ComponentType }>('./pages/**/*.tsx', { eager: true });

createInertiaApp({
    title: (title) => (title ? `${title} · DNC Quotation` : 'DNC Quotation'),
    resolve: (name) => {
        const page = pages[`./pages/${name}.tsx`];
        if (!page) throw new Error(`Unknown Inertia page: ${name}`);
        return page;
    },
    setup({ el, App, props }) {
        createRoot(el).render(<App {...props} />);
    },
    progress: { color: '#1d4ed8', delay: 200 },
});
