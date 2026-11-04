# Third-party notices

## Heroicons v2.2.0 (R2.4)

- Source: the official `heroicons` package by Tailwind Labs —
  https://heroicons.com · https://github.com/tailwindlabs/heroicons ·
  https://registry.npmjs.org/heroicons/-/heroicons-2.2.0.tgz
  (sha1 `f1f554155152b4ec4d1b7165363d7c583690f77d`, verified against the registry).
- License: MIT, Copyright (c) Tailwind Labs, Inc. Full text: `assets/icons/HEROICONS-LICENSE.txt`.
- Use: only the icons listed in `tests/tools/build-heroicons-sprite.py` are embedded, as an
  inline `<svg>` sprite between the `HEROICONS-SPRITE` markers in `index.php` and
  `companies.php` (24px outline; solid for the current bottom-navigation item). No CDN,
  no runtime library. Regenerate with the script; do not edit the sprite by hand.
