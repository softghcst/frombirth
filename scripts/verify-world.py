#!/usr/bin/env python3
"""Checks the world's reference data against published sources.

    python3 -m venv .venv && .venv/bin/pip install pycountry babel tzdata geonamescache
    .venv/bin/python scripts/verify-world.py            # report only
    .venv/bin/python scripts/verify-world.py --write    # also write js/data/worldVerification.js

These packages are for checking only. The game never loads them: it has no
build step and no dependencies, and that does not change.

Sources, and what each is used for:
  ISO 3166-1 (pycountry)          codes, and the standard short name (reported, never imposed)
  ISO 4217 / Unicode CLDR (babel) the currency each place uses today; its official languages
  IANA time zones (tzdata)        that the zone named belongs to the place
  GeoNames (geonamescache)        capital; continent, as a cross-check on the UN region; that each city exists

A field is 'ok' when the source agrees, 'review' when it differs and a
person decided the game's value stands (the reason is written in REVIEWED
below), 'unconfirmed' when the source has no answer, and 'mismatch' when it
differs and nobody has looked yet. Fields no
source covers (form of government, the status sentence) are 'unchecked'.
"""
import importlib.metadata as meta
import json
import os
import subprocess
import sys
import unicodedata

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

try:
    import pycountry
    import geonamescache
    import tzdata
    from babel import Locale
    from babel.core import get_global
except ImportError as e:  # pragma: no cover
    sys.exit(f'Missing {e.name}. See the instructions at the top of this file.')

# Where the game deliberately differs from a source, and why. Each is a
# decision, not an error; the report lists them.
REVIEWED = {
    ('tw', 'name'): 'ISO 3166-1 says "Taiwan, Province of China". The game uses the common name and takes no position.',
    ('cd', 'name'): 'ISO 3166-1 says "Congo, The Democratic Republic of the"; the game uses the full official name.',
    ('kr', 'name'): 'ISO 3166-1 says "Korea, Republic of"; the game uses the common name.',
    ('ru', 'name'): 'ISO 3166-1 says "Russian Federation"; the game uses the common name.',
    ('ir', 'name'): 'ISO 3166-1 says "Iran, Islamic Republic of"; the game uses the common name.',
    ('sy', 'name'): 'ISO 3166-1 says "Syrian Arab Republic"; the game uses the common name.',
    ('vn', 'name'): 'ISO 3166-1 says "Viet Nam"; the game uses the common English spelling.',
    ('bo', 'name'): 'ISO 3166-1 says "Bolivia, Plurinational State of"; the game uses the common name.',
    ('ve', 'name'): 'ISO 3166-1 says "Venezuela, Bolivarian Republic of"; the game uses the common name.',
    ('tr', 'name'): 'ISO 3166-1 says "Türkiye"; the game uses the common English name.',
    ('cz', 'name'): 'ISO 3166-1 short name is "Czechia"; see the row.',
    ('uk', 'name'): 'ISO 3166-1 short name is "United Kingdom of Great Britain and Northern Ireland"; the game uses "United Kingdom".',
    ('us', 'name'): 'ISO 3166-1 short name is "United States of America"; the game uses "United States".',
    ('hk', 'capital'): 'Hong Kong is a city-region; GeoNames lists the region itself as its capital.',
    ('kz', 'capital'): 'Astana: renamed back from Nur-Sultan in 2022. This GeoNames extract predates the change.',
    ('ua', 'languages'): 'CLDR lists Russian as official. Under the constitution of Ukraine, Ukrainian is the only state language.',
    ('hk', 'cities'): 'Hong Kong is one city; the game\'s "cities" are its districts.',
    ('mc', 'cities'): 'Monaco is a city-state; the game\'s "cities" are its quarters.',
    ('kw', 'cities'): 'GeoNames spells them Al Jahrā’ and Al Farwānīyah.',
    ('qa', 'cities'): 'GeoNames lists the town as Umm Şalāl Muḩammad; Umm Salal is the municipality.',
    ('bz', 'cities'): 'GeoNames calls it Orange Walk; Orange Walk Town is the town\'s full name.',
    ('bo', 'capital'): 'Bolivia has a constitutional capital (Sucre) and a seat of government (La Paz); the game names both.',
}
# The same language under different names in CLDR and in the game.
LANGUAGE_SAME = {
    'persian': 'dari', 'bangla': 'bengali', 'chinese': 'mandarin', 'traditional chinese': 'mandarin', 'swiss german': 'german',
    'norwegian bokmal': 'norwegian', 'norwegian nynorsk': 'norwegian', 'north ndebele': 'ndebele', 'central atlas tamazight': 'tamazight',
    'quechua': 'kichwa', 'hakka chinese': 'hakka', 'min nan chinese': 'taiwanese hokkien',
}
# Towns this GeoNames extract does not include. The extract is known to be incomplete (it lacks El Alto, a city of
# close to a million), so absence there is not evidence that a place does not exist. They stay 'unconfirmed'.
# GeoNames continent → UN M49 region. Close but not identical, so disagreement is reported, not trusted blindly.
CONTINENT_TO_M49 = {'AF': 'Africa', 'AS': 'Asia', 'EU': 'Europe', 'NA': 'Americas', 'SA': 'Americas', 'OC': 'Oceania'}


