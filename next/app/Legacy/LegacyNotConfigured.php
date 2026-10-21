<?php

namespace App\Legacy;

use RuntimeException;

/** No legacy database is configured (LEGACY_DB_DATABASE empty) — an honest state, not an error. */
final class LegacyNotConfigured extends RuntimeException {}
