// currency.scale converts base (USD-like) amounts into everyday local amounts.
// incomeTax is an effective rate on annual income. The second number after it (once a flat estate tax) is no
// longer used: estate and inheritance tax is in data/inheritance.js.
import { NAMES } from './names.js';
import { LIVING } from './living.js';
import { NEW_PLACES } from './worldNew.js';
import { PLACES } from './world.js';

/** A name list: the short one here plus the long one in names.js, without repeats. */
const pool = (short, long = '') => [...new Set(`${short} ${long}`.split(' ').filter(Boolean).map((n) => n.replace(/_/g, ' ')))];

const C = (id, name, flag, code, symbol, scale, incomeTax, estateTax, cities, m = '', f = '', s = '') => ({
  id, name, flag, currency: { code, symbol, scale }, incomeTax, cities,
  names: { male: pool(m, NAMES[id]?.male), female: pool(f, NAMES[id]?.female), last: pool(s, NAMES[id]?.last) },
});

const LIST = [
  C('us', 'United States', '🇺🇸', 'USD', '$', 1, 0.24, 0.20,
    ['New York', 'Chicago', 'Austin', 'Seattle', 'Atlanta', 'Denver', 'Orlando'],
    'James Marcus Ethan Caleb Diego Tyler Owen Andre Noah Wesley',
    'Olivia Hannah Maya Jasmine Claire Sofia Naomi Paige Riley Tessa',
    'Carter Nguyen Brooks Ramirez Sullivan Patel Hayes Coleman Whitfield Ortiz Bennett Okafor'),
  C('uk', 'United Kingdom', '🇬🇧', 'GBP', '£', 0.8, 0.27, 0.20,
    ['London', 'Manchester', 'Leeds', 'Bristol', 'Glasgow', 'Cardiff'],
    'Oliver Harry Callum Alfie Rhys Declan Theo Kieran Hugo Jamal',
    'Amelia Isla Poppy Freya Niamh Zara Imogen Lottie Priya Elsie',
    'Hughes Whitaker Barlow Singh Fletcher Doyle Ashworth Pemberton Khan Lowry Marsh Okoro'),
  C('ca', 'Canada', '🇨🇦', 'CAD', 'C$', 1.35, 0.26, 0.05,
    ['Toronto', 'Vancouver', 'Montreal', 'Calgary', 'Halifax', 'Winnipeg'],
    'Liam Lucas Étienne Connor Mathieu Jasper Kai Gavin Amir Reid',
    'Emma Chloé Avery Sadie Élise Brooke Mila Simone Leila Quinn',
    'Tremblay MacLeod Gagnon Chen Fraser Bouchard Sandhu Lavoie Petrov Morin Dhillon Roy'),
  C('au', 'Australia', '🇦🇺', 'AUD', 'A$', 1.5, 0.27, 0,
    ['Sydney', 'Melbourne', 'Brisbane', 'Perth', 'Adelaide', 'Hobart'],
    'Jack Lachlan Cooper Angus Mitchell Darcy Flynn Hamish Bodhi Zane',
    'Charlotte Matilda Ruby Sienna Harper Indi Georgia Willow Kirra Tahlia',
    'Kelly Nguyen Hawkins Papadopoulos Burke Dawson Tran McAllister Fitzroy Lam Shepherd Cole'),
  C('de', 'Germany', '🇩🇪', 'EUR', '€', 0.9, 0.33, 0.15,
    ['Berlin', 'Hamburg', 'Munich', 'Cologne', 'Leipzig', 'Stuttgart'],
    'Lukas Felix Jonas Maximilian Emre Paul Niklas Anton Moritz Tobias',
    'Hannah Lena Mia Johanna Clara Aylin Greta Frieda Marlene Nele',
    'Becker Hoffmann Krüger Yilmaz Vogel Lehmann Brandt Keller Schuster Lindner Albrecht Seidel'),
  C('fr', 'France', '🇫🇷', 'EUR', '€', 0.9, 0.32, 0.20,
    ['Paris', 'Lyon', 'Marseille', 'Toulouse', 'Nantes', 'Lille'],
    'Louis Hugo Mathis Théo Julien Rayan Baptiste Clément Antoine Yanis',
    'Camille Léa Manon Inès Juliette Margaux Élodie Anaïs Salomé Nour',
    'Lefèvre Moreau Girard Roussel Fontaine Benali Chevalier Marchand Perrin Diallo Renard Colin'),
  C('jp', 'Japan', '🇯🇵', 'JPY', '¥', 150, 0.25, 0.30,
    ['Tokyo', 'Osaka', 'Kyoto', 'Sapporo', 'Fukuoka', 'Nagoya'],
    'Haruto Ren Sota Yuto Daiki Kaito Riku Takumi Shun Kenta',
    'Yui Aoi Hina Sakura Mei Rin Nanami Akari Miyu Kokoro',
    'Sato Takahashi Watanabe Kobayashi Yamamoto Nakamura Inoue Kimura Hayashi Shimizu Mori Ishikawa'),
  C('br', 'Brazil', '🇧🇷', 'BRL', 'R$', 3, 0.22, 0.06,
    ['São Paulo', 'Rio de Janeiro', 'Salvador', 'Curitiba', 'Recife', 'Belo Horizonte'],
    'Lucas Gabriel Rafael Thiago Caio Bruno Vinícius Matheus Davi Heitor',
    'Ana Beatriz Larissa Camila Júlia Isadora Letícia Marina Yasmin Luana',
    'Silva Oliveira Costa Pereira Almeida Ribeiro Carvalho Barbosa Teixeira Monteiro Cardoso Farias'),
  C('in', 'India', '🇮🇳', 'INR', '₹', 30, 0.15, 0,
    ['Mumbai', 'Delhi', 'Bengaluru', 'Chennai', 'Kolkata', 'Pune'],
    'Arjun Rohan Vikram Aditya Karan Imran Siddharth Nikhil Dev Rahul',
    'Priya Ananya Kavya Meera Aisha Divya Sneha Riya Tara Pooja',
    'Sharma Iyer Reddy Kapoor Banerjee Nair Chaudhary Desai Mehta Fernandes Joshi Khan'),
  C('ng', 'Nigeria', '🇳🇬', 'NGN', '₦', 400, 0.14, 0,
    ['Lagos', 'Abuja', 'Ibadan', 'Port Harcourt', 'Kano', 'Enugu'],
    'Chinedu Tunde Emeka Ibrahim Femi Obinna Segun Musa Kelechi Dayo',
    'Ngozi Amara Folake Zainab Chioma Temi Halima Adaeze Bisi Ifeoma',
    'Okonkwo Adeyemi Balogun Eze Abubakar Nwosu Ogunleye Danjuma Uche Bello Olawale Chukwu'),
  C('mx', 'Mexico', '🇲🇽', 'MXN', 'Mex$', 10, 0.18, 0,
    ['Mexico City', 'Guadalajara', 'Monterrey', 'Puebla', 'Mérida', 'Oaxaca'],
    'Santiago Mateo Emiliano Diego Leonardo Iker Andrés Joaquín Rodrigo Ángel',
    'Valentina Ximena Regina Renata Fernanda Daniela Paola Mariana Itzel Lucía',
    'Hernández Castillo Vargas Mendoza Guerrero Rojas Navarro Delgado Ibarra Cisneros Zamora Fuentes'),
  C('kr', 'South Korea', '🇰🇷', 'KRW', '₩', 1000, 0.22, 0.30,
    ['Seoul', 'Busan', 'Incheon', 'Daegu', 'Daejeon', 'Gwangju'],
    'Minjun Seojun Jiho Hyunwoo Dohyun Taeyang Junseo Siwoo Geon Yejun',
    'Seoyeon Jiwoo Haeun Minseo Yuna Chaewon Sua Dain Eunji Nari',
    'Kim Lee Park Choi Jung Kang Yoon Lim Han Shin Kwon Song'),
  C('it', 'Italy', '🇮🇹', 'EUR', '€', 0.9, 0.31, 0.06,
    ['Rome', 'Milan', 'Naples', 'Turin', 'Bologna', 'Florence'],
    'Leonardo Matteo Lorenzo Davide Riccardo Tommaso Federico Simone Pietro Luca',
    'Giulia Sofia Aurora Chiara Martina Elena Alessia Bianca Noemi Francesca',
    'Rossi Bianchi Ferrari Esposito Romano Colombo Ricci Marino Greco Conti Gallo Fontana'),
  C('es', 'Spain', '🇪🇸', 'EUR', '€', 0.9, 0.28, 0.10,
    ['Madrid', 'Barcelona', 'Valencia', 'Seville', 'Bilbao', 'Málaga'],
    'Hugo Pablo Álvaro Adrián Javier Sergio Marcos Iván Rubén Nicolás',
    'Lucía Martina Paula Alba Carmen Noa Irene Marta Nuria Elena',
    'García Martínez López Sánchez Romero Navarro Torres Domínguez Vázquez Ramos Gil Serrano'),
  C('se', 'Sweden', '🇸🇪', 'SEK', 'kr', 10, 0.32, 0,
    ['Stockholm', 'Gothenburg', 'Malmö', 'Uppsala', 'Västerås', 'Umeå'],
    'Erik Oscar Axel Viktor Elias Nils Isak Anton Gustav Ludvig',
    'Elsa Maja Astrid Wilma Freja Saga Linnea Ebba Signe Tuva',
    'Andersson Lindqvist Bergström Nyström Holm Sandberg Ekström Lundgren Sjöberg Hedlund Öberg Dahl'),
  C('ie', 'Ireland', '🇮🇪', 'EUR', '€', 0.9, 0.29, 0.25,
    ['Dublin', 'Cork', 'Galway', 'Limerick', 'Waterford', 'Kilkenny'],
    'Conor Seán Cian Oisín Darragh Fionn Pádraig Eoin Tadhg Rory',
    'Aoife Saoirse Ciara Niamh Róisín Sinéad Orla Caoimhe Maeve Clodagh',
    'Murphy Byrne Gallagher Doherty Kavanagh Nolan Brennan Quinn Flanagan Sheehan Daly Keane'),
  C('za', 'South Africa', '🇿🇦', 'ZAR', 'R', 9, 0.22, 0.20,
    ['Johannesburg', 'Cape Town', 'Durban', 'Pretoria', 'Gqeberha', 'Bloemfontein'],
    'Thabo Sipho Lwazi Pieter Johan Bongani Kagiso Ruan Themba Mandla',
    'Naledi Lerato Zanele Thandi Anika Nomsa Palesa Mia Busisiwe Ayanda',
    'Nkosi Dlamini Botha Naidoo Mokoena Khumalo Pretorius Mahlangu Govender Zulu Venter Sithole'),
  C('cn', 'China', '🇨🇳', 'CNY', 'CN¥', 4, 0.18, 0,
    ['Beijing', 'Shanghai', 'Guangzhou', 'Chengdu', 'Shenzhen', 'Hangzhou'],
    'Wei Hao Jun Lei Ming Tao Yang Bo Chen Zhiwei',
    'Li Fang Xiu Mei Jing Yan Hui Lan Qing Yue',
    'Wang Zhang Liu Chen Yang Huang Zhao Wu Zhou Xu Sun Ma'),
  C('ph', 'Philippines', '🇵🇭', 'PHP', '₱', 25, 0.17, 0.06,
    ['Manila', 'Cebu City', 'Davao', 'Quezon City', 'Iloilo', 'Baguio'],
    'Jose Miguel Paolo Carlo Rafael Jericho Enzo Marco Noel Ramon',
    'Maria Angelica Bea Kristine Jasmine Liza Althea Carmela Joy Rhea',
    'Santos Reyes Cruz Bautista Ocampo Garcia Mendoza Aquino Villanueva Ramos Castro Dizon'),
  C('ar', 'Argentina', '🇦🇷', 'ARS', 'AR$', 600, 0.20, 0,
    ['Buenos Aires', 'Córdoba', 'Rosario', 'Mendoza', 'Salta', 'La Plata'],
    'Mateo Bautista Thiago Joaquín Benjamín Lautaro Franco Agustín Tomás Facundo',
    'Sofía Martina Catalina Emilia Valentina Julieta Morena Abril Camila Florencia',
    'González Rodríguez Fernández Gómez Díaz Álvarez Romero Sosa Acosta Benítez Medina Herrera'),
  // Names for the countries below are all in names.js.
  C('ve', 'Venezuela', '🇻🇪', 'VES', 'Bs.', 36, 0.16, 0.10,
    ['Caracas', 'Maracaibo', 'Valencia', 'Barquisimeto', 'Mérida', 'Maracay']),
  C('co', 'Colombia', '🇨🇴', 'COP', 'COL$', 4000, 0.19, 0,
    ['Bogotá', 'Medellín', 'Cali', 'Barranquilla', 'Cartagena', 'Bucaramanga']),
  C('cl', 'Chile', '🇨🇱', 'CLP', 'CLP$', 900, 0.17, 0.10,
    ['Santiago', 'Valparaíso', 'Concepción', 'La Serena', 'Antofagasta', 'Temuco']),
  C('pt', 'Portugal', '🇵🇹', 'EUR', '€', 0.9, 0.28, 0,
    ['Lisbon', 'Porto', 'Braga', 'Coimbra', 'Faro', 'Aveiro']),
  C('nl', 'Netherlands', '🇳🇱', 'EUR', '€', 0.9, 0.35, 0.15,
    ['Amsterdam', 'Rotterdam', 'Utrecht', 'The Hague', 'Eindhoven', 'Groningen']),
  C('pl', 'Poland', '🇵🇱', 'PLN', 'zł', 4, 0.22, 0.05,
    ['Warsaw', 'Kraków', 'Wrocław', 'Gdańsk', 'Poznań', 'Łódź']),
  C('tr', 'Turkey', '🇹🇷', 'TRY', '₺', 30, 0.20, 0.05,
    ['Istanbul', 'Ankara', 'Izmir', 'Bursa', 'Antalya', 'Konya']),
  C('eg', 'Egypt', '🇪🇬', 'EGP', 'E£', 48, 0.15, 0,
    ['Cairo', 'Alexandria', 'Giza', 'Luxor', 'Aswan', 'Mansoura']),
  C('th', 'Thailand', '🇹🇭', 'THB', '฿', 35, 0.15, 0.05,
    ['Bangkok', 'Chiang Mai', 'Phuket', 'Khon Kaen', 'Hat Yai', 'Pattaya']),
  C('vn', 'Vietnam', '🇻🇳', 'VND', '₫', 25000, 0.15, 0,
    ['Hanoi', 'Ho Chi Minh City', 'Da Nang', 'Huế', 'Hai Phong', 'Can Tho']),
  C('ke', 'Kenya', '🇰🇪', 'KES', 'KSh', 130, 0.20, 0,
    ['Nairobi', 'Mombasa', 'Kisumu', 'Nakuru', 'Eldoret', 'Thika']),
  C('jm', 'Jamaica', '🇯🇲', 'JMD', 'J$', 155, 0.22, 0,
    ['Kingston', 'Montego Bay', 'Spanish Town', 'Portmore', 'Mandeville', 'Ocho Rios']),
  C('nz', 'New Zealand', '🇳🇿', 'NZD', 'NZ$', 1.6, 0.26, 0,
    ['Auckland', 'Wellington', 'Christchurch', 'Dunedin', 'Hamilton', 'Queenstown']),
  C('ch', 'Switzerland', '🇨🇭', 'CHF', 'CHF ', 0.9, 0.22, 0.05,
    ['Zurich', 'Geneva', 'Basel', 'Bern', 'Lausanne', 'Lucerne']),
  C('no', 'Norway', '🇳🇴', 'NOK', 'kr', 10, 0.30, 0,
    ['Oslo', 'Bergen', 'Trondheim', 'Stavanger', 'Tromsø', 'Kristiansand']),
  C('dk', 'Denmark', '🇩🇰', 'DKK', 'kr', 7, 0.36, 0.15,
    ['Copenhagen', 'Aarhus', 'Odense', 'Aalborg', 'Esbjerg', 'Roskilde']),
  C('gr', 'Greece', '🇬🇷', 'EUR', '€', 0.9, 0.26, 0.05,
    ['Athens', 'Thessaloniki', 'Patras', 'Heraklion', 'Larissa', 'Rhodes']),
  C('ru', 'Russia', '🇷🇺', 'RUB', '₽', 90, 0.13, 0,
    ['Moscow', 'Saint Petersburg', 'Novosibirsk', 'Kazan', 'Yekaterinburg', 'Sochi']),
  C('ua', 'Ukraine', '🇺🇦', 'UAH', '₴', 40, 0.18, 0,
    ['Kyiv', 'Lviv', 'Odesa', 'Kharkiv', 'Dnipro', 'Chernivtsi']),
  C('pe', 'Peru', '🇵🇪', 'PEN', 'S/', 3.8, 0.17, 0,
    ['Lima', 'Arequipa', 'Cusco', 'Trujillo', 'Piura', 'Iquitos']),
  C('do', 'Dominican Republic', '🇩🇴', 'DOP', 'RD$', 58, 0.17, 0.03,
    ['Santo Domingo', 'Santiago', 'Punta Cana', 'La Romana', 'Puerto Plata', 'San Pedro de Macorís']),
  C('cu', 'Cuba', '🇨🇺', 'CUP', '$', 120, 0.15, 0,
    ['Havana', 'Santiago de Cuba', 'Camagüey', 'Holguín', 'Trinidad', 'Cienfuegos']),
  C('gh', 'Ghana', '🇬🇭', 'GHS', 'GH₵', 12, 0.18, 0,
    ['Accra', 'Kumasi', 'Tamale', 'Cape Coast', 'Takoradi', 'Ho']),
  C('ma', 'Morocco', '🇲🇦', 'MAD', 'DH ', 10, 0.20, 0,
    ['Casablanca', 'Rabat', 'Marrakesh', 'Fez', 'Tangier', 'Agadir']),
  C('pk', 'Pakistan', '🇵🇰', 'PKR', '₨', 280, 0.15, 0,
    ['Karachi', 'Lahore', 'Islamabad', 'Faisalabad', 'Peshawar', 'Multan']),
  C('id', 'Indonesia', '🇮🇩', 'IDR', 'Rp', 15500, 0.15, 0,
    ['Jakarta', 'Surabaya', 'Bandung', 'Denpasar', 'Yogyakarta', 'Medan']),
  C('sg', 'Singapore', '🇸🇬', 'SGD', 'S$', 1.35, 0.12, 0,
    ['Singapore']),
  C('ae', 'United Arab Emirates', '🇦🇪', 'AED', 'AED ', 3.7, 0, 0,
    ['Dubai', 'Abu Dhabi', 'Sharjah', 'Al Ain', 'Ajman', 'Ras Al Khaimah']),
  C('be', 'Belgium', '🇧🇪', 'EUR', '€', 0.9, 0.40, 0.10,
    ['Brussels', 'Antwerp', 'Ghent', 'Bruges', 'Liège', 'Leuven']),
  C('mc', 'Monaco', '🇲🇨', 'EUR', '€', 0.9, 0, 0,
    ['Monaco-Ville', 'Monte Carlo', 'La Condamine', 'Fontvieille', 'Larvotto', 'Moneghetti']),
  C('jo', 'Jordan', '🇯🇴', 'JOD', 'JD ', 0.71, 0.14, 0,
    ['Amman', 'Zarqa', 'Irbid', 'Aqaba', 'Salt', 'Madaba']),
  C('sa', 'Saudi Arabia', '🇸🇦', 'SAR', 'SR ', 3.75, 0, 0,
    ['Riyadh', 'Jeddah', 'Mecca', 'Medina', 'Dammam', 'Abha']),
  C('kw', 'Kuwait', '🇰🇼', 'KWD', 'KD ', 0.31, 0, 0,
    ['Kuwait City', 'Hawalli', 'Salmiya', 'Al Ahmadi', 'Jahra', 'Farwaniya']),
  C('qa', 'Qatar', '🇶🇦', 'QAR', 'QR ', 3.64, 0, 0,
    ['Doha', 'Al Rayyan', 'Al Wakrah', 'Al Khor', 'Umm Salal', 'Lusail']),
  C('my', 'Malaysia', '🇲🇾', 'MYR', 'RM ', 4.6, 0.20, 0,
    ['Kuala Lumpur', 'George Town', 'Johor Bahru', 'Ipoh', 'Kuching', 'Kota Kinabalu']),
];

