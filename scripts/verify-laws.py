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
import html
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
    'marriageAge': ('Marriageable age', 1382980745),
    'drivingAge': ('List of minimum driving ages', 1383563696),
    'gamblingAge': ('Gambling age', 1385344433),
    'naturalization': ('Naturalization', 1384638556),
    'eu': ('Member state of the European Union', 1386331027),
    'tasman': ('Trans-Tasman Travel Arrangement', 1386322832),
    'healthCare': ('Universal health care', 1385246824),
    'taxTop': ('List of countries by tax rates', 1385796804),
    'schoolLeavingAge': ('School-leaving age', 1380468003),
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

# Decided while checking the second round: marriage, driving and gambling ages, naturalization.
DECIDED.update({
    ('au', 'drivingAge'): 'The table lists Victoria (18) first; most states license at 17, which the game uses.',
    ('es', 'drivingAge'): 'The ages the table lists first are for mopeds and motorcycles; a car license is at 18.',
    ('iq', 'drivingAge'): 'The table lists motorcycles first; cars are 18.',
    ('jm', 'drivingAge'): 'A learner can drive at 16 or 17 under supervision; the game uses 18, the age of a full license.',
    ('jp', 'drivingAge'): 'The table lists small motorcycles first; ordinary cars are 18.',
    ('np', 'drivingAge'): 'The table lists two-wheelers first; four-wheelers are 18.',
    ('vn', 'drivingAge'): 'The table lists small motorcycles first; cars are 18.',
    ('uk', 'marriageAge'): 'The table gives 16 for Scotland and Northern Ireland; the game never lets anyone marry before 18.',
    ('ir', 'marriageAge'): 'The law allows women to marry at 15; the game never lets anyone marry before 18.',
    ('pk', 'marriageAge'): 'The law allows women to marry at 16 in some provinces; the game never lets anyone marry before 18.',
    ('ca', 'drivingAge'): 'Set by each province, 16 in most, which the game uses.',
    ('il', 'drivingAge'): 'The table cell lists motorcycles and supervised driving first; a car license is at 17, which the game uses.',
    ('nz', 'drivingAge'): 'The age is 16 and a half; the game counts whole years.',
    ('au', 'schoolLeavingAge'): 'The table gives 15 or 17; school or training is compulsory to 17 in most states, which the game uses.',
    ('cr', 'schoolLeavingAge'): 'The table gives 17 or 18; the game uses 17.',
    ('pl', 'schoolLeavingAge'): 'Compulsory education lasts to 18 (the table gives a range); the game uses 18.',
    ('tr', 'schoolLeavingAge'): 'The table gives 14 to 16, uncertain; the game uses 16.',
    ('sg', 'naturalization'): 'There is no fixed residence period; the game uses the ten years given in Singapore\'s nationality-law article.',
    ('pt', 'gamblingAge'): 'Some casinos admit from 25 and others from 18; the game uses 18.',
    ('br', 'gambling'): 'Casinos are illegal, but lotteries and (since 2023) fixed-odds betting are legal; the game counts that as legal.',
    ('eg', 'gambling'): 'Casinos are open to foreigners only; for citizens the game treats gambling as banned.',
    ('ws', 'gambling'): 'Casinos are open to foreigners only; for citizens the game treats gambling as banned.',
    ('in', 'gambling'): 'Gambling is illegal under national law except in a few states (Goa, Sikkim) and state lotteries; the game treats it as banned.',
    ('ph', 'spouseWait'): 'The note lists several reductions; for the husband of a Filipina it is five years, which the game uses.',
    ('us', 'taxTop'): 'The table gives New York City\'s combined 51.8%; the game uses the federal 37%, since state income tax varies from none to about 13%.',
    ('bo', 'taxTop'): "The table's 25% is not the personal income tax; Bolivia taxes wages through the RC-IVA at a flat 13%, which the game uses.",
    ('ee', 'taxTop'): "The table's 23.6% is an effective figure for 2024; Estonia's flat income tax is 22% from 2025, which the game uses.",
    ('ro', 'taxTop'): "The table's 45% adds social and health contributions; Romania's income tax is a flat 10%, which the game uses.",
    ('br', 'inheritance'): 'PwC gives the 8% ceiling on the state tax; the game uses the São Paulo rate of 4%.',
    ('cl', 'inheritance'): 'PwC gives the scale\'s top of 25%; heirs outside the family pay 40% more, which the game includes (35%).',
    ('es', 'inheritance'): 'PwC gives the state scale\'s top of 34%; the game multiplies it by 1.7 for heirs outside the family, as the law does.',
    ('jp', 'inheritance'): 'PwC gives 55%; heirs who are not family pay a fifth more, which the game includes (66%).',
    ('tn', 'inheritance'): 'PwC gives the 2.5% between ancestors and descendants; its summary gives up to 35% for others, which the game uses.',
    ('ua', 'inheritance'): 'PwC gives the income tax scale up to 18% for non-residents; the game models residents: close family 0%, others 5%.',
    ('my', 'naturalization'): "The table gives 12 years; Malaysia's nationality-law article gives 10 years' residence, which the game uses.",
})

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
      const { HEALTH_MODEL_OF } = await import('./js/data/systems.js');
      const inh = await import('./js/engine/inheritance.js');
      const out = {};
      for (const c of COUNTRY_LIST) {
        const row = { name: c.name, iso3: PLACES[c.id].iso3, gov: PLACES[c.id].government };
        for (const r of law.sheet(c.id, { region: null })) row[r.id] = r.value;
        row.taxTop = (await import('./js/engine/systems.js')).taxBreakdown((await import('./js/engine/systems.js')).typicalWage(c) * 200, c).marginal;
        row.inherit = { kind: inh.lawOf(c.id).kind, top: Math.max(inh.topRate(c, 'child'), inh.topRate(c, 'other')) };
        row.health = HEALTH_MODEL_OF[c.id] ?? (c.freeHealthcare ? 'public' : 'pocket');
        row.birthright = cit.BIRTHRIGHT.has(c.id); row.single = cit.SINGLE.has(c.id); row.years = cit.RESIDENCE_YEARS[c.id] ?? cit.DEFAULT_YEARS;
        row.spouseYears = Math.min(row.years, cit.SPOUSE_YEARS_IN?.[c.id] ?? Math.max(cit.SPOUSE_YEARS, Math.ceil(row.years / 2)));
        row.marriageAgeWomen = law.rule('marriageAgeWomen', c.id, { region: null });
        out[c.id] = row;
      }
      const { FREE_MOVEMENT } = await import('./js/data/immigration.js');
      console.log(JSON.stringify({ out, free: FREE_MOVEMENT }));
    """
    r = subprocess.run(['node', '--input-type=module', '-e', script], cwd=ROOT, capture_output=True, text=True, check=True)
    d = json.loads(r.stdout)
    FREE_EUROPE[:] = next(a['members'] for a in d['free'] if a['id'] == 'europe')
    TASMAN[:] = next(a['members'] for a in d['free'] if a['id'] == 'tasman')
    return d['out']


G = None
PWC = {}
FREE_EUROPE = []
TASMAN = []
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


def cells_of(r):
    """The cells of a table row as plain text; a cell spanning n columns is repeated n times."""
    body = re.sub(r'<ref[^>]*/>|<ref[^>]*>.*?</ref>', '', r, flags=re.S).replace('\n!', '\n|')
    out = []
    for c in re.split(r'\|\||\n\|', '\n' + body.strip('\n')):
        if not c.strip(): continue
        span = re.match(r'\s*colspan="?(\d)"?', c)
        c2 = re.sub(r'^\s*(?:(?:style|align|colspan|rowspan|data-sort-value|class)\s*=\s*"?[^|"]*"?\s*;?"?\s*)+\|', '', c)
        c2 = re.sub(r'\{\{(?:center|nowrap|small)\|([^{}]*)\}\}', r'\1', c2)
        out.extend([clean(c2).strip()] * (int(span.group(1)) if span else 1))
    return out


def car_license_age(cell):
    parts = re.split(r'<br\s*/?>|,|;|\n|\s(?=\d{2}\s)', cell.replace('&nbsp;', ' '))
    cars = [p for p in parts if re.search(r'\bcars?\b|ordinary|four-wheel|non-professional', p, re.I)]
    for p in cars + parts:
        if re.search(r'moped|motorcycle|scooter|two-wheel|tractor|quad|bus|truck|heavy|professional (?:licen|driv)|supervis|teacher|learner|permit|attendant', p, re.I) and p not in cars: continue
        m = re.search(r'\b(1[4-9]|2[0-1])\b', p)
        if m: return int(m.group(1))
    return None


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


PWC_CHART = 'https://taxsummaries.pwc.com/quick-charts/inheritance-and-gift-tax-rates'
PWC_NAMES = {'korea, republic of': 'kr', "china, people's republic of": 'cn', 'bahamas, the': 'bs', 'congo, democratic republic of the': 'cd',
             'hong kong sar': 'hk', 'slovak republic': 'sk', 'czech republic': 'cz', 'puerto rico': 'pr', 'united states': 'us'}


def pwc_inheritance():
    """PwC's chart of headline inheritance tax rates: {place: (cell text, last reviewed)}. Cached in .cache/pwc/."""
    d = os.path.join(ROOT, '.cache', 'pwc'); os.makedirs(d, exist_ok=True)
    fn = os.path.join(d, 'inheritance-and-gift-tax-rates.html')
    if not os.path.exists(fn):
        with urllib.request.urlopen(urllib.request.Request(PWC_CHART, headers=UA), timeout=60) as r: open(fn, 'wb').write(r.read())
    h = open(fn, encoding='utf-8').read()
    t = h[h.find('<table'):]
    out = {}
    for r in re.findall(r'<tr.*?</tr>', t[:t.find('</table>')], re.S):
        c = [' '.join(html.unescape(re.sub(r'<[^>]+>', ' ', x)).split()) for x in re.findall(r'<t[dh][^>]*>(.*?)</t[dh]>', r, re.S)]
        m = re.match(r'(.*?)\s*\(Last reviewed ([^)]*)\)', c[0]) if c else None
        if not m: continue
        n = m.group(1).strip().lower()
        pid = PWC_NAMES.get(n) or BYNAME.get(norm(n)) or ALIAS.get(norm(n))
        if pid: out[pid] = (c[1], m.group(2))
    return out


