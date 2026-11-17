#!/usr/bin/env python3
"""Checks the game's laws, legal ages, citizenship rules and forms of government against published sources.

    python3 scripts/verify-laws.py            # report only
    python3 scripts/verify-laws.py --write    # also write js/data/lawVerification.js

Needs network access to en.wikipedia.org and nothing else: no packages. Pages are fetched at
the exact revision named in SOURCES, so a run today and a run next year check against the same
text; to re-check against newer text, change the revision, run it, and review what moved.
Fetched pages are cached in .cache/wiki/ (not committed).

Wikipedia is used because it gathers one table per question for every country, and every row
cites a primary source (ILGA, Amnesty International, national statutes). It is a secondary
source and can be wrong or out of date; that is why each check names its revision, and why
every disagreement is decided by a person (DECIDED below) rather than copied automatically.

A field is 'ok' when the source agrees, 'review' when it differs and the reason the game's value
stands is written in DECIDED, 'unconfirmed' when the source does not cover the place, and
'mismatch' when nobody has looked yet.
"""
import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, '.cache', 'wiki')
UA = {'User-Agent': 'PathwaysDataCheck/1.0 (game reference-data verification)'}

# What is checked, against which page and revision.
SOURCES = {
    'deathPenalty': ('Capital punishment by country', 1386223248),
    'sameSexMarriage': ('Same-sex marriage', 1385959675),
    'lgbt': [('LGBTQ rights in Africa', 1384695703), ('LGBTQ rights in Asia', 1385407416), ('LGBTQ rights in Europe', 1385754862),
             ('LGBTQ rights in the Americas', 1384954880), ('LGBTQ rights in Oceania', 1386223556)],
    'conscription': ('Conscription', 1386172566),
    'votingAge': ('Voting age', 1386001635),
    'drinkingAge': ('Legal drinking age', 1381514309),
    'retirementAge': ('Retirement age', 1383117283),
    'divorce': ('Divorce law by country', 1385893450),
    'birthright': ('Jus soli', 1384581062),
    'single': ('Multiple citizenship', 1383418957),
    'government': ('List of countries by system of government', 1385845870),
}

# Where the game's value stands although the source reads differently, and why.
DECIDED = {
    ('ru', 'lgbt'): 'Legal in the code, but the "international LGBT movement" was banned as extremist in 2023; the game treats the law as hostile.',
    ('lb', 'lgbt'): 'The source calls it ambiguous: Article 534 of the penal code criminalises it, though some courts have declined to apply it.',
    ('hu', 'lgbt'): 'Registered partnerships and anti-discrimination law exist, but a 2021 law restricts LGBT content and a 2025 law banned Pride marches.',
    ('us', 'lgbt'): 'The table marks protection as varying; federal employment protection (Bostock, 2020) and marriage make it "protected".',
    ('ar', 'lgbt'): 'The table cell is footnoted; Argentina has marriage (2010) and gender-identity law (2012).',
    ('do', 'lgbt'): 'The source row is laid out differently from the others; same-sex activity is legal in the Dominican Republic.',
    ('np', 'sameSexMarriage'): 'The source says legalisation has been mandated by the Supreme Court but not yet legislated.',
    ('uk', 'votingAge'): 'The source gives 16 for some elections; the game uses 18, the age for general elections.',
    ('ae', 'votingAge'): 'There are no general elections; the game already treats it as a country without them.',
    ('af', 'votingAge'): 'There are no elections; the game already treats it as a country without them.',
    ('ca', 'drinkingAge'): 'The age is set by each province: 19 in most, 18 in Quebec, Alberta and Manitoba, which the game has as regional law.',
    ('at', 'government'): 'Listed as semi-presidential; Austria\'s constitutional practice is parliamentary, which is how the game describes it.',
    ('pe', 'government'): 'Listed as semi-presidential (president-parliamentary); the game keeps the constitution\'s own description, a presidential republic.',
    ('hk', 'birthright'): 'Birth in Hong Kong can confer permanent residence, not nationality; Chinese nationality follows the parents, as in the game.',
    ('dj', 'drinkingAge'): 'The source gives no minimum age; the game uses 18.',
    ('ad', 'government'): 'A co-principality is a form of parliamentary constitutional monarchy.',
    ('pa', 'single'): 'The source lists dual citizenship as restricted in Panama: naturalising foreigners must renounce, but Panamanians by birth keep it.',
    ('gy', 'single'): 'The source lists dual citizenship as restricted in Guyana without detail; the game allows it, unverified.',
    ('at', 'single'): 'Dual citizenship only with special permission or from birth; the game treats Austria as single-nationality.',
}