// The places added by the Living World engine (data/worldNew.js): the same record, from one row each.
for (const [id, r] of Object.entries(NEW_PLACES)) {
  const [name, flag, [code, symbol, scale], [incomeTax, estateTax], cities, [m, f, s]] = r;
  LIST.push(C(id, name, flag, code, symbol, scale, incomeTax, estateTax, cities, m, f, s));
}

// Public services, used by health care and university costs in later phases.
const POLICY = {
  us: [false, false], uk: [true, false], ca: [true, false], au: [true, false],
  de: [true, true], fr: [true, true], jp: [true, false], br: [true, true],
  in: [false, false], ng: [false, false], mx: [false, true], kr: [true, false],
  it: [true, false], es: [true, false], se: [true, true], ie: [false, false],
  za: [false, false], cn: [false, false], ph: [false, false], ar: [true, true],
  ve: [true, true], co: [false, false], cl: [false, false], pt: [true, false],
  nl: [true, false], pl: [true, true], tr: [true, true], eg: [false, true],
  th: [true, false], vn: [false, false], ke: [false, false], jm: [true, false],
  nz: [true, false], ch: [false, false], no: [true, true], dk: [true, true],
  gr: [true, true], ru: [true, false], ua: [true, false], pe: [false, false],
  do: [false, false], cu: [true, true], gh: [false, false], ma: [false, true],
  pk: [false, false], id: [false, false], sg: [false, false], ae: [false, false],
  be: [true, false], mc: [true, false], jo: [false, false], sa: [true, true],
  kw: [true, true], qa: [true, true], my: [true, false],
};
for (const [id, r] of Object.entries(NEW_PLACES)) POLICY[id] = r[7];
for (const c of LIST) [c.freeHealthcare, c.freeUniversity] = POLICY[c.id];

