/** Named commercial fronts for Yaoundé game world (mix of real-inspired + local style). */
export const LANDMARK_SIGN_TEXT: Record<string, { title: string; subtitle?: string; color: number; text: number }> = {
  'player-house': { title: 'MAISON DU JOUEUR', subtitle: 'TA RÉSIDENCE', color: 0x37474f, text: 0xffc857 },
  'santa-lucia': { title: 'SANTA LUCIA', subtitle: 'GRAND SUPERMARKET', color: 0x1b5e20, text: 0xffffff },
  'mfoundi-mall': { title: 'MFOUNDI MALL', subtitle: 'CENTRE COMMERCIAL', color: 0x0d47a1, text: 0xffc857 },
  'travelpoint-centre': { title: 'TRAVELPOINT', subtitle: 'CAMEROON', color: 0x0d47a1, text: 0xffffff },
  'nsimalen-airport': { title: 'AÉROPORT', subtitle: 'YAOUNDÉ-NSIMALEN', color: 0x0d47a1, text: 0xffffff },
  'palais-etoudi': { title: "PALAIS DE L'UNITÉ", subtitle: 'ETOUDI', color: 0x0d47a1, text: 0xffc857 },
  'agence-voyage-mvan': { title: 'AGENCE 237', subtitle: 'GARE MVAN', color: 0x0d47a1, text: 0xffc857 },
  'universite-ngoa-ekelle': { title: 'UNIVERSITÉ', subtitle: 'YAOUNDÉ I · NGOA', color: 0xb71c1c, text: 0xffffff },
  'marche-mokolo': { title: 'MARCHÉ MOKOLO', subtitle: 'TEXTILES · VIVRES', color: 0x00897b, text: 0xffc857 },
  'habitations-essos': { title: 'CITÉ ESSOS', subtitle: 'HABITATIONS', color: 0x039be5, text: 0xffffff },
  'habitations-mendong': { title: 'LOTISSEMENT', subtitle: 'MENDONG', color: 0x43a047, text: 0xffffff },
  'palais-odza': { title: 'PALAIS ODZA', subtitle: 'RÉSIDENCES', color: 0x8e24aa, text: 0xffc857 },
  'biyem-assi-cite-ecole': { title: 'BIYEM-ASSI', subtitle: 'CITÉ & ÉCOLE', color: 0xfb8c00, text: 0xffffff },
};

const SHOP_NAMES = [
  'Santa Lucia Express',
  'DOVV Market',
  'Boutique Nouvelle',
  'Cash & Carry 237',
  'Super U Quartier',
  'Pharmacie du Centre',
  'Total Energies',
  'MRS Station',
  'MTN Shop',
  'Orange Store',
  'Camtel Point',
  'Boulangerie Moderne',
  'Restaurant Sawa',
  'Snack Capita',
  'Pressing Express',
  'Coiffure Divine',
  'Quincaillerie Bastos',
  'Librairie Mentoum',
  'Cyber Café Nexus',
  'Boutique Hijab',
  'Electroménager Plus',
  'Gaz & Feu',
  'Boucherie Halal',
  'Poissonnerie Mfoundi',
  'Pagnes & Wax',
  'Alpha Motors Parts',
  'Jetour Showroom',
  'Prado Service',
  'Tesla Point Yaoundé',
  'Clinique La Grâce',
  'Optique Vision',
  'Banque Atlantique',
  'Afriland First',
  'Express Union',
  'Western Union',
  'Hotel Prestige',
  'Motel Le Relais',
  'École Les Bambins',
  'Café des Palmiers',
  'Marché Vivrier',
];

const FUEL_NAMES = ['Total Energies', 'MRS', 'Tradex', 'Oil Libya', 'Camrail Fuel', 'Station Centre'];
const CLINIC_NAMES = ['Pharmacie du Peuple', 'Clinique La Grâce', 'Centre Médical Espoir', 'Pharmacie Santa', 'Polyclinique Biyem'];
const MARKET_NAMES = ['Marché Vivrier', 'Étals du Quartier', 'Marché Central Mini', 'Hall des Vivres', 'Boutiques Mokolo Style'];

export function shopNameFor(kind: string, x: number, z: number): string {
  const h = Math.abs(Math.floor(x * 7.1 + z * 13.7)) >>> 0;
  if (kind === 'fuel') return FUEL_NAMES[h % FUEL_NAMES.length]!;
  if (kind === 'clinic') return CLINIC_NAMES[h % CLINIC_NAMES.length]!;
  if (kind === 'market') return MARKET_NAMES[h % MARKET_NAMES.length]!;
  return SHOP_NAMES[h % SHOP_NAMES.length]!;
}