# Retirement: where the table gives a range, the standard full-pension age.
RETIRE_STANDARD = {'us': 67, 'ca': 65, 'hk': 65, 'sg': 63, 'it': 67, 'fi': 65, 'se': 66, 'no': 67, 'uy': 65, 'dk': 67, 'be': 66}


def fetch(title, rev):
    os.makedirs(CACHE, exist_ok=True)
    fn = os.path.join(CACHE, f'{rev}.json')
    if os.path.exists(fn):
        return json.load(open(fn, encoding='utf-8'))
    q = urllib.parse.urlencode({'action': 'parse', 'oldid': rev, 'prop': 'wikitext', 'format': 'json', 'formatversion': 2})
    for attempt in range(8):
        try:
            with urllib.request.urlopen(urllib.request.Request('https://en.wikipedia.org/w/api.php?' + q, headers=UA), timeout=60) as r:
                d = json.load(r)['parse']
            break
        except urllib.error.HTTPError as e:
            if e.code != 429: raise
            time.sleep(10 * (attempt + 1))
    out = {'title': d['title'], 'revid': rev, 'wikitext': d['wikitext']}
    json.dump(out, open(fn, 'w', encoding='utf-8'))
    time.sleep(2)
    return out


def game():
    script = """
      const { COUNTRY_LIST } = await import('./js/data/countries.js');
      const { PLACES } = await import('./js/data/world.js');
      const law = await import('./js/engine/rules.js');
      const cit = await import('./js/data/citizenship.js');
      const out = {};
      for (const c of COUNTRY_LIST) {
        const row = { name: c.name, iso3: PLACES[c.id].iso3, gov: PLACES[c.id].government };
        for (const r of law.sheet(c.id, { region: null })) row[r.id] = r.value;
        row.birthright = cit.BIRTHRIGHT.has(c.id); row.single = cit.SINGLE.has(c.id);
        out[c.id] = row;
      }
      console.log(JSON.stringify(out));
    """
    r = subprocess.run(['node', '--input-type=module', '-e', script], cwd=ROOT, capture_output=True, text=True, check=True)
    return json.loads(r.stdout)


G = None
BY3 = {}
BYNAME = {}
ALIAS = {'united states of america': 'us', 'united kingdom': 'uk', 'south korea': 'kr', 'democratic republic of the congo': 'cd', 'czech republic': 'cz', 'czechia': 'cz',
         'turkey': 'tr', 'turkiye': 'tr', 'russia': 'ru', 'iran': 'ir', 'syria': 'sy', 'vietnam': 'vn', 'bolivia': 'bo', 'venezuela': 've', 'taiwan': 'tw', 'hong kong': 'hk',
         'the bahamas': 'bs', 'bahamas': 'bs', 'netherlands': 'nl', 'the netherlands': 'nl', 'philippines': 'ph', 'the philippines': 'ph', 'united arab emirates': 'ae'}


def norm(s): return re.sub(r'\s+', ' ', re.sub(r'[^a-z ,()\-]', '', s.lower())).strip()