// Yearly tax on property you own there, as a share of its value. Countries
// left out charge none.
const PROPERTY_TAX = {
  us: 0.011, ca: 0.009, jp: 0.014, uk: 0.004, fr: 0.008, it: 0.006, es: 0.006, za: 0.007, ph: 0.01, ar: 0.006,
  co: 0.008, cl: 0.01, jm: 0.008, br: 0.005, se: 0.004, pt: 0.004, au: 0.003, de: 0.002, in: 0.002, kr: 0.002,
  ie: 0.002, pl: 0.002, tr: 0.002, mx: 0.001, nl: 0.001, ke: 0.001, nz: 0.004, dk: 0.007, gr: 0.005, pe: 0.004,
  no: 0.003, ch: 0.002, ru: 0.001, pk: 0.002, id: 0.001, sg: 0.006, do: 0.001,
  be: 0.006, my: 0.002,
};
for (const [id, r] of Object.entries(NEW_PLACES)) if (r[3][2]) PROPERTY_TAX[id] = r[3][2];
for (const c of LIST) c.propertyTax = PROPERTY_TAX[c.id] ?? 0;

// What kind of place each is, and how it relates to others (data/world.js).
for (const c of LIST) c.place = PLACES[c.id] ?? null;

// Living conditions (data/living.js). wageK and costK are what pay and local
// prices are multiplied by. The raw gaps between countries are softened so
// that every country stays playable while still feeling as rich or poor as it is.
for (const c of LIST) {
  const L = LIVING[c.id];
  c.living = { ...L, wageK: Math.round(L.wage ** 0.6 * 1000) / 1000, costK: Math.round(L.cost ** 0.85 * 1000) / 1000 };
  // Crisis and inflation can change during a life: read them through the living row, which knows (see data/living.js).
  for (const key of ['crisis', 'inflation']) Object.defineProperty(c.living, key, { enumerable: true, configurable: true, get: () => L[key] });
}

/** "1.1% a year" or "none", for display. */
export const propertyTaxLabel = (c) => (c.propertyTax ? `${(c.propertyTax * 100).toFixed(1).replace(/\.0$/, '')}% a year` : 'none');

/** @type {Object<string, ReturnType<typeof C>>} */
export const COUNTRIES = Object.fromEntries(LIST.map((c) => [c.id, c]));
export const COUNTRY_LIST = LIST;

/** Some countries change a surname's ending by gender (Kowalski, Kowalska). */
export function surnameFor(countryId, last, gender) {
  if (countryId !== 'pl') return last;
  return gender === 'female' ? last.replace(/(sk|ck|dzk)i$/, '$1a') : last.replace(/(sk|ck|dzk)a$/, '$1i');
}
