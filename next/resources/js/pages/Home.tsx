import { Head } from '@inertiajs/react';
import { CheckCircle2, Construction } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import FoundationLayout from '@/layouts/foundation-layout';

export default function Home() {
    return (
        <FoundationLayout>
            <Head title="Home" />
            <Card>
                <CardHeader>
                    <CardTitle>QUOTATION NEXT — foundation</CardTitle>
                    <CardDescription>Laravel · React · TypeScript · Inertia · Vite · Tailwind</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                    <Badge tone="success">
                        <CheckCircle2 aria-hidden="true" /> Application responding
                    </Badge>
                    <Badge tone="warning">
                        <Construction aria-hidden="true" /> Quotation features arrive in Wave 1+
                    </Badge>
                </CardContent>
            </Card>
        </FoundationLayout>
    );
}