def fold(s):
    s = unicodedata.normalize('NFKD', s or '').encode('ascii', 'ignore').decode().lower()
    return ''.join(ch for ch in s if ch.isalnum() or ch == ' ').strip()


def game_data():
    """The game's own data, read through Node so the JavaScript is the single source of truth."""
    script = """
      const { PLACES } = await import('./js/data/world.js');
      const { COUNTRIES } = await import('./js/data/countries.js');
      const { CITY_ROWS } = await import('./js/data/cities.js');
      const out = {};
      for (const [id, p] of Object.entries(PLACES)) {
        const c = COUNTRIES[id];
        out[id] = { ...p, name: c?.name ?? null, currency: c?.currency.code ?? null, cities: c?.cities ?? [] };
      }
      console.log(JSON.stringify({ places: out, cityRows: CITY_ROWS }));
    """
    res = subprocess.run(['node', '--input-type=module', '-e', script], cwd=ROOT, capture_output=True, text=True, check=True)
    return json.loads(res.stdout)


def tz_by_country():
    import importlib.resources as ir
    zones = {}
    base = ir.files(tzdata).joinpath('zoneinfo')
    for name in ('zone.tab', 'zone1970.tab'):
        for line in base.joinpath(name).read_text(encoding='utf-8').splitlines():
            if line.startswith('#') or not line.strip():
                continue
            parts = line.split('\t')
            for cc in parts[0].split(','):
                zones.setdefault(cc, set()).add(parts[2])
    return zones


def current_currency(cc):
    hist = get_global('territory_currencies').get(cc, [])
    return {code for code, _start, end, tender in hist if end is None and tender}


def official_languages(cc):
    en = Locale('en')
    langs = get_global('territory_languages').get(cc, {})
    names = set()
    for code, info in langs.items():
        if info.get('official_status') in ('official', 'de_facto_official'):
            base = code.split('_')[0]
            names.add(en.languages.get(code) or en.languages.get(base) or code)
    return names