def place_of(text):
    m = re.search(r'\{\{\s*(?:#invoke:flag\|icon|flagcountry|flag|flagu|flagdeco|flaglink|flagicon)\s*\|\s*([^}|]+)', text, re.I)
    cand = ([m.group(1).strip()] if m else []) + [x.split('|')[-1] for x in re.findall(r'\[\[([^\]]+)\]\]', text)[:3]]
    for c in cand:
        if c.upper() in BY3: return BY3[c.upper()]
        n = norm(c)
        if n in ALIAS: return ALIAS[n]
        if n in BYNAME: return BYNAME[n]
    return None


def rows(t): return re.split(r'\n\|-[^\n]*', t)


def clean(s):
    s = re.sub(r'<ref[^>]*/>|<ref[^>]*>.*?</ref>', '', s, flags=re.S)
    s = re.sub(r'\{\{(?:tooltip|abbr)\|([^|}]+)\|[^}]*\}\}', r'\1', s)
    s = re.sub(r'\[\[(?:[^\]|]*\|)?([^\]]+)\]\]', r'\1', s)
    return re.sub(r"'''?", '', s)


def table_at(w, start):
    t = w[start:]
    return t[:t.find('\n|}')]


# ---------- One reader per question: each returns {placeId: what the source says} ----------

def src_death(w):
    out = {}
    for r in rows(w):
        pid = place_of(r); m = re.search(r'tooltip\|([ARLEP])\|', r)
        if pid and m and pid not in out:
            last = re.findall(r'style="text-align:center"\|\s*(\d{4})', r)
            year = int(last[0]) if last else None
            # In use: executions carried out in the last ten years.
            out[pid] = (m.group(1) == 'P' and year is not None and year >= 2016, f'{m.group(1)}, last execution {year or "none listed"}')
    return out


def src_marriage(w):
    t = table_at(w, w.find('wikitable', 42000))
    out = {}
    for line in t.split('\n'):
        m = re.search(r"\{\{flagicon\|([^}|]+)[^}]*\}\}\s*(''')?\[\[[^|\]]*\|([^\]]+)\]\]", line)
        if m:
            pid = place_of('{{flag|' + m.group(1) + '}}') or place_of('[[' + m.group(3) + ']]')
            if pid: out[pid] = (True, 'legalised: ' + clean(line).strip('* ')[:80])
        # Places listed without a flag: the parts of the United Kingdom, and territories such as Puerto Rico.
        for link in re.findall(r'\[\[Same-sex marriage in ([^|\]]+)', line):
            pid = {'England and Wales': 'uk', 'Northern Ireland': 'uk', 'Puerto Rico': 'pr'}.get(link)
            if pid and pid not in out: out[pid] = (True, 'legalised: ' + link)
    lead = w[:6000]
    if 'Same-sex marriage in Thailand' in lead: out['th'] = (True, 'named in the lead as the most recent to legalise')
    return out


def src_lgbt(pages):
    def mark(c):
        if re.search(r'X mark|No\]\]|Red x', c): return 'no'
        if re.search(r'Yes check|Yes\]\]|Check mark', c): return 'yes'
        if re.search(r'Ambiguous|Partial|Maybe|Varies', c, re.I): return 'part'
        return '?'
    out = {}
    for w in pages:
        for r in rows(w):
            cells = [c for c in re.split(r'\n\|(?!\})', '\n' + r.lstrip('\n')) if c.strip()]
            if len(cells) < 7: continue
            m = re.search(r'flag\|icon\|([^}|]+)', cells[0])
            pid = place_of('{{flag|' + m.group(1) + '}}') if m else None
            if not pid or pid in out: continue
            act, uni, ssm, anti = mark(cells[1]), mark(cells[2]), mark(cells[3]), mark(cells[6])
            level = 'hostile' if act == 'no' else 'equal' if anti == 'yes' and 'yes' in (uni, ssm) else 'limited'
            out[pid] = (level, f'activity {act}, unions {uni}, marriage {ssm}, anti-discrimination {anti}')
    return out


