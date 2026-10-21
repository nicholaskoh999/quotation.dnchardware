import { AlertTriangle, CheckCircle2, Circle, Clock, Sparkles, XCircle, type LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

/* Semantic status = tone + icon + words, so state never relies on colour
   alone (handoff §3). Callers choose the status; the words are theirs. */
export type Status = 'success' | 'draft' | 'review' | 'error' | 'special' | 'neutral' | 'info';

const MAP: Record<Status, { tone: 'success' | 'warning' | 'danger' | 'special' | 'neutral' | 'accent'; icon: LucideIcon }> = {
    success: { tone: 'success', icon: CheckCircle2 },
    draft: { tone: 'warning', icon: Clock },
    review: { tone: 'warning', icon: AlertTriangle },
    error: { tone: 'danger', icon: XCircle },
    special: { tone: 'special', icon: Sparkles },
    neutral: { tone: 'neutral', icon: Circle },
    info: { tone: 'accent', icon: Circle },
};

export function StatusBadge({ status, children, className }: { status: Status; children: React.ReactNode; className?: string }) {
    const { tone, icon: Icon } = MAP[status];
    return (
        <Badge tone={tone} className={className} data-status={status}>
            <Icon aria-hidden="true" />
            {children}
        </Badge>
    );
}
