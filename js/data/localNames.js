// What schools and universities are called, in the language of the country.
// Countries not listed here use the English patterns in data/education.js and
// data/universities.js. Every place word and saint below is invented or
// generic; {city} is the country's own city.
//
// school[kind] is a list of patterns, or { elementary, middle, high } lists.
// Tokens: {place} {saint} {city} {n} (a school number).

const STYLE_BY_COUNTRY = {
  fr: 'fr', be: 'fr', mc: 'fr', ma: 'fr',
  de: 'de', ch: 'de',
  es: 'es', mx: 'es', ar: 'es', co: 'es', cl: 'es', pe: 'es', do: 'es', ve: 'es', cu: 'es',
  pt: 'pt', br: 'pt',
  it: 'it',
  nl: 'nl',
  se: 'sv', no: 'nodk', dk: 'nodk',
  jp: 'numbered', kr: 'numbered', cn: 'numbered', vn: 'numbered', th: 'numbered', ru: 'numbered', ua: 'numbered',
};

const STYLES = {
  fr: {
    places: ['Rochebrune', 'Clairefontaine', 'Montfleury', 'Beaulieu', 'Val-de-Saule', 'Haut-Bois', 'Malvoisine', 'Pré-Vert', 'Bellerive', 'Montaigu'],
    saints: ['Sainte-Odile', 'Saint-Aubin', 'Sainte-Claire', 'Saint-Hilaire', 'Saint-Rémi'],
    school: {
      public: { elementary: ['École {place}'], middle: ['Collège {place}'], high: ['Lycée {place}'] },
      religious: ['Institution {saint}', 'Collège {saint}'],
      selective: { elementary: ['École {place}'], middle: ['Collège international {place}'], high: ['Lycée international {place}'] },
      private: ['Cours {place}', 'Institut {place}'],
      boarding: ['Pensionnat {saint}', 'Internat de {place}'],
      arts: ['École des arts de la scène {place}'],
      sports: ['Pôle sportif {place}'],
    },
    uni: {
      ancient: ['Université {place}'], research: ['Université de {city}', 'Université {city}-{place}'],
      technical: ['Institut polytechnique de {city}'], regional: ['Université de {city}', 'Université {place}'],
      college: ['École supérieure {place}'], conservatoire: ['Conservatoire de {city}'], open: ['Université ouverte {place}'],
    },
  },
  de: {
    places: ['Lindenhof', 'Eichwald', 'Sonnenberg', 'Rosenhügel', 'Kastanienhof', 'Wiesental', 'Buchenhain', 'Talblick', 'Steinbrück', 'Erlengrund'],
    saints: ['Ansgar', 'Hedwig', 'Bonifatius', 'Gertrud', 'Ulrich'],
    school: {
      public: { elementary: ['Grundschule {place}', '{place}-Grundschule'], middle: ['{place}-Gesamtschule'], high: ['{place}-Gesamtschule'] },
      religious: ['St.-{saint}-Schule'],
      selective: ['{place}-Gymnasium'],
      private: ['Privatschule {place}'],
      boarding: ['Internat Schloss {place}'],
      arts: ['Kunst- und Musikschule {place}'],
      sports: ['Sportschule {place}'],
    },
    uni: {
      ancient: ['Universität {place}'], research: ['Universität {city}', 'Universität {place}'],
      technical: ['Technische Hochschule {city}'], regional: ['Hochschule {city}', 'Hochschule {place}'],
      college: ['Fachhochschule {place}'], conservatoire: ['Musikhochschule {city}'], open: ['Fernuniversität {place}'],
    },
  },
  es: {
    places: ['Los Almendros', 'Valdeluna', 'La Alameda', 'Río Claro', 'Las Acacias', 'Monteverde', 'El Olivar', 'Peñablanca', 'Los Naranjos', 'Vistalegre'],
    saints: ['San Ildefonso', 'Santa Teresa', 'San Isidro', 'San Bernardo', 'Santa Inés'],
    school: {
      public: { elementary: ['Escuela {place}', 'Colegio Público {place}'], middle: ['Instituto {place}'], high: ['Instituto {place}'] },
      religious: ['Colegio {saint}'],
      selective: ['Instituto Bilingüe {place}'],
      private: ['Colegio {place}'],
      boarding: ['Internado {saint}'],
      arts: ['Escuela de Artes Escénicas {place}'],
      sports: ['Centro Deportivo {place}'],
    },
    uni: {
      ancient: ['Universidad {place}'], research: ['Universidad Autónoma de {city}', 'Universidad {place}'],
      technical: ['Universidad Politécnica de {city}'], regional: ['Universidad de {city}', 'Universidad {place}'],
      college: ['Escuela Superior {place}'], conservatoire: ['Conservatorio Superior de {city}'], open: ['Universidad Abierta {place}'],
    },
  },
  pt: {
    places: ['Vale Verde', 'Bela Vista', 'Laranjeiras', 'Monte Claro', 'Pinhal', 'Boa Esperança', 'Alto da Serra', 'Quinta Nova', 'Ribeira Funda', 'Campo Belo'],
    saints: ['São Bento', 'Santa Clara', 'São Lucas', 'Santa Cecília', 'São Vicente'],
    school: {
      public: { elementary: ['Escola {place}'], middle: ['Escola Básica {place}'], high: ['Escola Secundária {place}'] },
      religious: ['Colégio {saint}'],
      selective: ['Escola Secundária {place}'],
      private: ['Colégio {place}'],
      boarding: ['Colégio Interno {saint}'],
      arts: ['Escola de Artes {place}'],
      sports: ['Escola de Desporto {place}'],
    },
    uni: {
      ancient: ['Universidade {place}'], research: ['Universidade de {city}', 'Universidade {place}'],
      technical: ['Instituto Politécnico de {city}'], regional: ['Universidade {place}'],
      college: ['Escola Superior {place}'], conservatoire: ['Conservatório de {city}'], open: ['Universidade Aberta {place}'],
    },
  },
  it: {
    places: ['Belvedere', 'Montalto', 'Valfiorita', 'Colleverde', 'Poggio Alto', 'Rivabella', 'Fontebella', 'Pratolungo', 'Querceto', 'Serralta'],
    saints: ['San Giusto', 'Santa Rita', 'San Romualdo', 'Santa Chiara', 'San Gerardo'],
    school: {
      public: { elementary: ['Scuola primaria {place}'], middle: ['Scuola media {place}'], high: ['Istituto {place}'] },
      religious: ['Istituto {saint}'],
      selective: ['Liceo classico {place}', 'Liceo scientifico {place}'],
      private: ['Istituto {place}'],
      boarding: ['Collegio {place}'],
      arts: ['Liceo artistico {place}'],
      sports: ['Liceo sportivo {place}'],
    },
    uni: {
      ancient: ['Università {place}'], research: ['Università di {city}', 'Università {place}'],
      technical: ['Politecnico di {city}'], regional: ['Università {place}'],
      college: ['Accademia {place}'], conservatoire: ['Conservatorio di {city}'], open: ['Università telematica {place}'],
    },
  },
  nl: {
    places: ['Vlinderhof', 'Eikenlaan', 'De Wilgen', 'Zonnehoek', 'Lindehof', 'De Klaproos', 'Waterkant', 'Het Baken'],
    saints: ['Sint-Jozef', 'Sint-Agnes', 'Sint-Willibrord'],
    school: {
      public: { elementary: ['Basisschool {place}'], middle: ['{place} College'], high: ['{place} College'] },
      religious: ['{saint}school', '{saint} College'],
      selective: ['Gymnasium {place}', 'Lyceum {place}'],
      private: ['Internationale School {place}'],
      boarding: ['Kostschool {place}'],
      arts: ['Kunstschool {place}'],
      sports: ['Topsportschool {place}'],
    },
    uni: {
      ancient: ['Universiteit {place}'], research: ['Universiteit {city}'],
      technical: ['Technische Universiteit {city}'], regional: ['Hogeschool {city}', 'Hogeschool {place}'],
      college: ['University College {place}'], conservatoire: ['Conservatorium {city}'], open: ['Open Universiteit {place}'],
    },
  },
  sv: {
    places: ['Björkhagen', 'Ekdalen', 'Solberga', 'Lindvik', 'Strandholm', 'Granlunda', 'Hagaby', 'Furuvik'],
    saints: ['Sankta Birgitta', 'Sankt Erik'],
    school: {
      public: { elementary: ['{place}skolan'], middle: ['{place}skolan'], high: ['{place} gymnasium'] },
      religious: ['{saint}skolan'],
      selective: ['{place} gymnasium'],
      private: ['Internationella skolan {place}'],
      boarding: ['{place} internat'],
      arts: ['{place} estetiska skola'],
      sports: ['{place} idrottsgymnasium'],
    },
    uni: {
      ancient: ['{place} universitet'], research: ['{city} universitet'], technical: ['Tekniska högskolan i {city}'],
      regional: ['Högskolan i {city}'], college: ['{place} högskola'], conservatoire: ['Musikhögskolan i {city}'], open: ['Öppna högskolan {place}'],
    },
  },
  nodk: {
    places: ['Bjørkely', 'Eikeli', 'Solvang', 'Lindebakken', 'Strandvik', 'Granli', 'Højvang', 'Furuly'],
    saints: ['St. Olav', 'St. Hallvard'],
    school: {
      public: { elementary: ['{place} skole'], middle: ['{place} skole'], high: ['{place} gymnas'] },
      religious: ['{saint}s skole'],
      selective: ['{place} gymnas'],
      private: ['{place} privatskole'],
      boarding: ['{place} kostskole'],
      arts: ['{place} kunstskole'],
      sports: ['{place} idrætsskole'],
    },
    uni: {
      ancient: ['{place} Universitet'], research: ['Universitetet i {city}'], technical: ['{city} Tekniske Universitet'],
      regional: ['Høgskolen i {city}'], college: ['{place} Høgskole'], conservatoire: ['Musikkonservatoriet i {city}'], open: ['Åpent universitet {place}'],
    },
  },
  // Numbered state schools, as in much of East Asia and the former Soviet Union.
  numbered: {
    places: ['Seiran', 'Hakuyo', 'Mingde', 'Kyowa', 'Dongsan', 'Lanting', 'Shiratori', 'Yeonhwa'],
    saints: [],
    school: {
      public: { elementary: ['{city} No. {n} Primary School'], middle: ['{city} No. {n} Middle School'], high: ['{city} No. {n} High School'] },
      religious: ['{city} Mission School'],
      selective: ['{city} Experimental School', '{city} No. 1 High School'],
      private: ['{city} International School'],
      boarding: ['{city} Boarding Academy'],
      arts: ['{city} School of the Arts'],
      sports: ['{city} Sports School'],
    },
    uni: {
      ancient: ['{place} University'], research: ['{city} National University'], technical: ['{city} Institute of Technology'],
      regional: ['{city} Normal University', '{city} City University'], college: ['{city} Foreign Studies University'], conservatoire: ['{city} Conservatory of Music'], open: ['{city} Open University'],
    },
  },
};

const styleOf = (countryId) => STYLES[STYLE_BY_COUNTRY[countryId]] ?? null;

/** Patterns for a school of this kind and stage here, or null to use the English ones. */
export function localSchoolPatterns(kindId, stage, countryId) {
  const s = styleOf(countryId);
  const k = s?.school[kindId];
  if (!k) return null;
  return Array.isArray(k) ? k : k[stage] ?? null;
}
/** Patterns for a university of this kind here, or null. */
export const localUniPatterns = (kindId, countryId) => styleOf(countryId)?.uni[kindId] ?? null;
/** Fills a pattern. `pick` chooses from a list (the game's seeded random). */
export function fillName(pattern, countryId, city, pick, n = 1) {
  const s = styleOf(countryId);
  return pattern.replace('{place}', () => pick(s?.places?.length ? s.places : ['Central']))
    .replace('{saint}', () => pick(s?.saints?.length ? s.saints : ['St Mary\'s']))
    .replace('{city}', city).replace('{n}', String(n));
}
