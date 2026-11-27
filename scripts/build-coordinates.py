#!/usr/bin/env python3
"""Writes the coordinates of every city the game knows, from GeoNames.

    python3 -m venv .venv && .venv/bin/pip install geonamescache
    .venv/bin/python scripts/build-coordinates.py            # report only
    .venv/bin/python scripts/build-coordinates.py --write    # also write js/data/coordinates.js

The game never loads this package: it has no build step and no dependencies.
The output is a plain data file.

Source: GeoNames (via the geonamescache package, cities with more than 15,000
people). A city is matched in its own country by name, then by any alternate
name, and where several places share a name the most populous is taken. A city
GeoNames does not list is left out and reported, never guessed: the game falls
back to the capital of that country, and says so where it matters.

Coordinates are used for distances, journey times, seasons (northern or southern
hemisphere) and the family map. They are rounded to two decimal places.
"""
import importlib.metadata as meta
import json
import os
import subprocess
import sys
import unicodedata

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

try:
    import geonamescache
except ImportError as e:  # pragma: no cover
    sys.exit(f'Missing {e.name}. See the instructions at the top of this file.')

# Names the game uses that GeoNames spells differently. Each is a spelling, not a different place.
ALIASES = {
    ('us', 'Washington, D.C.'): 'Washington',
    ('hk', 'Hong Kong'): 'Hong Kong',
    ('bo', 'Sucre (constitutional); La Paz (seat of government)'): 'La Paz',
    ('za', 'Pretoria (executive); Cape Town (legislative); Bloemfontein (judicial)'): 'Pretoria',
    ('ch', 'Bern (federal city)'): 'Bern',
    ('dj', 'Djibouti City'): 'Djibouti',
    ('il', 'Jerusalem (seat of government; status disputed internationally)'): 'Jerusalem',
    ('nl', 'Amsterdam (capital); The Hague (seat of government)'): 'Amsterdam',
    ('mc', 'Monaco-Ville'): 'Monaco',
    ('kw', 'Jahra'): 'Al Jahra',
    ('kw', 'Farwaniya'): 'Al Farwaniyah',
    ('us', 'Portland, Maine'): 'Portland',
    ('us', 'Charleston, West Virginia'): 'Charleston',
    ('eg', 'Faiyum'): 'Al Fayyum',
}

# The postal code GeoNames uses for each US state (admin1code), by the state's name in js/data/cities.js.
US_STATES = {'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR', 'California': 'CA', 'Colorado': 'CO', 'Connecticut': 'CT',
    'Delaware': 'DE', 'District of Columbia': 'DC', 'Florida': 'FL', 'Georgia': 'GA', 'Hawaii': 'HI', 'Idaho': 'ID', 'Illinois': 'IL',
    'Indiana': 'IN', 'Iowa': 'IA', 'Kansas': 'KS', 'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
    'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS', 'Missouri': 'MO', 'Montana': 'MT',
    'Nebraska': 'NE', 'Nevada': 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY',
    'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH', 'Oklahoma': 'OK', 'Oregon': 'OR', 'Pennsylvania': 'PA',
    'Rhode Island': 'RI', 'South Carolina': 'SC', 'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT',
    'Vermont': 'VT', 'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV', 'Wisconsin': 'WI', 'Wyoming': 'WY'}


def fold(s):
    s = unicodedata.normalize('NFKD', s or '')
    return ''.join(ch for ch in s if not unicodedata.combining(ch)).lower().replace('-', ' ').replace('’', "'").strip()


def game_data():
    script = """
      const { PLACES } = await import('./js/data/world.js');
      const { COUNTRIES } = await import('./js/data/countries.js');
      const { CITY_ROWS } = await import('./js/data/cities.js');
      const out = {};
      for (const [id, p] of Object.entries(PLACES)) {
        const c = COUNTRIES[id];
        if (!c) continue;
        out[id] = { iso2: p.iso2, capital: p.capital, cities: c.cities, regions: Object.fromEntries(Object.entries(CITY_ROWS[id] ?? {}).map(([k, v]) => [k, v.region])) };
      }
      console.log(JSON.stringify(out));
    """
    res = subprocess.run(['node', '--input-type=module', '-e', script], cwd=ROOT, capture_output=True, text=True, check=True)
    return json.loads(res.stdout)


def main():
    write = '--write' in sys.argv
    data = game_data()
    gc = geonamescache.GeonamesCache()
    by_cc = {}
    for c in gc.get_cities().values():
        by_cc.setdefault(c['countrycode'], []).append(c)

    def find(cc, name, admin1=None):
        pool = by_cc.get(cc, [])
        # A US city is looked for in its own state: there is a Portland in Oregon and in Maine, a Burlington in Vermont and in North Carolina.
        if admin1:
            pool = [c for c in pool if c.get('admin1code') == admin1]
        want = fold(name)
        exact = [c for c in pool if fold(c['name']) == want]
        if not exact:
            exact = [c for c in pool if want in {fold(a) for a in c.get('alternatenames', []) if a}]
        if not exact:
            return None
        return max(exact, key=lambda c: c.get('population') or 0)

    out = {}
    missing = []
    for pid, p in sorted(data.items()):
        cc = p['iso2']
        row = {}
        names = list(dict.fromkeys([p['capital'], *p['cities']]))
        for name in names:
            look = ALIASES.get((pid, name), name)
            admin1 = US_STATES.get(p.get('regions', {}).get(name)) if pid == 'us' else None
            hit = find(cc, look, admin1)
            if not hit and ',' in look:
                hit = find(cc, look.split(',')[0])
            if not hit:
                missing.append(f'{pid}: {name}')
                continue
            row[name] = [round(hit['latitude'], 2), round(hit['longitude'], 2), hit['geonameid']]
        out[pid] = {'capital': p['capital'], 'cities': row}

    found = sum(len(v['cities']) for v in out.values())
    print(f'{found} places located; {len(missing)} not in GeoNames (left out):')
    for m in missing:
        print('  ', m)
    no_capital = [pid for pid, v in out.items() if v['capital'] not in v['cities'] and not v['cities']]
    if no_capital:
        print('places with no located city at all:', ', '.join(no_capital))

    if write:
        version = meta.version('geonamescache')
        body = json.dumps(out, ensure_ascii=False, separators=(',', ':'), sort_keys=True)
        with open(os.path.join(ROOT, 'js/data/coordinates.js'), 'w', encoding='utf-8') as f:
            f.write('// GENERATED by scripts/build-coordinates.py from GeoNames (geonamescache '
                    f'{version}). Do not edit by hand.\n'
                    '// { placeId: { capital, cities: { name: [latitude, longitude, geonameId] } } }\n'
                    '// A city GeoNames does not list is absent: the game uses the capital instead.\n'
                    f'export const COORDINATES = {body};\n')
        print('wrote js/data/coordinates.js')


if __name__ == '__main__':
    main()
