#!/usr/bin/env python3
"""
Splits a multi-hairstyle ChatGPT response into one SVG per hairstyle.

    npm run split-hair          (splits, then runs scripts/fit_hair.py)
    python scripts/split_batch.py [batch file] [--out folder]

Paste ChatGPT's whole answer into assets/raw_batch.txt (the default batch file). Each hairstyle is a
filename header followed by its SVG, in any of the forms ChatGPT tends to use:

    ### buzz_cut_lineup.svg          **buzz_cut_lineup.svg**          1. `buzz_cut_lineup.svg`
    buzz_cut_lineup.svg              Filename: buzz_cut_lineup.svg

with the <svg ...>...</svg> after it, inside a ``` fence or not; any text in between is ignored. Each one
is saved as assets/hair_raw/<name>.svg (lowercase, underscores). A hairstyle is skipped, with a warning,
when its SVG has no closing </svg> (a reply cut off part-way) or is not well-formed XML. An SVG with no
header before it is saved under its data-style/data-name attribute, or as batch_<n>.svg.

Running it again on the same batch is safe: unchanged files are left alone. The batch file is not
cleared. It exits with status 1 if the batch had hairstyles but none could be saved, so
`npm run split-hair` does not go on to fit.
"""
import os, re, sys
import xml.etree.ElementTree as ET

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BATCH = os.path.join(ROOT, 'assets', 'raw_batch.txt')
RAW = os.path.join(ROOT, 'assets', 'hair_raw')
LAYERS = ['hair_back', 'hair_base', 'hair_bangs', 'hair_lines']

# A line that is only a file name, with the markdown ChatGPT dresses it in: headings, bullets, numbering,
# bold, backticks, quotes, "File:"/"Filename:" and a trailing colon.
HEADER = re.compile(r'^[ \t>#*\-+\d.)]*(?:file\s*name|filename|file)?\s*[:\-]?\s*[`*_"\']*'
                    r'([A-Za-z0-9][\w\- .]*?\.svg)[`*_"\']*\s*:?\s*$', re.I | re.M)
SVG_OPEN = re.compile(r'<svg\b', re.I)
SVG_CLOSE = re.compile(r'</svg\s*>', re.I)


def clean_name(name):
    """'Buzz Cut - Lineup.svg' -> 'buzz_cut_lineup.svg'. Never a path."""
    stem = re.sub(r'\.svg$', '', os.path.basename(name.strip()), flags=re.I)
    stem = re.sub(r'[^a-z0-9]+', '_', stem.lower()).strip('_')
    return f'{stem}.svg' if stem else None


def split(text):
    """-> (hairstyles [(file name or None, svg text or None, problem or None)], headers with no SVG)."""
    headers = [(m.start(), m.group(1)) for m in HEADER.finditer(text)]
    opens = [m.start() for m in SVG_OPEN.finditer(text)]
    found, used, last_end = [], set(), 0
    for i, start in enumerate(opens):
        # The name: the last header between the end of the previous SVG and the start of this one.
        named = [(pos, name) for pos, name in headers if last_end <= pos < start]
        name = named[-1][1] if named else None
        used.update(pos for pos, _ in named)
        # The SVG ends at its own </svg>, which must come before the next <svg (or the end of the text).
        limit = opens[i + 1] if i + 1 < len(opens) else len(text)
        close = SVG_CLOSE.search(text, start, limit)
        if not close:
            found.append((name, None, 'no closing </svg>: the reply was probably cut off here'))
            last_end = limit
            continue
        svg = text[start:close.end()]
        last_end = close.end()
        try:
            ET.fromstring(svg)
        except ET.ParseError as err:
            found.append((name, None, f'not well-formed SVG ({err})'))
            continue
        found.append((name, svg, None))
    orphans = [name for pos, name in headers if pos not in used and pos >= last_end]
    return found, orphans


def fallback_name(svg, n):
    m = re.search(r'<svg\b[^>]*\sdata-(?:style|name)="([^"]+)"', svg)
    return clean_name(m.group(1)) if m else f'batch_{n}.svg'


def main(argv):
    out = RAW
    if '--out' in argv:
        k = argv.index('--out')
        out = os.path.abspath(argv[k + 1])
        argv = argv[:k] + argv[k + 2:]
    batch = os.path.abspath(argv[0]) if argv else BATCH
    if not os.path.exists(batch):
        sys.exit(f'no batch file at {os.path.relpath(batch, ROOT)}: paste ChatGPT\'s reply into assets/raw_batch.txt')
    text = open(batch, encoding='utf-8').read()
    found, orphans = split(text)
    if not found and not orphans:
        print(f'{os.path.relpath(batch, ROOT)} has no hairstyles in it: nothing to split.')
        return 0
    os.makedirs(out, exist_ok=True)
    saved, skipped, taken = [], [], set()
    for n, (name, svg, problem) in enumerate(found, 1):
        label = name or f'hairstyle {n} (no file name)'
        if problem:
            skipped.append(f'{label}: {problem}')
            continue
        file = (clean_name(name) if name else None) or fallback_name(svg, n)
        if file in taken:  # the same name twice in one batch: keep both
            stem, k = file[:-4], 2
            while f'{stem}_{k}.svg' in taken:
                k += 1
            file = f'{stem}_{k}.svg'
        taken.add(file)
        path = os.path.join(out, file)
        body = svg.strip() + '\n'
        state = 'new'
        if os.path.exists(path):
            state = 'unchanged' if open(path, encoding='utf-8').read() == body else 'replaced'
        if state != 'unchanged':
            with open(path, 'w', encoding='utf-8') as f:
                f.write(body)
        missing = [l for l in LAYERS if f'id="{l}"' not in svg]
        notes = [] if name else ['no file name in the batch']
        if missing:
            notes.append(f'no {", ".join(missing)} group')
        if 'viewBox="0 0 512 512"' not in svg:
            notes.append('viewBox is not 0 0 512 512')
        saved.append((file, state, notes))
    for name in orphans:
        skipped.append(f'{name}: a file name with no SVG after it (cut off before it started?)')

    where = os.path.relpath(out, ROOT)
    print(f'Split {os.path.relpath(batch, ROOT)}: {len(saved)} saved to {where}/, {len(skipped)} skipped.')
    for file, state, notes in saved:
        print(f'  {state:<9} {file}' + (f'   (check: {"; ".join(notes)})' if notes else ''))
    for s in skipped:
        print(f'  WARNING   skipped {s}')
    return 1 if not saved else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
