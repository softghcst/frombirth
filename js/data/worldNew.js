// Forty-eight places added by the Living World engine, in one compact table
// so that a new place is one row. countries.js, living.js and politics.js
// read their share of each row; nothing else needs to know this file exists.
//
// What is fact and what is game:
//   REFERENCE (real-world, compiled by hand, not machine-imported; see
//   docs/WORLD_DATA.md for sources and verification status):
//     name, flag, ISO 4217 currency code, cities, the broad shape of government.
//   GAMEPLAY ESTIMATES (deliberately simplified, not statistics):
//     currency scale (a fictional simulation rate, not a market quote),
//     tax rates, wage and cost levels, the 0-100 living scores, hazards.
//   LAW FLAGS (marriage, lgbt, gambling, death penalty, conscription):
//     the author's best understanding of the mid-2020s, UNVERIFIED against
//     legislation. Treat as gameplay configuration, not legal information.
//
// Row: [name, flag, [currency code, symbol, scale], [income tax, estate tax, property tax],
//       cities, [male names, female names, surnames],
//       [wage, cost, safety, health, infra, stability, graft, inflation, hazards, [marriage, lgbt, gambling, deathPenalty, conscription], crisis],
//       [free health care, free university], political system]
// Political system: ['P'|'M', head, seat, region, extra] | ['party', head, seat, region] | ['none']
const Y = true;
const N = false;
const MP = 'Member of Parliament';
const DEP = 'Deputy';