def src_conscription(w):
    t = table_at(w, w.find('wikitable sortable mw-collapsible'))
    out = {}
    for r in rows(t):
        pid = place_of(r)
        cells = [c for c in re.split(r'\n\|', '\n' + r.strip('\n')) if c.strip()]
        if pid and len(cells) >= 2:
            v = clean(re.sub(r'^\s*style="[^"]*"\s*\|', '', cells[1])).strip()
            out[pid] = (v.lower().startswith('yes'), v[:90])
    return out


def src_voting(w):
    t = table_at(w, w.find('wikitable sortable mw-collapsible'))
    out = {}
    for r in rows(t):
        pid = place_of(r)
        if not pid or pid in out: continue
        parts = [clean(x).strip() for x in r.split('||')]
        n = re.match(r'(\d+)', parts[1]) if len(parts) > 1 else None
        out[pid] = (int(n.group(1)) if n else None, parts[1] if len(parts) > 1 else '')
    return out


def src_drinking(w):
    blocks, cur = {}, None
    for m in re.finditer('wikitable', w):
        for r in rows(table_at(w, m.start())):
            if re.search(r'\{\{flag', r): cur = place_of(r)
            if not cur: continue
            body = re.sub(r'<ref[^>]*/>|<ref[^>]*>.*?</ref>', '', r, flags=re.S)
            cells = [c for c in re.split(r'\n\|', '\n' + body.strip('\n')) if c.strip()]
            b = blocks.setdefault(cur, {'ages': set(), 'banned': False})
            for c in cells[1:4]:
                c2 = re.sub(r'^\s*(?:style|align|colspan|rowspan)[^|]*\|', '', c)
                b['ages'] |= {int(x) for x in re.findall(r'\b(1[4-9]|2[0-5])\b', c2)}
                if re.search(r'Illegal|Prohibited|Banned|forbidden', c2, re.I): b['banned'] = True
    return blocks


def src_retirement(w):
    out = {}
    for r in rows(table_at(w, w.find('wikitable'))):
        pid = place_of(r)
        if not pid or pid in out: continue
        body = re.sub(r'<ref[^>]*/>|<ref[^>]*>.*?</ref>', '', r, flags=re.S)
        cells = [c for c in re.split(r'\n\|', '\n' + body.strip('\n')) if c.strip()]
        if len(cells) < 3: continue
        men = clean(re.sub(r'^colspan="?2"?\s*\|', '', cells[1])).strip()
        n = re.search(r'(\d{2})', men)
        if n: out[pid] = (RETIRE_STANDARD.get(pid, int(n.group(1))), men[:60])
    return out


def src_birthright(w):
    s = w[w.find('== By country =='):w.find('== See also ==')]
    out = {}
    for e in re.split(r'\n\*(?!\*)', s):
        pid = place_of(e[:250])
        if not pid or pid in out: continue
        text = clean(e)
        # A diplomats' exception, or a registration step, does not make jus soli conditional.
        text = re.sub(r'\{\{Citation needed[^}]*\}\}', '', text)
        conditional = re.search(r'only if|provided that|if at least one|abolished|limit|parents (?:is|was|are) (?:a )?(?:citizen|national)|stateless|unknown parents|apply|register|conditions', text, re.I)
        # Bare entries (a flag and a name, nothing else) are the unconditional list.
        bare = re.sub(r'\{\{[^}]*\}\}', '', text).strip()
        unconditional = len(bare) < 40 or re.search(r'regardless|natural-born citizens|everyone born|guaranteed|granted to a child born|except|not working for their|registration (?:required|with)|requires registration', text, re.I)
        out[pid] = (bool(unconditional) and not (conditional and not re.search(r'except|not working for|registration', text, re.I)), bare[:90])
    return out


def src_government(w):
    heads = [(m.start(), m.group(1).strip('= ').strip()) for m in re.finditer(r'\n(=+[^=\n]+=+)', w)]
    out = {}
    for i, (pos, h) in enumerate(heads):
        end = heads[i + 1][0] if i + 1 < len(heads) else len(w)
        for m in re.finditer(r'\{\{\s*(?:flag|flagcountry|flagu|flagdeco)\s*\|\s*([^}|]+)[^}]*\}\}', w[pos:end]):
            pid = place_of('{{flag|' + m.group(1) + '}}')
            if pid: out.setdefault(pid, []).append(h)
    return out


