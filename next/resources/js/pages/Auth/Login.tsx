import { Head, useForm, usePage } from '@inertiajs/react';
import { AlertCircle, CheckCircle2, FileText, LogIn } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { SharedProps } from '@/types';

/* Sign in with your OWN account (app_users). No remember-me, no shared admin
   login, no password reset — accounts are managed by an operator. A failed
   attempt always shows a visible message (handoff §3: nothing silent). */
export default function Login() {
    const { flash, appName } = usePage<SharedProps>().props;
    const form = useForm({ username: '', password: '' });
    const [showPassword, setShowPassword] = useState(false);

    const submit = (e: FormEvent) => {
        e.preventDefault();
        form.post('/login', { preserveScroll: true, onFinish: () => form.reset('password') });
    };

    const error = form.errors.username ?? form.errors.password ?? flash.error ?? null;
    const signedOut = !error && flash.success ? flash.success : null;

    return (
        <div className="flex min-h-dvh items-center justify-center px-4 py-8">
            <Head title="Sign in" />
            <div className="w-full max-w-sm">
                <div className="mb-5 flex items-center justify-center gap-2.5">
                    <span className="flex size-10 items-center justify-center rounded-[var(--radius-lg)] bg-accent text-accent-foreground shadow-xs">
                        <FileText className="size-5" aria-hidden="true" />
                    </span>
                    <div className="leading-tight">
                        <p className="font-semibold">{appName || 'DNC Quotation'}</p>
                        <p className="text-xs text-muted-foreground">Quotation System</p>
                    </div>
                </div>

                <Card>
                    <CardHeader>
                        <h1 className="text-lg font-semibold leading-tight">Sign in</h1>
                        <CardDescription>Sign in with your own account to continue.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {error ? (
                            <div
                                role="alert"
                                className="mb-4 flex items-start gap-2 rounded-[var(--radius-md)] border border-danger/30 bg-danger-soft px-3 py-2.5 text-sm font-medium text-danger"
                            >
                                <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                                <span>{error}</span>
                            </div>
                        ) : null}
                        {signedOut ? (
                            <div
                                role="status"
                                className="mb-4 flex items-start gap-2 rounded-[var(--radius-md)] border border-accent/20 bg-accent-soft px-3 py-2.5 text-sm font-medium text-accent"
                            >
                                <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                                <span>{signedOut}</span>
                            </div>
                        ) : null}

                        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="username">Username</Label>
                                <Input
                                    id="username"
                                    name="username"
                                    autoComplete="username"
                                    autoCapitalize="none"
                                    autoCorrect="off"
                                    spellCheck={false}
                                    autoFocus
                                    value={form.data.username}
                                    onChange={(e) => form.setData('username', e.target.value)}
                                    aria-invalid={error ? true : undefined}
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="password">Password</Label>
                                <Input
                                    id="password"
                                    name="password"
                                    type={showPassword ? 'text' : 'password'}
                                    autoComplete="current-password"
                                    value={form.data.password}
                                    onChange={(e) => form.setData('password', e.target.value)}
                                    aria-invalid={error ? true : undefined}
                                />
                            </div>
                            <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm select-none">
                                <input
                                    type="checkbox"
                                    className="size-4 accent-[var(--color-accent)]"
                                    checked={showPassword}
                                    onChange={(e) => setShowPassword(e.target.checked)}
                                />
                                Show password
                            </label>
                            <Button type="submit" variant="primary" size="lg" className="w-full" loading={form.processing}>
                                {!form.processing && <LogIn aria-hidden="true" />}
                                Sign in
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
