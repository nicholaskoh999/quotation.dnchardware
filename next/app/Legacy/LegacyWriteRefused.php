<?php

namespace App\Legacy;

use LogicException;

/** A statement other than one plain SELECT was offered to LegacyReader — a programming error. */
final class LegacyWriteRefused extends LogicException {}
