<?php

namespace App\Legacy;

use RuntimeException;

/**
 * A legacy database is configured but could not be read (unreachable, a table
 * missing, a driver error). The driver text stays in the log; callers only
 * ever learn that the read failed.
 */
final class LegacyUnavailable extends RuntimeException {}
