"""Build the inline Heroicons sprite used by index.php and companies.php.

Source: the official `heroicons` npm package (Tailwind Labs, MIT), v2.2.0,
  https://registry.npmjs.org/heroicons/-/heroicons-2.2.0.tgz
  sha1 f1f554155152b4ec4d1b7165363d7c583690f77d
Usage:  python tests/tools/build-heroicons-sprite.py <path-to-extracted>/package
Prints the <svg> sprite block; it is pasted between the HEROICONS-SPRITE
markers in both pages. Only the icons listed here are included.
"""
import io, os, re, sys
OUTLINE = """x-mark arrow-left document-plus document-text building-office-2 building-office tag adjustments-horizontal
book-open clipboard-document-check clipboard-document-list sparkles information-circle arrow-right-start-on-rectangle
bars-3 bookmark wrench-screwdriver user-circle ellipsis-horizontal check-circle exclamation-triangle x-circle check
chat-bubble-left-right photo magnifying-glass trash document-duplicate light-bulb folder-open inbox pencil-square
cube eye calendar-days plus phone clock calculator arrows-right-left puzzle-piece printer chevron-down chevron-right""".split()
SOLID = "document-text bookmark wrench-screwdriver user-circle".split()
pkg = sys.argv[1]
def inner(path):
    s = io.open(path, encoding='utf-8').read()
    body = re.search(r'<svg[^>]*>(.*)</svg>', s, re.S).group(1)
    return re.sub(r'\s+', ' ', body).strip()
out = ['<!-- HEROICONS-SPRITE v2.2.0 (https://heroicons.com) - MIT License, Copyright (c) Tailwind Labs, Inc.',
       '     Full text: assets/icons/heroicons/LICENSE. Built by tests/tools/build-heroicons-sprite.py; do not edit by hand. -->',
       '<svg id="dcHeroSprite" xmlns="http://www.w3.org/2000/svg" style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true" focusable="false">']
for n in OUTLINE:
    out.append(f'<symbol id="hi-{n}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">{inner(os.path.join(pkg,"24","outline",n+".svg"))}</symbol>')
for n in SOLID:
    out.append(f'<symbol id="his-{n}" viewBox="0 0 24 24" fill="currentColor">{inner(os.path.join(pkg,"24","solid",n+".svg"))}</symbol>')
out.append('</svg>')
out.append('<!-- /HEROICONS-SPRITE -->')
sys.stdout.write('\n'.join(out) + '\n')
