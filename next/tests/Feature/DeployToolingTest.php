<?php

/*
 * Preview deploy tooling (Owner Smoke Loop #1, §9): runs the POSIX shell test
 * suite for deploy/preview/quo-preview-lib.sh and the deploy scripts — remote
 * base resolved before scp, cPanel / AutoSSL `current/` stub handling, shared
 * ACME path, production deny, exact SHA, no migrations, no remote Node, no
 * rsync / process substitution. Needs a `sh` on PATH (Linux CI, Git Bash).
 */

function findSh(): ?string
{
    $probe = PHP_OS_FAMILY === 'Windows' ? 'where sh 2>NUL' : 'command -v sh 2>/dev/null';
    $out = trim((string) shell_exec($probe));

    return $out === '' ? null : strtok($out, "\r\n");
}

it('passes the preview deploy tooling shell tests', function () {
    $sh = findSh();
    if ($sh === null) {
        $this->markTestSkipped('no POSIX sh on PATH');
    }
    $script = base_path('tests/Deploy/quo-preview-lib.test.sh');
    exec(escapeshellarg($sh).' '.escapeshellarg($script).' 2>&1', $lines, $code);
    $out = implode("\n", $lines);

    expect($code)->toBe(0, $out)->and($out)->toContain('ALL PASS');
});

it('marks every preview deploy script PREVIEW ONLY and ships the helper library with the upload', function () {
    foreach (glob(base_path('deploy/preview/*.sh')) as $f) {
        expect(file_get_contents($f))->toContain('PREVIEW ONLY');
    }
    expect(file_get_contents(base_path('deploy/preview/quo-preview-deploy.sh')))->toContain('"$HERE/quo-preview-lib.sh" "$HERE/quo-preview.conf" "$PREVIEW_SSH:$DEST/"');
});