def main():
    write = '--write' in sys.argv
    data = game_data()
    gc = geonamescache.GeonamesCache()
    gcountries = gc.get_countries()
    gcities = gc.get_cities()
    cities_by_cc = {}
    for c in gcities.values():
        names = {fold(c['name'])} | {fold(a) for a in c.get('alternatenames', []) if a}
        cities_by_cc.setdefault(c['countrycode'], set()).update(names)
    zones = tz_by_country()
    results = {}
    lines = []

    for pid, p in sorted(data['places'].items()):
        cc = p['iso2']
        r = {}
        def put(field, status, note=''):
            if status == 'mismatch' and (pid, field) in REVIEWED:
                status, note = 'review', REVIEWED[(pid, field)]
            r[field] = {'status': status, **({'note': note} if note else {})}

        iso = pycountry.countries.get(alpha_2=cc)
        if not iso:
            put('codes', 'mismatch', f'{cc} is not an ISO 3166-1 alpha-2 code')
        elif iso.alpha_3 != p['iso3']:
            put('codes', 'mismatch', f'ISO 3166-1 alpha-3 for {cc} is {iso.alpha_3}, not {p["iso3"]}')
        else:
            put('codes', 'ok')
        if iso:
            names = {fold(iso.name), fold(getattr(iso, 'common_name', '')), fold(getattr(iso, 'official_name', ''))}
            put('name', 'ok' if fold(p['name']) in names else 'mismatch', f'ISO 3166-1: {iso.name}')

        cur = current_currency(cc)
        if not cur:
            put('currency', 'unchecked', 'CLDR lists no current currency')
        elif p['currency'] in cur:
            put('currency', 'ok')
        else:
            put('currency', 'mismatch', f'CLDR: {", ".join(sorted(cur))}; the game uses {p["currency"]}')

        put('timeZone', 'ok' if p['timeZone'] in zones.get(cc, set()) else 'mismatch',
            f'IANA zones for {cc}: {", ".join(sorted(zones.get(cc, [])))}' if p['timeZone'] not in zones.get(cc, set()) else '')

        g = gcountries.get(cc)
        if g:
            ok = fold(g['capital']) and fold(g['capital']) in fold(p['capital'])
            put('capital', 'ok' if ok else 'mismatch', '' if ok else f'GeoNames: {g["capital"]}')
            region = CONTINENT_TO_M49.get(g['continentcode'])
            put('unRegion', 'ok' if region == p['unRegion'] else 'mismatch', '' if region == p['unRegion'] else f'GeoNames continent {g["continentcode"]} suggests {region}')
        else:
            put('capital', 'unchecked', 'not in GeoNames')
            put('unRegion', 'unchecked', 'not in GeoNames')

        canon = lambda n: LANGUAGE_SAME.get(fold(n), fold(n))
        official = {canon(n) for n in official_languages(cc)}
        mine = {canon(n) for n in p['languages']}
        missing = sorted(official - mine)
        if not official:
            put('languages', 'unchecked', 'CLDR lists no official language')
        elif not missing:
            extra = sorted(mine - official)
            put('languages', 'ok', f'also listed, not official in CLDR: {", ".join(extra)}' if extra else '')
        else:
            put('languages', 'mismatch', f'official in CLDR but not listed: {", ".join(missing)}')

        known = cities_by_cc.get(cc, set())
        bare = lambda n: fold(n).removesuffix(' city').removesuffix(' town')
        unknown = [c for c in p['cities'] if fold(c) not in known and bare(c) not in known]
        if not unknown:
            put('cities', 'ok')
        elif (pid, 'cities') in REVIEWED:
            put('cities', 'mismatch', '')
        else:
            put('cities', 'unconfirmed', f'not in the GeoNames extract: {", ".join(unknown)}')

        # Regions of cities, where GeoNames carries them (United States states).
        if pid == 'us':
            states = {k: v['name'] for k, v in gc.get_us_states().items()}
            wrong = []
            for city, row in data['cityRows'].get('us', {}).items():
                hits = [c for c in gcities.values() if c['countrycode'] == 'US' and fold(c['name']) == fold(city)]
                hits.sort(key=lambda c: -c['population'])
                if hits and states.get(hits[0]['admin1code']) != row['region']:
                    wrong.append(f'{city}: GeoNames {states.get(hits[0]["admin1code"])}, game {row["region"]}')
            put('regions', 'ok' if not wrong else 'mismatch', '; '.join(wrong))
        r['government'] = {'status': 'unchecked'}
        if p.get('status'):
            r['status'] = {'status': 'unchecked'}
        results[pid] = r

    counts = {}
    for pid, r in results.items():
        for field, v in r.items():
            counts.setdefault(field, {}).setdefault(v['status'], 0)
            counts[field][v['status']] += 1
            if v['status'] in ('mismatch', 'review', 'unconfirmed'):
                lines.append(f'{pid:3} {field:10} {v["status"]:8} {v.get("note", "")}')

    versions = {k: meta.version(k) for k in ('pycountry', 'babel', 'tzdata', 'geonamescache')}
    print('Sources:', ', '.join(f'{k} {v}' for k, v in versions.items()))
    for field, c in counts.items():
        print(f'  {field:10} ' + '  '.join(f'{k} {n}' for k, n in sorted(c.items())))
    print()
    for line in lines:
        print(line)

    if write:
        body = json.dumps(results, ensure_ascii=False, indent=None, separators=(',', ':'), sort_keys=True)
        out = (
            '// GENERATED by scripts/verify-world.py. Do not edit by hand: change the data, or REVIEWED in the script, and run it again.\n'
            '// What each place\'s reference fields were checked against, and with what result.\n'
            f'export const SOURCES = {json.dumps(versions, sort_keys=True)};\n'
            f'export const CHECKED = {body};\n'
        )
        with open(os.path.join(ROOT, 'js', 'data', 'worldVerification.js'), 'w', encoding='utf-8') as f:
            f.write(out)
        print('\nWrote js/data/worldVerification.js')
    return 1 if any(v['status'] == 'mismatch' for r in results.values() for v in r.values()) else 0


if __name__ == '__main__':
    sys.exit(main())
