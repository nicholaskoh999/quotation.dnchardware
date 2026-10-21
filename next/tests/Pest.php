<?php

pest()->extend(Tests\TestCase::class)->in('Feature');

require_once __DIR__.'/Support/Identity.php';

/* Wave 1 · Session D: every legacy read test runs against a throwaway SQLite
   file AND a throwaway local MySQL 8 schema (the production engine) — the
   MySQL leg is skipped, not failed, where no local server answers. */
dataset('legacy drivers', ['sqlite', 'mysql']);