export const NEW_PLACES = {
  // ---------- North America and the Caribbean ----------
  aw: ['Aruba', '🇦🇼', ['AWG', 'ƒ', 1.8], [0.2, 0, 0.004], ['Oranjestad', 'San Nicolas', 'Noord'],
    ['Jairo Ruben Giovanni Marlon Edwin Rayen Kevin Stefan', 'Shanella Marisol Ruthmila Jenny Nathalie Zuleika Amy Francis', 'Croes Kelly Maduro Tromp Werleman Arends Geerman Dirksz Oduber Ras'],
    [0.5, 0.85, 82, 76, 88, 86, 20, 'low', ['heat'], [Y, 'equal', Y, N, N]], [Y, N], ['M', 'Prime Minister', MP, null]],
  bs: ['Bahamas', '🇧🇸', ['BSD', 'B$', 1], [0.08, 0, 0.008], ['Nassau', 'Freeport', 'Marsh Harbour'],
    ['Deandre Kendal Rashad Tevin Leroy Javon Dwight Carlton', 'Shanice Latoya Anya Kendra Paige Tamika Giselle Alicia', 'Rolle Ferguson Johnson Smith Knowles Bethel Moss Cartwright Pinder Strachan'],
    [0.6, 1.0, 56, 68, 80, 78, 30, 'low', ['hurricane', 'heat'], [N, 'limited', Y, N, N]], [N, N], ['M', 'Prime Minister', MP, null]],
  bz: ['Belize', '🇧🇿', ['BZD', 'BZ$', 2], [0.15, 0, 0.004], ['Belize City', 'Belmopan', 'San Ignacio', 'Orange Walk Town'],
    ['Kareem Jahmal Carlos Elroy Devon Emilio Shaquille Marvin', 'Shantel Kimberly Marisol Tanya Felicia Anita Jalissa Lupita', 'Flowers Castillo Young Usher Gillett Bradley Cal Tillett Coye Garbutt'],
    [0.16, 0.5, 44, 54, 60, 66, 52, 'low', ['hurricane', 'flood'], [N, 'limited', Y, N, N]], [N, N], ['M', 'Prime Minister', MP, null]],
  cr: ['Costa Rica', '🇨🇷', ['CRC', '₡', 520], [0.15, 0, 0.003], ['San José', 'Alajuela', 'Cartago', 'Heredia', 'Liberia', 'Limón'],
    ['Andrés Esteban Keylor Bryan Fabián Mauricio Josué Alonso', 'Valeria Daniela Fiorella Monserrat Ximena Karla Melany Priscilla', 'Vargas Rojas Mora Jiménez Solano Chaves Araya Quesada Zamora Calderón'],
    [0.28, 0.6, 62, 76, 76, 80, 40, 'low', ['earthquake', 'volcano', 'flood'], [Y, 'equal', Y, N, N]], [Y, N], ['P', 'President', DEP, 'Governor', { limit: 1 }]],
  sv: ['El Salvador', '🇸🇻', ['USD', '$', 1], [0.14, 0, 0.002], ['San Salvador', 'Santa Ana', 'San Miguel', 'Santa Tecla'],
    ['Óscar Kevin Wilber Nelson Edwin Josué Rodrigo Mauricio', 'Karla Yesenia Fátima Gabriela Wendy Roxana Katherine Marcela', 'Hernández Martínez Flores Rivas Portillo Guevara Orellana Alvarado Menjívar Escobar'],
    [0.12, 0.42, 60, 56, 62, 58, 54, 'low', ['earthquake', 'volcano', 'hurricane'], [N, 'limited', Y, N, N]], [N, N], ['P', 'President', DEP, 'Governor', { limit: 0 }]],
  gt: ['Guatemala', '🇬🇹', ['GTQ', 'Q', 7.8], [0.1, 0, 0.004], ['Guatemala City', 'Quetzaltenango', 'Antigua Guatemala', 'Escuintla', 'Cobán'],
    ['José Luis Marvin Selvin Erick Byron Juan Diego', 'María Lesly Heidy Andrea Dulce Mishell Ingrid Rosa', 'López Pérez Morales Ajú Tzul Cifuentes Barrios Monzón Castañeda Chávez'],
    [0.11, 0.42, 36, 46, 52, 48, 68, 'low', ['earthquake', 'volcano', 'hurricane'], [N, 'limited', Y, N, Y]], [N, N], ['P', 'President', DEP, 'Governor', { limit: 1, nativeOnly: true }]],
  ht: ['Haiti', '🇭🇹', ['HTG', 'G', 130], [0.1, 0, 0], ['Port-au-Prince', 'Cap-Haïtien', 'Gonaïves', 'Les Cayes', 'Jacmel'],
    ['Jean Wilner Stanley Frantz Emmanuel Ricardo Wesley Jameson', 'Marie Nadège Fabiola Roseline Esther Darline Judith Mirlande', 'Jean Pierre Joseph Louis Charles Baptiste Dorvil Augustin Désir Toussaint'],
    [0.03, 0.4, 12, 22, 20, 10, 86, 'high', ['hurricane', 'earthquake', 'flood'], [N, 'limited', Y, N, N], 'shortages'], [N, N], ['P', 'President', 'Senator', null, { limit: 1 }]],
  ni: ['Nicaragua', '🇳🇮', ['NIO', 'C$', 37], [0.12, 0, 0.004], ['Managua', 'León', 'Granada', 'Masaya', 'Matagalpa'],
    ['Carlos Denis Wilmer Bismarck Róger Norlan Yader Marlon', 'María Jahaira Scarleth Karen Tatiana Yessenia Kenia Ruth', 'Rodríguez Zeledón Gutiérrez Téllez Úbeda Membreño Sandoval Obando Aráuz Blandón'],
    [0.06, 0.36, 50, 48, 48, 30, 76, 'low', ['earthquake', 'volcano', 'hurricane'], [N, 'limited', Y, N, N]], [Y, Y], ['P', 'President', DEP, null, { rigged: true, limit: 0 }]],
  pa: ['Panama', '🇵🇦', ['PAB', 'B/.', 1], [0.15, 0, 0.005], ['Panama City', 'Colón', 'David', 'Santiago de Veraguas'],
    ['Rolando Aníbal Gabriel Jair Edgardo Omar Abdiel Iván', 'Yarisel Génesis Ana Maritza Kathia Zuleyka Nicole Lineth', 'González Rodríguez De_León Quintero Batista Cedeño Samudio Pinzón Villarreal Arosemena'],
    [0.3, 0.6, 54, 68, 74, 70, 56, 'low', ['flood', 'heat'], [N, 'limited', Y, N, N]], [N, N], ['P', 'President', DEP, 'Governor', { limit: 1, nativeOnly: true }]],
  pr: ['Puerto Rico', '🇵🇷', ['USD', '$', 1], [0.2, 0.1, 0.008], ['San Juan', 'Ponce', 'Mayagüez', 'Bayamón', 'Caguas', 'Arecibo'],
    ['José Luis Ángel Yadiel Héctor Javier Ramón Emmanuel', 'Yaritza Génesis Alondra Paola Zuleyka Ivelisse Camila Nashaly', 'Rivera Rodríguez Santiago Ortiz Colón Vázquez Torres Maldonado Negrón Figueroa'],
    [0.45, 0.8, 50, 68, 62, 64, 40, 'low', ['hurricane', 'earthquake', 'heat'], [Y, 'equal', Y, N, N]], [N, N], ['P', 'Governor', 'Senator', null, { limit: 0 }]],

  // ---------- South America ----------
  bo: ['Bolivia', '🇧🇴', ['BOB', 'Bs', 6.9], [0.13, 0, 0.004], ['La Paz', 'Santa Cruz de la Sierra', 'Cochabamba', 'Sucre', 'El Alto', 'Oruro'],
    ['Juan Rubén Limbert Álvaro Wilson Franz Edson Ronald', 'María Yoselin Ximena Noemí Lizeth Carla Daysi Jhoselyn', 'Mamani Quispe Condori Flores Choque Vargas Rojas Suárez Justiniano Colque'],
    [0.09, 0.36, 50, 48, 52, 44, 70, 'high', ['flood', 'drought'], [N, 'equal', Y, N, Y]], [N, Y], ['P', 'President', 'Senator', 'Governor', { nativeOnly: true }]],
  ec: ['Ecuador', '🇪🇨', ['USD', '$', 1], [0.12, 0.05, 0.003], ['Quito', 'Guayaquil', 'Cuenca', 'Ambato', 'Manta', 'Loja'],
    ['Jefferson Kléver Byron Stalin Darwin Andrés Cristian Jhon', 'María Génesis Nathaly Mishell Dayana Karla Domenica Lisseth', 'Zambrano Cedeño Vera Macías Guamán Quishpe Chávez Intriago Mendoza Toapanta'],
    [0.13, 0.42, 30, 56, 62, 40, 62, 'low', ['earthquake', 'volcano', 'flood'], [Y, 'equal', Y, N, N]], [Y, Y], ['P', 'President', 'Member of the National Assembly', 'Prefect', { nativeOnly: true }]],
  gy: ['Guyana', '🇬🇾', ['GYD', 'G$', 210], [0.2, 0, 0.004], ['Georgetown', 'Linden', 'New Amsterdam', 'Lethem'],
    ['Ravi Shemar Devon Anil Kwesi Rohan Troy Vishal', 'Shonette Anjali Tiffany Devika Latoya Priya Abiola Natasha', 'Persaud Singh Khan Williams Ramdeen Bacchus Benn Narine Fraser Hinds'],
    [0.2, 0.5, 44, 50, 52, 62, 58, 'low', ['flood'], [N, 'hostile', Y, N, N]], [Y, Y], ['P', 'President', MP, 'Regional Chairman', {}]],
  py: ['Paraguay', '🇵🇾', ['PYG', '₲', 7500], [0.1, 0, 0.004], ['Asunción', 'Ciudad del Este', 'Encarnación', 'San Lorenzo', 'Luque'],
    ['Derlis Óscar Blas Arnaldo Rodrigo Hernán Néstor Fabián', 'Liz Larissa Noelia Romina Fátima Gloria Leticia Belén', 'Benítez González Villalba Cáceres Ayala Duarte Giménez Riveros Ortigoza Báez'],
    [0.12, 0.38, 52, 54, 58, 60, 68, 'low', ['flood', 'drought', 'heat'], [N, 'limited', Y, N, Y]], [Y, N], ['P', 'President', 'Senator', 'Governor', { limit: 1, nativeOnly: true }]],
  uy: ['Uruguay', '🇺🇾', ['UYU', '$U', 40], [0.2, 0, 0.006], ['Montevideo', 'Salto', 'Paysandú', 'Punta del Este', 'Rivera'],
    ['Agustín Santiago Facundo Matías Nahuel Bruno Federico Gonzalo', 'Florencia Camila Valentina Agustina Micaela Julieta Sofía Lucía', 'Rodríguez Fernández Pereira Olivera Silva Techera Viera Cabrera Sosa Acosta'],
    [0.35, 0.7, 62, 78, 82, 86, 24, 'high', ['flood', 'drought'], [Y, 'equal', Y, N, N]], [Y, Y], ['P', 'President', 'Senator', 'Intendant', { limit: 1 }]],

  // ---------- Europe ----------
  ad: ['Andorra', '🇦🇩', ['EUR', '€', 0.9], [0.08, 0, 0.002], ['Andorra la Vella', 'Escaldes-Engordany', 'Encamp'],
    ['Marc Jordi Pau Oriol Arnau Guillem Èric Joan', 'Laia Núria Carla Mireia Aina Júlia Meritxell Clàudia', 'Vila Ribes Casal Font Naudi Torres Riba Pujol Armengol Areny'],
    [0.75, 0.95, 96, 88, 94, 92, 10, 'low', ['avalanche', 'winter'], [Y, 'equal', Y, N, N]], [N, N], ['M', 'Head of Government', 'General Councillor', null]],
  at: ['Austria', '🇦🇹', ['EUR', '€', 0.9], [0.32, 0, 0.002], ['Vienna', 'Graz', 'Linz', 'Salzburg', 'Innsbruck', 'Klagenfurt'],
    ['Lukas Maximilian Tobias Florian Jakob Elias Sebastian Fabian', 'Anna Lena Sophie Katharina Johanna Magdalena Theresa Valentina', 'Gruber Huber Wagner Pichler Steiner Moser Hofer Leitner Berger Eder'],
    [0.85, 0.95, 88, 90, 96, 86, 14, 'low', ['avalanche', 'flood', 'winter'], [Y, 'equal', Y, N, Y]], [Y, Y], ['M', 'Chancellor', 'Member of the National Council', 'Governor']],
  hr: ['Croatia', '🇭🇷', ['EUR', '€', 0.9], [0.24, 0.04, 0.002], ['Zagreb', 'Split', 'Rijeka', 'Osijek', 'Zadar', 'Dubrovnik'],
    ['Luka Ivan Marko Josip Petar Ante Matej Filip', 'Ana Marija Petra Lucija Ivana Maja Nika Tea', 'Horvat Kovačević Babić Marić Jurić Novak Knežević Vuković Perić Tomić'],
    [0.4, 0.62, 86, 78, 86, 80, 38, 'low', ['earthquake', 'wildfire', 'heat'], [N, 'equal', Y, N, Y]], [Y, N], ['M', 'Prime Minister', MP, 'County Prefect']],
  cz: ['Czech Republic', '🇨🇿', ['CZK', 'Kč', 23], [0.23, 0, 0.002], ['Prague', 'Brno', 'Ostrava', 'Plzeň', 'Olomouc', 'Liberec'],
    ['Jakub Jan Tomáš Matěj Ondřej Vojtěch Lukáš Petr', 'Tereza Eliška Anna Kateřina Lucie Barbora Veronika Karolína', 'Novák Svoboda Novotný Dvořák Černý Procházka Kučera Veselý Horák Němec'],
    [0.5, 0.65, 88, 84, 92, 84, 34, 'low', ['flood', 'winter'], [N, 'equal', Y, N, N]], [Y, Y], ['M', 'Prime Minister', DEP, 'Regional Governor']],
  ee: ['Estonia', '🇪🇪', ['EUR', '€', 0.9], [0.22, 0, 0.002], ['Tallinn', 'Tartu', 'Narva', 'Pärnu'],
    ['Rasmus Martin Kristjan Karl Markus Siim Tanel Oliver', 'Kadri Liis Mari Kristiina Laura Anett Triin Helena', 'Tamm Saar Sepp Mägi Kask Kukk Rebane Ilves Pärn Koppel'],
    [0.5, 0.68, 86, 80, 92, 84, 20, 'low', ['winter'], [Y, 'equal', Y, N, Y]], [Y, Y], ['M', 'Prime Minister', 'Member of the Riigikogu', null]],
  fi: ['Finland', '🇫🇮', ['EUR', '€', 0.9], [0.32, 0.1, 0.004], ['Helsinki', 'Tampere', 'Turku', 'Oulu', 'Espoo', 'Rovaniemi'],
    ['Eetu Onni Aleksi Juho Ville Mikko Lauri Antti', 'Aino Emma Sanni Veera Noora Iida Hanna Elina', 'Korhonen Virtanen Mäkinen Nieminen Mäkelä Hämäläinen Laine Heikkinen Koskinen Järvinen'],
    [0.85, 0.98, 92, 92, 98, 92, 6, 'low', ['winter'], [Y, 'equal', Y, N, Y]], [Y, Y], ['M', 'Prime Minister', MP, null]],
  hu: ['Hungary', '🇭🇺', ['HUF', 'Ft', 360], [0.2, 0.05, 0.002], ['Budapest', 'Debrecen', 'Szeged', 'Pécs', 'Győr', 'Miskolc'],
    ['Bence Máté Levente Ádám Dávid Balázs Gergő Zoltán', 'Anna Hanna Zsófia Réka Dóra Eszter Boglárka Lilla', 'Nagy Kovács Tóth Szabó Horváth Varga Kiss Molnár Németh Farkas'],
    [0.36, 0.58, 84, 72, 88, 66, 50, 'high', ['flood', 'heat'], [N, 'limited', Y, N, N]], [Y, N], ['M', 'Prime Minister', MP, null]],
  ro: ['Romania', '🇷🇴', ['RON', 'lei', 4.6], [0.2, 0, 0.002], ['Bucharest', 'Cluj-Napoca', 'Timișoara', 'Iași', 'Constanța', 'Brașov'],
    ['Andrei Alexandru Mihai Ionuț Ștefan Cristian Vlad Radu', 'Maria Elena Ioana Andreea Alexandra Ana Bianca Diana', 'Popescu Ionescu Popa Dumitru Stan Stoica Gheorghe Rusu Munteanu Matei'],
    [0.32, 0.5, 80, 66, 76, 70, 54, 'high', ['earthquake', 'flood', 'winter'], [N, 'limited', Y, N, N]], [Y, N], ['P', 'President', DEP, 'County Council President', {}]],
  rs: ['Serbia', '🇷🇸', ['RSD', 'din', 108], [0.18, 0, 0.003], ['Belgrade', 'Novi Sad', 'Niš', 'Kragujevac', 'Subotica'],
    ['Nikola Stefan Luka Marko Aleksandar Miloš Filip Dušan', 'Milica Jovana Ana Teodora Marija Katarina Sara Nina', 'Jovanović Petrović Nikolić Marković Đorđević Stojanović Ilić Pavlović Milošević Kostić'],
    [0.26, 0.48, 78, 68, 76, 60, 58, 'high', ['flood', 'heat'], [N, 'limited', Y, N, N]], [Y, N], ['M', 'Prime Minister', 'Member of the National Assembly', null]],
  sk: ['Slovakia', '🇸🇰', ['EUR', '€', 0.9], [0.22, 0, 0.002], ['Bratislava', 'Košice', 'Prešov', 'Žilina', 'Nitra', 'Banská Bystrica'],
    ['Jakub Samuel Adam Martin Tomáš Michal Lukáš Peter', 'Sofia Nina Natália Viktória Kristína Ema Lucia Zuzana', 'Horváth Kováč Varga Tóth Nagy Baláž Szabó Molnár Lukáč Novák'],
    [0.42, 0.6, 86, 76, 88, 74, 44, 'low', ['flood', 'winter'], [N, 'limited', Y, N, N]], [Y, Y], ['M', 'Prime Minister', 'Member of the National Council', 'Regional President']],

  // ---------- Africa ----------
  dz: ['Algeria', '🇩🇿', ['DZD', 'DA', 135], [0.2, 0, 0.002], ['Algiers', 'Oran', 'Constantine', 'Annaba', 'Blida', 'Sétif'],
    ['Mohamed Amine Yacine Karim Riad Sofiane Walid Nassim', 'Amina Yasmine Lina Meriem Sarah Imane Nesrine Rania', 'Bouzid Benali Saïdi Mansouri Belkacem Haddad Cherif Brahimi Zerrouki Hamdi'],
    [0.14, 0.34, 66, 60, 68, 54, 62, 'high', ['earthquake', 'heat', 'drought'], [N, 'hostile', N, N, Y]], [Y, Y], ['P', 'President', DEP, 'Wali', { rigged: true, nativeOnly: true }]],
  ao: ['Angola', '🇦🇴', ['AOA', 'Kz', 900], [0.15, 0, 0.002], ['Luanda', 'Huambo', 'Lobito', 'Benguela', 'Lubango'],
    ['João Manuel Edson Nelson Adilson Gelson Mário Kiluanje', 'Maria Ana Jéssica Luísa Neusa Yola Weza Esperança', 'Dos_Santos Domingos Francisco António Manuel Pedro Lourenço Sebastião Neto Bumba'],
    [0.07, 0.45, 40, 34, 36, 50, 76, 'high', ['drought', 'flood', 'heat'], [N, 'limited', Y, N, Y]], [N, N], ['P', 'President', DEP, 'Governor', { rigged: true }]],
  dj: ['Djibouti', '🇩🇯', ['DJF', 'Fdj', 178], [0.15, 0, 0], ['Djibouti City', 'Ali Sabieh', 'Tadjoura', 'Obock'],
    ['Abdi Hassan Mahamoud Ismaïl Omar Moussa Ahmed Youssouf', 'Fatouma Hawa Amina Kadra Zeinab Halimo Saada Roukia', 'Guelleh Farah Dirieh Waberi Houmed Aden Robleh Ali Barkat Egueh'],
    [0.09, 0.5, 60, 36, 44, 58, 70, 'low', ['heat', 'drought'], [N, 'limited', Y, N, N]], [N, N], ['P', 'President', DEP, null, { rigged: true, limit: 0 }]],
  cd: ['Democratic Republic of the Congo', '🇨🇩', ['CDF', 'FC', 2800], [0.15, 0, 0], ['Kinshasa', 'Lubumbashi', 'Mbuji-Mayi', 'Goma', 'Kisangani', 'Bukavu'],
    ['Jean Patrick Christian Trésor Héritier Glody Dieudonné Fiston', 'Marie Grâce Esther Ruth Sifa Chantal Divine Naomie', 'Kabila Ilunga Mukendi Tshibangu Kasongo Mbuyi Ngoy Lukusa Mutombo Kalala'],
    [0.02, 0.32, 20, 20, 16, 14, 88, 'high', ['flood', 'volcano', 'heat'], [N, 'limited', Y, N, N], 'war'], [N, N], ['P', 'President', DEP, 'Governor', { nativeOnly: true }]],
  et: ['Ethiopia', '🇪🇹', ['ETB', 'Br', 120], [0.15, 0, 0], ['Addis Ababa', 'Dire Dawa', 'Bahir Dar', 'Hawassa', 'Mekelle', 'Gondar'],
    ['Abebe Dawit Yonas Tesfaye Henok Bereket Samuel Getachew', 'Tigist Meron Selam Hiwot Bethlehem Rahel Kidist Hanna', 'Tesfaye Bekele Girma Haile Tadesse Kebede Alemu Desta Mulugeta Worku'],
    [0.03, 0.3, 42, 30, 30, 26, 68, 'high', ['drought', 'flood'], [N, 'hostile', Y, N, N]], [N, N], ['M', 'Prime Minister', 'Member of the House of Peoples\' Representatives', 'Regional President', { rigged: true }]],
  tn: ['Tunisia', '🇹🇳', ['TND', 'DT', 3.1], [0.2, 0, 0.002], ['Tunis', 'Sfax', 'Sousse', 'Kairouan', 'Bizerte', 'Gabès'],
    ['Mohamed Ahmed Youssef Aymen Hamza Bilel Skander Wassim', 'Mariem Yasmine Nour Ines Amal Sirine Rim Emna', 'Trabelsi Ben_Ali Gharbi Jlassi Hammami Bouazizi Chaabane Mejri Dridi Ayari'],
    [0.12, 0.32, 66, 62, 70, 52, 56, 'high', ['heat', 'drought'], [N, 'hostile', Y, N, Y]], [Y, Y], ['P', 'President', DEP, 'Governor', { rigged: true }]],
  ug: ['Uganda', '🇺🇬', ['UGX', 'USh', 3700], [0.15, 0, 0], ['Kampala', 'Gulu', 'Mbarara', 'Jinja', 'Entebbe', 'Mbale'],
    ['Brian Ivan Emmanuel Moses Derrick Ronald Joseph Isaac', 'Sarah Grace Esther Patience Joan Mercy Brenda Shamim', 'Okello Mukasa Ssemakula Nakato Tumusiime Opio Kato Byaruhanga Namara Ochieng'],
    [0.03, 0.3, 48, 34, 36, 46, 76, 'low', ['flood', 'drought'], [N, 'hostile', Y, N, N]], [N, N], ['P', 'President', MP, null, { rigged: true, limit: 0, nativeOnly: true }]],
  zw: ['Zimbabwe', '🇿🇼', ['ZWG', 'ZiG', 27], [0.2, 0.05, 0.002], ['Harare', 'Bulawayo', 'Mutare', 'Gweru', 'Victoria Falls'],
    ['Tendai Tatenda Farai Tinashe Kudakwashe Takudzwa Simba Blessing', 'Rudo Tariro Chipo Nyasha Rutendo Tsitsi Ruvimbo Fadzai', 'Moyo Ncube Sibanda Dube Ndlovu Mpofu Chikwanha Mutasa Nyoni Marufu'],
    [0.04, 0.4, 52, 34, 34, 36, 80, 'extreme', ['drought', 'flood'], [N, 'hostile', Y, N, N], 'inflation'], [N, N], ['P', 'President', MP, 'Minister of State for the Province', { rigged: true }]],

  // ---------- "Middle East" reference grouping ----------
  ge: ['Georgia', '🇬🇪', ['GEL', '₾', 2.7], [0.2, 0, 0.002], ['Tbilisi', 'Batumi', 'Kutaisi', 'Rustavi', 'Zugdidi'],
    ['Giorgi Luka Nika Davit Saba Irakli Levan Zurab', 'Nino Mariam Ana Tamar Salome Elene Ketevan Natia', 'Beridze Kapanadze Gelashvili Maisuradze Giorgadze Lomidze Tsiklauri Kvaratskhelia Bolkvadze Mamulashvili'],
    [0.16, 0.42, 82, 62, 72, 48, 44, 'low', ['earthquake', 'flood', 'avalanche'], [N, 'limited', Y, N, Y]], [N, N], ['M', 'Prime Minister', MP, 'State Representative']],
  ir: ['Iran', '🇮🇷', ['IRR', '﷼', 600000], [0.15, 0, 0.002], ['Tehran', 'Mashhad', 'Isfahan', 'Shiraz', 'Tabriz', 'Karaj'],
    ['Ali Mohammad Reza Amir Hossein Mehdi Arash Kian', 'Fatemeh Zahra Sara Maryam Niloufar Parisa Yasaman Shirin', 'Mohammadi Hosseini Ahmadi Rezaei Karimi Moradi Jafari Sadeghi Rahimi Ebrahimi'],
    [0.08, 0.24, 66, 64, 70, 34, 70, 'extreme', ['earthquake', 'drought', 'heat'], [N, 'hostile', N, Y, Y], 'sanctions'], [N, N], ['none']],
  iq: ['Iraq', '🇮🇶', ['IQD', 'ID', 1310], [0.1, 0, 0.002], ['Baghdad', 'Basra', 'Mosul', 'Erbil', 'Najaf', 'Sulaymaniyah'],
    ['Ali Hussein Mustafa Ahmed Karrar Omar Sajjad Haider', 'Zainab Fatima Noor Maryam Sara Rand Tabarak Hawraa', 'Al-Jubouri Al-Tamimi Al-Obaidi Al-Saadi Al-Maliki Al-Dulaimi Al-Zubaidi Barzani Al-Khafaji Al-Rubaie'],
    [0.12, 0.34, 34, 44, 40, 24, 80, 'low', ['heat', 'drought', 'flood'], [N, 'hostile', N, Y, N]], [Y, Y], ['M', 'Prime Minister', 'Member of the Council of Representatives', 'Governor']],
  il: ['Israel', '🇮🇱', ['ILS', '₪', 3.7], [0.28, 0, 0.004], ['Jerusalem', 'Tel Aviv', 'Haifa', 'Be\'er Sheva', 'Netanya', 'Eilat'],
    ['Noam David Yosef Ori Eitan Daniel Itai Omer', 'Tamar Noa Maya Shira Yael Talia Avigail Adi', 'Cohen Levi Mizrahi Peretz Biton Dahan Friedman Azoulay Katz Shapiro'],
    [0.8, 1.05, 54, 90, 90, 36, 30, 'low', ['heat', 'drought', 'earthquake'], [N, 'equal', Y, N, Y]], [Y, N], ['M', 'Prime Minister', 'Member of the Knesset', null]],
  lb: ['Lebanon', '🇱🇧', ['LBP', 'L£', 89500], [0.12, 0.05, 0.002], ['Beirut', 'Tripoli', 'Sidon', 'Tyre', 'Zahlé', 'Jounieh'],
    ['Elie Charbel Ali Hassan Georges Karim Rami Tony', 'Maya Rita Nour Lea Zeinab Christelle Yara Rana', 'Khoury Haddad Saad Nasser Hariri Aoun Karam Sleiman Fakhoury Daher'],
    [0.07, 0.42, 44, 56, 30, 22, 76, 'extreme', ['earthquake', 'wildfire', 'heat'], [N, 'hostile', Y, N, N], 'collapse'], [N, N], ['M', 'Prime Minister', MP, 'Governor']],
  sy: ['Syria', '🇸🇾', ['SYP', 'S£', 13000], [0.1, 0, 0], ['Damascus', 'Aleppo', 'Homs', 'Latakia', 'Hama', 'Tartus'],
    ['Mohammad Ahmad Omar Khaled Yazan Bashar Majd Samer', 'Rama Lama Hala Rahaf Sham Batoul Dima Reem', 'Al-Ahmad Al-Hassan Al-Ali Haddad Al-Khatib Al-Masri Darwish Shaheen Al-Najjar Khalil'],
    [0.02, 0.22, 16, 28, 22, 10, 86, 'extreme', ['drought', 'earthquake', 'heat'], [N, 'hostile', N, Y, N], 'shortages'], [N, N], ['none']],

  // ---------- Asia ----------
  af: ['Afghanistan', '🇦🇫', ['AFN', '؋', 70], [0.1, 0, 0], ['Kabul', 'Kandahar', 'Herat', 'Mazar-i-Sharif', 'Jalalabad'],
    ['Ahmad Mohammad Abdullah Farid Hamid Jawid Mirwais Rahim', 'Fatima Zahra Mariam Shabnam Laila Parwana Nargis Freshta', 'Ahmadi Noori Rahimi Karimi Durrani Popal Stanekzai Wardak Hotak Azizi'],
    [0.02, 0.22, 14, 20, 20, 12, 84, 'high', ['earthquake', 'drought', 'winter', 'flood'], [N, 'hostile', N, Y, N], 'shortages'], [N, N], ['none']],
  bd: ['Bangladesh', '🇧🇩', ['BDT', '৳', 120], [0.1, 0, 0.002], ['Dhaka', 'Chattogram', 'Khulna', 'Rajshahi', 'Sylhet', 'Cox\'s Bazar'],
    ['Rahim Tanvir Sakib Arif Imran Rakib Mehedi Nayeem', 'Fatema Nusrat Sadia Tasnim Sumaiya Farzana Jannat Mim', 'Rahman Islam Hossain Ahmed Chowdhury Akter Khan Sarkar Uddin Mia'],
    [0.05, 0.26, 52, 42, 44, 40, 74, 'high', ['flood', 'typhoon', 'heat'], [N, 'hostile', N, Y, N]], [N, N], ['M', 'Prime Minister', MP, null]],
  hk: ['Hong Kong', '🇭🇰', ['HKD', 'HK$', 7.8], [0.14, 0, 0.004], ['Central and Western', 'Kowloon City', 'Sha Tin', 'Tsuen Wan', 'Yuen Long'],
    ['Ka_Ho Chun_Kit Wai_Lok Tsz_Hin Ho_Yin Kin_Fung Jason Marco', 'Wing_Yan Hoi_Ching Tsz_Ching Ka_Yee Sze_Wing Yuen_Ting Karen Vivian', 'Chan Wong Lee Cheung Lau Ng Leung Ho Yeung Tsang'],
    [0.85, 1.3, 94, 90, 98, 64, 16, 'low', ['typhoon', 'heat'], [N, 'limited', Y, N, N]], [Y, N], ['party', 'Chief Executive', 'Member of the Legislative Council', null]],
  kz: ['Kazakhstan', '🇰🇿', ['KZT', '₸', 480], [0.1, 0, 0.002], ['Astana', 'Almaty', 'Shymkent', 'Karaganda', 'Aktobe', 'Atyrau'],
    ['Nursultan Alikhan Daniyar Yerlan Timur Arman Sanzhar Aibek', 'Aigerim Madina Dana Aruzhan Kamila Zarina Ainur Saule', 'Akhmetov Nurlanov Sadykov Omarov Suleimenov Zhakupov Kassymov Abenov Tulegenov Mukhametov'],
    [0.2, 0.4, 76, 62, 72, 56, 64, 'high', ['winter', 'drought', 'heat'], [N, 'limited', Y, N, Y]], [Y, N], ['P', 'President', 'Deputy of the Mazhilis', 'Akim', { rigged: true, limit: 1 }]],
  mn: ['Mongolia', '🇲🇳', ['MNT', '₮', 3400], [0.1, 0, 0.002], ['Ulaanbaatar', 'Erdenet', 'Darkhan', 'Choibalsan'],
    ['Bat-Erdene Temuulen Ganbold Munkh-Erdene Tuguldur Bilguun Enkhbayar Altan', 'Nomin Anujin Sarnai Oyun Bolormaa Khulan Enkhjin Tsetseg', 'Bat Dorj Ganbaatar Purev Sukhbaatar Otgon Tsend Lkhagva Jargal Byamba'],
    [0.12, 0.36, 72, 54, 56, 68, 60, 'high', ['winter', 'drought'], [N, 'limited', N, N, Y]], [Y, N], ['M', 'Prime Minister', 'Member of the State Great Khural', 'Governor']],
  np: ['Nepal', '🇳🇵', ['NPR', 'Rs', 135], [0.1, 0, 0.002], ['Kathmandu', 'Pokhara', 'Lalitpur', 'Biratnagar', 'Bharatpur'],
    ['Bibek Sujan Prakash Roshan Anish Kiran Sagar Nabin', 'Sita Anjali Pooja Sabina Asmita Srijana Kabita Nisha', 'Shrestha Gurung Tamang Thapa Rai Karki Adhikari Magar Poudel Bhandari'],
    [0.04, 0.26, 70, 42, 40, 44, 68, 'low', ['earthquake', 'flood', 'avalanche'], [N, 'equal', Y, N, N]], [N, N], ['M', 'Prime Minister', MP, 'Chief Minister']],
  tw: ['Taiwan', '🇹🇼', ['TWD', 'NT$', 32], [0.14, 0.1, 0.004], ['Taipei', 'Kaohsiung', 'Taichung', 'Tainan', 'Hsinchu', 'Hualien'],
    ['Chih-Wei Chia-Hao Yu-Hsiang Po-Han Tsung-Han Kuan-Yu Jay Kevin', 'Yi-Chun Ya-Ting Shu-Fen Pei-Shan Hsin-Yi Chia-Ling Emily Vivian', 'Chen Lin Huang Chang Lee Wang Wu Liu Tsai Yang'],
    [0.5, 0.62, 92, 90, 94, 72, 20, 'low', ['typhoon', 'earthquake', 'heat'], [Y, 'equal', Y, Y, Y]], [Y, N], ['P', 'President', 'Legislator', 'Mayor', {}]],

  // ---------- Oceania ----------
  pg: ['Papua New Guinea', '🇵🇬', ['PGK', 'K', 4], [0.2, 0, 0], ['Port Moresby', 'Lae', 'Mount Hagen', 'Madang', 'Kokopo'],
    ['Michael John Peter Elijah Kila Tau Vagi Samuel', 'Mary Grace Ruth Geua Kori Dika Serah Joyce', 'Kila Tau Vele Wari Kuman Yama Sapa Morea Aihi Gabi'],
    [0.07, 0.5, 24, 30, 28, 42, 76, 'low', ['earthquake', 'volcano', 'flood'], [N, 'hostile', Y, N, N]], [N, N], ['M', 'Prime Minister', MP, 'Governor']],
  ws: ['Samoa', '🇼🇸', ['WST', 'WS$', 2.7], [0.15, 0, 0], ['Apia', 'Salelologa', 'Mulifanua'],
    ['Sione Tavita Ioane Pita Mikaele Fa\'afetai Lemalu Tui', 'Sina Mele Lagi Ana Tala Losa Fetu Sefina', 'Tuilagi Leota Faleolo Tuala Masoe Seiuli Lauina Toleafoa Aiono Salave\'a'],
    [0.09, 0.45, 74, 50, 58, 78, 44, 'low', ['typhoon', 'earthquake', 'volcano'], [N, 'hostile', N, N, N]], [N, N], ['M', 'Prime Minister', MP, null]],
};