def pwc_reading(cell):
    """('none', None), ('rate', top rate), or ('text', None) when the cell gives no figure."""
    low = cell.lower()
    if cell.strip() in ('NA',) or 'however' not in low and re.search(r'^na at federal level|no inheritance tax|does not have an inheritance|not expressly|exempt from income tax|generally tax exempt|is not taxable', low):
        return 'none', None
    if cell.strip() == 'NP': return 'np', None
    nums = [float(x) for x in re.findall(r'(?<![\d.])(\d+(?:\.\d+)?)\s*%?(?!\s*(?:million|years?|\d))', re.sub(r'(IQD|JMD|GBP|USD|EUR)\s*[\d,.]+(\s*million)?', '', cell))]
    nums = [x for x in nums if 0 < x <= 80]
    return ('rate', max(nums) / 100) if nums else ('text', None)


def main():
    global G
    G = game()
    for k, v in G.items():
        BY3[v['iso3']] = k
        BYNAME[norm(v['name'])] = k
    page = lambda key: fetch(*SOURCES[key])['wikitext']
    global PWC
    PWC = pwc_inheritance()
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

    # Marriage, driving and gambling ages; residence before naturalization; single nationality from the same table.
    def first_rows(key):
        seen = {}
        w = page(key)
        for m in re.finditer('wikitable', w):
            for r in rows(table_at(w, m.start())):
                pid = place_of(r)
                if pid and pid not in seen: seen[pid] = cells_of(r)
        return seen
    def first_int(x):
        m = re.search(r'\b(\d{1,2})\b', x or ''); return int(m.group(1)) if m else None

    marriage = first_rows('marriageAge')
    for pid, g in G.items():
        c = marriage.get(pid)
        men = first_int(c[1]) if c and len(c) > 1 else None
        women = first_int(c[2]) if c and len(c) > 2 else None
        if men is None: put(pid, 'marriageAge', False, 'not covered by the source', covered=False); continue
        game_women = g.get('marriageAgeWomen') if g.get('marriageAgeWomen') is not None else g['marriageAge']
        put(pid, 'marriageAge', g['marriageAge'] == men and (women is None or game_women == women), f'source: men {c[1][:40]}, women {c[2][:40] if len(c) > 2 else "?"}')

    driving = first_rows('drivingAge')
    for pid, g in G.items():
        c = driving.get(pid)
        if not c or len(c) < 2: put(pid, 'drivingAge', False, 'not covered by the source', covered=False); continue
        # The youngest age to hold a car license (conditions allowed), skipping mopeds, motorcycles and supervised learners.
        best = car_license_age(c[1])
        put(pid, 'drivingAge', best == g['drivingAge'], f'source: {c[1][:90]}')

    gambling = first_rows('gamblingAge')
    for pid, g in G.items():
        c = gambling.get(pid)
        if not c or len(c) < 2:
            put(pid, 'gambling', False, 'not covered by the source', covered=False); put(pid, 'gamblingAge', False, 'not covered by the source', covered=False); continue
        illegal = bool(re.match(r'\s*Illegal', c[1]))
        put(pid, 'gambling', g['gambling'] == (not illegal), f'source: {c[1][:90]}')
        v = None if illegal else first_int(c[1])
        if not g['gambling']: put(pid, 'gamblingAge', True, '')
        elif v is None: put(pid, 'gamblingAge', False, 'no age given', covered=False)
        else: put(pid, 'gamblingAge', g['gamblingAge'] == v, f'source: {c[1][:90]}')

    nat = first_rows('naturalization')
    for pid, g in G.items():
        c = nat.get(pid)
        if not c or len(c) < 4: put(pid, 'naturalization', False, 'not covered by the source', covered=False); continue
        years = first_int(c[1])
        put(pid, 'naturalization', (years is not None and years == g['years']) or (g['years'] >= 90 and years is None), f'source: {c[1][:60]}')
        # A spouse's shorter wait, where the note states one.
        sm = re.search(r'(?:spouse|married|marriage)[^.]{0,80}?\b(\d+|one|two|three|four|five)\s+years?|\b(\d+|one|two|three|four|five)\s+years?[^.]{0,60}(?:spouse|married|marriage)|waived for spouses', c[2], re.I)
        if sm:
            word = (sm.group(1) or sm.group(2) or '0').lower()
            n = {'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5}.get(word, None)
            n = int(word) if n is None else n
            put(pid, 'spouseWait', g['spouseYears'] == n, f'source: {c[2][:90]}')
        else:
            put(pid, 'spouseWait', False, 'the source gives no separate wait for spouses', covered=False)
        multi = True if '{{yes}}' in c[3] else False if '{{no}}' in c[3] else None
        if multi is not None and results[pid].get('single', {}).get('status') != 'ok':
            put(pid, 'single', g['single'] == (not multi), f'source: "Naturalization", multiple citizenship {c[3][:20]}')

    # School-leaving ages: this table names countries in plain text.
    w = page('schoolLeavingAge'); school = {}
    for m in re.finditer('wikitable', w):
        for r in rows(table_at(w, m.start())):
            c = cells_of(r)
            for i, x in enumerate(c[:3]):
                pid = BYNAME.get(norm(x)) or ALIAS.get(norm(x))
                if pid: school.setdefault(pid, c[i + 1] if i + 1 < len(c) else ''); break
    for pid, g in G.items():
        v = first_int(school.get(pid)) if pid in school else None
        if v is None: put(pid, 'schoolLeavingAge', False, 'not covered by the source', covered=False)
        else: put(pid, 'schoolLeavingAge', g['schoolLeavingAge'] == v, f'source: {school[pid][:40]}')

    # Health care: a country the source lists as having universal care must not leave the patient with the whole bill.
    # The list gives start dates for only some countries, so a country missing from it is not evidence of anything.
    w = page('healthCare'); t = table_at(w, w.find('wikitable')); universal = {}
    for r in rows(t):
        m = re.search(r'\{\{flagg\|[^}]*?\|([^|{}]+)\}\}', r)
        pid = place_of('{{flag|' + m.group(1) + '}}') if m else None
        if pid: universal[pid] = (re.findall(r'\n\|\s*(\d{4})', r) or ['?'])[0]
    for pid, g in G.items():
        if pid in universal: put(pid, 'healthCare', g['health'] not in ('pocket', 'private'), f'source: universal health care since {universal[pid]}; the game charges the whole bill')
        else: put(pid, 'healthCare', False, 'not in the source\'s list of start dates', covered=False)

    # The top rate of income tax, from the "Highest" column.
    taxes = first_rows('taxTop')
    for pid, g in G.items():
        c = taxes.get(pid)
        m = re.search(r'(\d+(?:\.\d+)?)\s*%', c[3]) if c and len(c) > 3 else None
        if not m: put(pid, 'taxTop', False, 'not covered by the source', covered=False); continue
        put(pid, 'taxTop', abs(g['taxTop'] - min(0.65, float(m.group(1)) / 100)) < 0.0051, f'source: {c[3][:60]}')

    # Estate and inheritance tax: PwC's headline rate is the top rate anyone pays (often an unrelated heir).
    for pid, g in G.items():
        cell = PWC.get(pid)
        if not cell: put(pid, 'inheritance', False, 'not in PwC\'s chart', covered=False); continue
        kind, top = pwc_reading(cell[0])
        gi = g['inherit']
        note = f'PwC (reviewed {cell[1]}): {cell[0][:110]}'
        if kind == 'none': put(pid, 'inheritance', gi['kind'] == 'none', note)
        elif kind == 'rate': put(pid, 'inheritance', gi['kind'] != 'none' and abs(gi['top'] - top) < 0.006, note + f' (game: top {gi["top"]:.4g})')
        else: put(pid, 'inheritance', False, note, covered=gi['kind'] == 'none' and kind == 'np' and False)

    # The free-movement lists: the European area is the EU members in the game, plus Norway (EEA) and Switzerland (agreements).
    eu = set()
    w = page('eu')
    for m in re.finditer('wikitable', w):
        for r in rows(table_at(w, m.start())):
            pid = place_of(r)
            if pid: eu.add(pid)
    eu.discard('uk')  # listed among former members: it left in 2020
    area = set(FREE_EUROPE)
    tasman = 'free movement of citizens' in clean(page('tasman')[:4000])
    for pid in G:
        if pid in ('no', 'ch'): put(pid, 'freeMovement', pid in area, 'Norway (EEA) and Switzerland (bilateral agreements) belong to the area')
        elif pid in ('au', 'nz'): put(pid, 'freeMovement', tasman and pid in TASMAN, 'source: Trans-Tasman Travel Arrangement')
        else: put(pid, 'freeMovement', (pid in eu) == (pid in area), 'source: EU member' if pid in eu else 'source: not an EU member')

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
        sources['inheritance'] = {'site': 'PwC Worldwide Tax Summaries', 'page': 'Inheritance and gift tax rates', 'url': PWC_CHART}
        with open(os.path.join(ROOT, 'js', 'data', 'lawVerification.js'), 'w', encoding='utf-8') as f:
            f.write('// GENERATED by scripts/verify-laws.py. Do not edit by hand: change the data, or DECIDED in the script, and run it again.\n')
            f.write('// What each place\'s laws, ages, citizenship rules and form of government were checked against, and with what result.\n')
            f.write(f'export const LAW_SOURCES = {json.dumps(sources, ensure_ascii=False)};\n')
            f.write(f'export const LAW_CHECKED = {json.dumps(results, ensure_ascii=False, separators=(",", ":"), sort_keys=True)};\n')
        print('\nWrote js/data/lawVerification.js')
    return 1 if any(v['status'] == 'mismatch' for r in results.values() for v in r.values()) else 0


if __name__ == '__main__':
    sys.exit(main())
