#!/usr/bin/env python3
"""
Softens the lines of the raw hairstyles in assets/hair_raw/ to the house style (see the rules in
assets/CHATGPT_HAIR_PROMPT.md): one bold outer silhouette, and soft, subtle separation inside it.

  - hair_back and hair_base keep the bold outline: stroke="#23140f" stroke-width="6" stroke-linejoin="round".
  - hair_bangs and hair_lines lose the heavy outline: the bold #23140f (or any other near-black) line in them
    becomes stroke="#4a2414", and every line width in them becomes 2.5, so where hair overlaps hair it is
    separated by a thin dark-brown line instead of a harsh black border. Lighter lines (the #b8693d highlights)
    keep their colour and take the same 2.5 width. Fills are never touched.

Strokes are read from attributes and from style="...", on the groups and on each shape, so a style written either
way is softened the same. Running it again changes nothing. Then fit the hairstyles to every head:

    python scripts/soften_hair_lines.py && npm run fit-hair

Standard library only.
"""
import os
import re
import sys
import xml.etree.ElementTree as ET

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, 'assets', 'hair_raw')
SVG = 'http://www.w3.org/2000/svg'
NS = f'{{{SVG}}}'

OUTLINE = '#23140f'   # the bold outer silhouette
LINE = '#4a2414'      # soft internal lines
OUTER = {'hair_back', 'hair_base'}
INNER = {'hair_bangs', 'hair_lines'}
LINE_WIDTH = '2.5'


def lum(hex6):
    r, g, b = (int(hex6[i:i + 2], 16) / 255 for i in (1, 3, 5))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def style_dict(el):
    out = {}
    for part in (el.get('style') or '').split(';'):
        if ':' in part:
            k, v = part.split(':', 1)
            out[k.strip()] = v.strip()
    return out


def get(el, prop):
    """A presentation property of this element, from style= (which wins) or the attribute."""
    return style_dict(el).get(prop, el.get(prop))


def set_prop(el, prop, value):
    """Sets a property where the element already keeps it: in style= if it is there, as an attribute otherwise."""
    st = style_dict(el)
    if prop in st:
        st[prop] = value
        el.set('style', ';'.join(f'{k}:{v}' for k, v in st.items()))
    else:
        el.set(prop, value)


def width_of(el, inherited):
    w = get(el, 'stroke-width')
    try:
        return float(w) if w is not None else inherited
    except ValueError:
        return inherited


def soften(group):
    """Softens every stroke inside an inner group (the group itself and all it holds). -> how many were changed."""
    changed = 0

    def walk(el, stroke, width_set):
        nonlocal changed
        own_stroke = get(el, 'stroke')
        stroke = own_stroke if own_stroke is not None else stroke
        # A heavy line is rewritten where it is set: on this element, or on the group it inherits it from.
        if own_stroke is not None and own_stroke.lower() not in ('none', 'transparent', LINE):
            colour = own_stroke.lower()
            dark = bool(re.fullmatch(r'#[0-9a-f]{6}', colour)) and lum(colour) < 0.12
            if colour == OUTLINE or dark:
                set_prop(el, 'stroke', LINE)
                changed += 1
        # Every line width set inside the hair becomes the soft width.
        if get(el, 'stroke-width') is not None:
            width_set = True
            if get(el, 'stroke-width') != LINE_WIDTH:
                set_prop(el, 'stroke-width', LINE_WIDTH)
                changed += 1
        elif own_stroke is not None and own_stroke.lower() not in ('none', 'transparent') and not width_set:
            set_prop(el, 'stroke-width', LINE_WIDTH)  # a line with no width anywhere would be drawn 1 wide
            changed += 1
            width_set = True
        for child in el:
            if isinstance(child.tag, str):
                walk(child, stroke, width_set)

    walk(group, None, False)
    return changed


def check_outer(group, name, path):
    """The outer groups keep their bold outline; say so if a shape in one has none."""
    def walk(el, stroke):
        stroke = get(el, 'stroke') if get(el, 'stroke') is not None else stroke
        tag = el.tag.replace(NS, '')
        if tag in ('path', 'ellipse', 'circle', 'polygon', 'rect') and (stroke or '').lower() != OUTLINE:
            print(f'  note: a shape in {name} of {os.path.basename(path)} has no {OUTLINE} outline (left as it is)')
        for child in el:
            if isinstance(child.tag, str):
                walk(child, stroke)
    walk(group, None)


def soften_file(path):
    ET.register_namespace('', SVG)
    parser = ET.XMLParser(target=ET.TreeBuilder(insert_comments=True))
    tree = ET.parse(path, parser)
    root = tree.getroot()
    changed = 0
    for g in root.iter(f'{NS}g'):
        gid = g.get('id')
        if gid in INNER:
            changed += soften(g)
        elif gid in OUTER:
            check_outer(g, gid, path)
    if changed:
        text = ET.tostring(root, encoding='unicode').replace(' />', '/>')
        with open(path, 'w', encoding='utf-8') as f:
            f.write(text + '\n')
    return changed


def main(argv):
    files = sorted(os.path.join(RAW, f) for f in os.listdir(RAW) if f.endswith('.svg'))
    if not files:
        print('no hairstyles in assets/hair_raw/')
        return
    for path in files:
        n = soften_file(path)
        print(f'{os.path.basename(path)}: ' + (f'softened {n} stroke setting(s)' if n else 'already soft'))


if __name__ == '__main__':
    main(sys.argv[1:])