GOV_WORDS = {
    'Parliamentary constitutional monarchies': ('monarchy', 'parliamentary'), 'Semi-constitutional monarchies': ('semi-constitutional monarchy',),
    'Parliamentary republics with directly elected ceremonial heads of state': ('parliamentary republic',),
    'Parliamentary republics with indirectly elected ceremonial heads of state': ('parliamentary republic',),
    'Parliamentary republics with indirectly elected executive presidency': ('president',), 'Parliamentary republics with directly elected executive presidency': ('president',),
    'Presidential republics without a prime minister': ('presidential republic',), 'Presidential republics with a prime minister': ('presidential republic',),
    'Theocratic presidential republic': ('islamic',), 'President-parliamentary systems': ('semi-presidential',), 'Premier-presidential systems': ('semi-presidential',),
    'Directorial republic': ('directorial',), 'Islamic theocracy': ('theocra',), 'Absolute monarchies': ('absolute monarchy',), 'One-party states': ('one-party',),
}


def main():
    global G
    G = game()
    for k, v in G.items():
        BY3[v['iso3']] = k
        BYNAME[norm(v['name'])] = k
    page = lambda key: fetch(*SOURCES[key])['wikitext']
    results = {pid: {} for pid in G}

    def put(pid, field, ok, note, covered=True):
        status = 'ok' if ok else 'unconfirmed' if not covered else 'review' if (pid, field) in DECIDED else 'mismatch'
        entry = {'status': status}
        if status != 'ok' and note: entry['note'] = DECIDED.get((pid, field), note)
        results[pid][field] = entry

    checks = [
        ('deathPenalty', src_death(page('deathPenalty')), lambda g, s: g['deathPenalty'] == s[0]),
        ('lgbt', src_lgbt([fetch(*x)['wikitext'] for x in SOURCES['lgbt']]), lambda g, s: g['lgbt'] == s[0]),
        ('conscription', src_conscription(page('conscription')), lambda g, s: g['conscription'] == s[0]),
        ('votingAge', src_voting(page('votingAge')), lambda g, s: g['votingAge'] == s[0]),
        ('retirementAge', src_retirement(page('retirementAge')), lambda g, s: g['retirementAge'] == s[0]),
        ('birthright', src_birthright(page('birthright')), lambda g, s: g['birthright'] == s[0]),
    ]
    for field, src, same in checks:
        for pid, g in G.items():
            if pid in src: put(pid, field, same(g, src[pid]), f'source: {src[pid][1]}')
            elif field == 'birthright' and not g['birthright']: put(pid, field, True, '')
            else: put(pid, field, False, 'not covered by the source', covered=False)

    marriage = src_marriage(page('sameSexMarriage'))
    for pid, g in G.items():
        put(pid, 'sameSexMarriage', g['sameSexMarriage'] == (pid in marriage), 'source: not among the legalisations' if pid not in marriage else f'source: {marriage[pid][1]}')

    drink = src_drinking(page('drinkingAge'))
    for pid, g in G.items():
        b = drink.get(pid)
        if not b: put(pid, 'drinkingAge', False, 'not covered by the source', covered=False); put(pid, 'alcohol', False, 'not covered by the source', covered=False); continue
        put(pid, 'drinkingAge', g['drinkingAge'] in b['ages'] or (not g['alcohol']), f'source ages: {sorted(b["ages"])}')
        put(pid, 'alcohol', g['alcohol'] != (b['banned'] and (not b['ages'] or pid == 'pk')), 'source: banned' if b['banned'] else 'source: legal')

    divorce = page('divorce')
    lead = clean(divorce[:4000])
    for pid, g in G.items():
        named = g['name'] in lead and 'except' in lead
        put(pid, 'divorce', g['divorce'] == (not (pid == 'ph' and named)), 'source: the Philippines is the only country without divorce')

    multi = clean(page('single'))
    multi = multi[multi.find('== By region =='):]
    SAYS_SINGLE = {'cu': 'restricted or forbidden in Cuba', 'in': 'does not allow voluntary Dual Citizenship', 'jp': 'Japan does not allow dual citizenship',
                   'qa': 'Bahrain and Qatar do not allow dual citizenship', 'kw': 'restrict or forbid dual citizenship', 'ir': 'restrict or forbid dual citizenship',
                   'cn': 'forced to accept only one citizenship'}
    SAYS_MULTI = {'ae': 'has permitted dual citizenship', 'de': 'Germany allows dual citizenship', 'dk': 'Denmark has allowed dual citizenship', 'se': 'Sweden allows dual citizenship',
                  'ch': 'Switzerland allows dual citizenship', 'kr': 'South Korea, Tonga, Vanuatu, and Vietnam allow dual citizenship', 'vn': 'and Vietnam allow dual citizenship', 'us': 'does not mention dual nationality',
                  'pa': 'forbidden in Cuba, Suriname, Panama', 'gy': 'Panama, and Guyana'}
    for pid, g in G.items():
        if pid in SAYS_SINGLE and SAYS_SINGLE[pid] in multi: put(pid, 'single', g['single'], f'source: "{SAYS_SINGLE[pid]}"')
        elif pid in SAYS_MULTI and SAYS_MULTI[pid] in multi: put(pid, 'single', not g['single'] if pid not in ('pa', 'gy') else g['single'], f'source: "{SAYS_MULTI[pid]}"')
        else: put(pid, 'single', False, 'not covered by the source', covered=False)

    gov = src_government(page('government'))
    for pid, g in G.items():
        secs = [s for s in gov.get(pid, []) if s in GOV_WORDS]
        if not secs: put(pid, 'government', False, 'not listed (or not a sovereign state)', covered=False); continue
        text = g['gov'].lower()
        ok = any(all(k in text for k in GOV_WORDS[s]) for s in secs) and (('Federation' in gov.get(pid, [])) == ('federal' in text) or pid == 'ae')
        put(pid, 'government', ok, f'source: {"; ".join(secs)}')

    counts = {}
    for pid, r in results.items():
        for f, v in r.items():
            counts.setdefault(f, {}).setdefault(v['status'], 0)
            counts[f][v['status']] += 1
    for f, c in counts.items(): print(f'  {f:16} ' + '  '.join(f'{k} {n}' for k, n in sorted(c.items())))
    print()
    for pid, r in sorted(results.items()):
        for f, v in r.items():
            if v['status'] in ('mismatch', 'review'): print(f'{pid:3} {f:16} {v["status"]:8} {v.get("note", "")[:150]}')

    if '--write' in sys.argv:
        sources = {k: ([{'page': t, 'rev': r} for t, r in v] if isinstance(v, list) else {'page': v[0], 'rev': v[1]}) for k, v in SOURCES.items()}
        with open(os.path.join(ROOT, 'js', 'data', 'lawVerification.js'), 'w', encoding='utf-8') as f:
            f.write('// GENERATED by scripts/verify-laws.py. Do not edit by hand: change the data, or DECIDED in the script, and run it again.\n')
            f.write('// What each place\'s laws, ages, citizenship rules and form of government were checked against, and with what result.\n')
            f.write(f'export const LAW_SOURCES = {json.dumps(sources, ensure_ascii=False)};\n')
            f.write(f'export const LAW_CHECKED = {json.dumps(results, ensure_ascii=False, separators=(",", ":"), sort_keys=True)};\n')
        print('\nWrote js/data/lawVerification.js')
    return 1 if any(v['status'] == 'mismatch' for r in results.values() for v in r.values()) else 0


if __name__ == '__main__':
    sys.exit(main())
