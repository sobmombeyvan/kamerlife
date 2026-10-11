import type { Business, BusinessCategory, BusinessDatabase } from './types';

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const WEEK = [1, 2, 3, 4, 5, 6];

function biz(
  id: string,
  name: string,
  category: BusinessCategory,
  districtId: string,
  x: number,
  z: number,
  products: Array<[string, string, number]>,
  opts?: Partial<Business>,
): Business {
  return {
    id,
    name,
    category,
    districtId,
    x,
    z,
    fictional: opts?.fictional ?? true,
    landmarkReal: opts?.landmarkReal,
    signColor: opts?.signColor ?? categoryColor(category),
    hours: opts?.hours ?? { open: '08:00', close: '20:00', days: WEEK },
    products: products.map(([pid, pname, price]) => ({
      id: pid,
      name: pname,
      priceFcfa: price,
      category,
    })),
    interaction: opts?.interaction ?? 'menu',
    notes: opts?.notes,
  };
}

function categoryColor(c: BusinessCategory): string {
  const map: Partial<Record<BusinessCategory, string>> = {
    supermarket: '#1565c0',
    grocery: '#2e7d32',
    restaurant: '#c62828',
    fastfood: '#ef6c00',
    cafe: '#6d4c41',
    bakery: '#f9a825',
    electronics: '#0277bd',
    fashion: '#ad1457',
    bank: '#283593',
    pharmacy: '#00897b',
    clinic: '#e53935',
    hospital: '#b71c1c',
    fuel: '#fbc02d',
    garage: '#455a64',
    hotel: '#5e35b1',
    nightlife: '#6a1b9a',
    market: '#ff8f00',
    furniture: '#5d4037',
    logistics: '#37474f',
    education: '#1565c0',
    admin: '#37474f',
  };
  return map[c] ?? '#546e7a';
}

/** Phase 1 seed: named fictional businesses placed on the map (data only). */
export function createSeedBusinessDatabase(): BusinessDatabase {
  const businesses: Business[] = [
    // Centre-ville + major landmarks (data layer; 3D exteriors exist — interiors later)
    biz('cv_santa_lucia', 'Santa Lucia Grand Supermarket', 'supermarket', 'centre-ville', 108, 108, [['rice', 'Riz 5kg', 3600], ['oil', 'Huile 1L', 1300], ['water', 'Eau pack', 2500], ['bread', 'Pain', 350]], { fictional: false, landmarkReal: false, hours: { open: '08:00', close: '21:00', days: ALL_DAYS }, notes: 'Real brand name; game-world placement — not a verified real branch. Exterior in 3D; checkout not implemented.' }),
    biz('cv_mfoundi_mall', 'Mfoundi Mall', 'other', 'centre-ville', -108, 180, [['directory', 'Plan du mall (fictif)', 0]], { hours: { open: '09:00', close: '21:00', days: ALL_DAYS }, notes: 'Major landmark exterior in 3D. Store modules listed — interiors not playable yet.' }),
    biz('cv_travelpoint', 'TravelPoint Cameroon', 'admin', 'centre-ville', -36, -36, [['ticket_bus', 'Billet bus fictif YDE→DLA', 8500], ['ticket_flight', 'Billet avion fictif', 85000]], { hours: { open: '08:00', close: '18:00', days: WEEK }, notes: 'Booking UI not implemented. Tickets are fictional game data only.' }),
    biz('ns_airport', 'Aéroport International de Yaoundé-Nsimalen', 'other', 'centre-ville', 216, 1080, [['taxi_drop', 'Course taxi (tarif indicatif)', 5000]], { fictional: false, landmarkReal: true, hours: { open: '00:00', close: '23:59', days: ALL_DAYS }, notes: 'Landmark extérieur 3D Phase 1. Pas d’enregistrement ni vols simulés complets.' }),
    biz('cv_carrefour', 'Carrefour du Centre', 'supermarket', 'centre-ville', 120, -80, [['rice', 'Riz 5kg', 3500], ['oil', 'Huile 1L', 1200], ['soap', 'Savon', 500]], { hours: { open: '08:00', close: '21:00', days: ALL_DAYS } }),
    biz('cv_citymarket', 'CityMarket Yaoundé', 'supermarket', 'centre-ville', -140, 60, [['water', 'Eau 1.5L', 400], ['milk', 'Lait', 900]]),
    biz('cv_mboa_bank', 'Mboa Bank', 'bank', 'centre-ville', 80, 40, [['fee', 'Frais retrait', 200]], { interaction: 'atm', hours: { open: '08:00', close: '16:00', days: WEEK } }),
    biz('cv_horizon_bank', 'Horizon Bank', 'bank', 'centre-ville', -60, -100, [['fee', 'Frais transfert', 300]], { interaction: 'counter' }),
    biz('cv_cafe_central', 'Café Central', 'cafe', 'centre-ville', 40, 120, [['coffee', 'Café', 800], ['croissant', 'Croissant', 500]]),
    biz('cv_hotel_centre', 'Hôtel du Centre', 'hotel', 'centre-ville', 200, 40, [['room', 'Chambre nuit', 25000]]),
    biz('cv_pharmacie_centre', 'Pharmacie du Centre', 'pharmacy', 'centre-ville', -100, -40, [['paracetamol', 'Paracétamol (fictif)', 1500]], { notes: 'Items fictifs — pas de conseil médical réel.' }),
    biz('cv_poste', 'Bureau de Poste', 'admin', 'centre-ville', 160, -160, [['stamp', 'Affranchissement', 250]], { fictional: false, landmarkReal: false, notes: 'Bureau de jeu inspiré — placement provisoire.' }),
    biz('cv_cinema', 'Cinema Central', 'nightlife', 'centre-ville', -180, 140, [['ticket', 'Ticket film', 3000]]),
    biz('cv_rich_telecom', 'Rich Telecom', 'electronics', 'centre-ville', 220, -40, [['phone_case', 'Coque téléphone', 2500], ['earbuds', 'Écouteurs', 8000]]),

    // Avenue Kennedy — phone retail strip
    biz('ak_mtn', 'MTN Mobile Shop', 'electronics', 'avenue-kennedy', 30, 198, [['tecno', 'Tecno Spark', 85000], ['sim', 'SIM + crédit', 2000], ['coque', 'Coque', 2500]], { hours: { open: '08:00', close: '20:00', days: ALL_DAYS } }),
    biz('ak_orange', 'Orange Boutique Kennedy', 'electronics', 'avenue-kennedy', 48, 198, [['phone', 'Smartphone', 99000], ['momo', 'Kit MoMo', 1500]], { hours: { open: '08:00', close: '20:00', days: ALL_DAYS } }),
    biz('ak_tecno', 'Tecno Store Kennedy', 'electronics', 'avenue-kennedy', 96, 198, [['spark', 'Tecno Spark', 85000], ['camon', 'Tecno Camon', 125000]]),
    biz('ak_infinix', 'Infinix Corner', 'electronics', 'avenue-kennedy', 112, 198, [['hot', 'Infinix Hot', 95000], ['note', 'Infinix Note', 135000]]),
    biz('ak_samsung', 'Samsung Partner Kennedy', 'electronics', 'avenue-kennedy', 128, 198, [['galaxy', 'Galaxy A', 145000], ['buds', 'Écouteurs', 25000]]),
    biz('ak_ibox', 'iBox Kennedy', 'electronics', 'avenue-kennedy', 160, 198, [['iphone', 'iPhone recond.', 220000], ['airpods', 'Écouteurs', 45000]]),
    biz('ak_access', 'Accessoires 237', 'electronics', 'avenue-kennedy', 176, 198, [['charger', 'Chargeur rapide', 4500], ['glass', 'Verre trempé', 2000]]),
    biz('ak_phonecity', 'Phone City Kennedy', 'electronics', 'avenue-kennedy', 100, 234, [['phone', 'Smartphone', 110000], ['powerbank', 'Powerbank', 8000]]),
    biz('ak_gsm', 'GSM Express Kennedy', 'electronics', 'avenue-kennedy', 118, 234, [['unlock', 'Déblocage (fictif)', 5000], ['repair', 'Réparation écran', 25000]]),

    // Bastos
    biz('ba_terrasse', 'La Terrasse de Bastos', 'restaurant', 'bastos', 280, -2600, [['ndole', 'Ndolé', 4500], ['poulet_dg', 'Poulet DG', 5500]]),
    biz('ba_coffee', 'Coffee House Bastos', 'cafe', 'bastos', 340, -2500, [['latte', 'Café latte', 1500]]),
    biz('ba_elegance', 'Élégance Bastos', 'fashion', 'bastos', 200, -2700, [['dress', 'Robe', 18000], ['shirt', 'Chemise', 12000]]),
    biz('ba_rooftop', 'Le Rooftop de Bastos', 'nightlife', 'bastos', 380, -2400, [['cocktail', 'Boisson', 3500]]),
    biz('ba_residence', 'Résidence Bastos', 'hotel', 'bastos', 160, -2550, [['suite', 'Suite', 45000]]),
    biz('ba_clinique', 'Clinique de Bastos', 'clinic', 'bastos', 420, -2750, [['consult', 'Consultation (fictive)', 10000]]),

    // Mokolo
    biz('mo_marche', 'Marché Mokolo', 'market', 'mokolo', -600, -400, [['tomato', 'Tomates kg', 800], ['fabric', 'Pagne', 5000]], { interaction: 'stall', hours: { open: '06:00', close: '18:00', days: ALL_DAYS }, notes: 'Inspiré du marché réel — placement provisoire.' }),
    biz('mo_street', 'Street Food 237', 'fastfood', 'mokolo', -520, -360, [['soya', 'Soya', 500], ['plantain', 'Plantain', 700]]),
    biz('mo_mobile', 'Mobile 237', 'electronics', 'mokolo', -680, -320, [['charger', 'Chargeur', 3500]]),
    biz('mo_boutique', 'Boutique du Marché', 'fashion', 'mokolo', -560, -480, [['tee', 'T-shirt', 4000]]),

    // Mendong
    biz('md_superu', 'Super U Express', 'supermarket', 'mendong', -420, -4500, [['rice', 'Riz 5kg', 3400], ['beans', 'Haricots', 1500]]),
    biz('md_chez_mama', 'Chez Mama Épicerie', 'grocery', 'mendong', -360, -4400, [['bread', 'Pain', 300], ['eggs', 'Œufs x6', 1200]]),
    biz('md_garage', 'Garage du Centre', 'garage', 'mendong', -480, -4600, [['oil_change', 'Vidange', 15000]]),
    biz('md_snack', 'Snack du Quartier', 'fastfood', 'mendong', -300, -4550, [['brochette', 'Brochette', 600]]),
    biz('md_ecole', 'École Les Petits Génies', 'education', 'mendong', -500, -4700, [['fees', 'Frais inscription (fictifs)', 50000]]),

    // Biyem-Assi
    biz('by_marche', 'Marché de Biyem-Assi', 'market', 'biyem-assi', -3200, 400, [['veg', 'Légumes', 1000]], { interaction: 'stall' }),
    biz('by_miniprix', 'Mini Prix', 'supermarket', 'biyem-assi', -3100, 480, [['soap', 'Savon', 450]]),
    biz('by_sante', 'Santé Plus', 'pharmacy', 'biyem-assi', -3300, 340, [['vitamins', 'Vitamines (fictif)', 2500]]),
    biz('by_marmite', 'La Marmite Camerounaise', 'restaurant', 'biyem-assi', -3050, 360, [['eru', 'Eru', 4000]]),

    // Mvan
    biz('mv_agence_voyage', 'Agence de Voyage 237 · Gare Mvan', 'admin', 'mvan', 400, -400, [['ticket_dla', 'Billet bus fictif YDE→DLA', 8500], ['ticket_baf', 'Billet bus fictif YDE→BAF', 6500], ['ticket_nga', 'Billet bus fictif YDE→NGA', 12000]], { hours: { open: '05:00', close: '21:00', days: ALL_DAYS }, notes: 'Gare routière 3D à Mvan — billets fictifs, checkout pas encore jouable.' }),
    biz('mv_fuel', 'Station Centrale', 'fuel', 'mvan', -2400, -2200, [['fuel_l', 'Essence 1L (virtuel)', 800]], { interaction: 'counter' }),
    biz('mv_petro', 'Petro 237', 'fuel', 'mvan', -2300, -2100, [['fuel_l', 'Gasoil 1L (virtuel)', 750]]),
    biz('mv_courier', 'Express Livraison 237', 'logistics', 'mvan', -2500, -2300, [['delivery', 'Course locale', 1500]]),
    biz('mv_mecano', 'Mécano Express', 'garage', 'mvan', -2350, -2350, [['repair', 'Réparation', 20000]]),
    biz('mv_marche', 'Marché de Mvan', 'market', 'mvan', -2450, -2150, [['fish', 'Poisson', 2500]], { interaction: 'stall' }),

    // Essos
    biz('es_prox', 'Proxi Market', 'grocery', 'essos', 3400, 600, [['water', 'Eau', 350]]),
    biz('es_pause', 'Pause Café', 'cafe', 'essos', 3500, 520, [['tea', 'Thé', 600]]),
    biz('es_pharma', 'Pharmacie Express', 'pharmacy', 'essos', 3300, 680, [['bandage', 'Pansement (fictif)', 800]]),
    biz('es_yaounde_burger', 'Yaoundé Burger', 'fastfood', 'essos', 3550, 640, [['burger', 'Burger', 2500]]),

    // Nlongkak
    biz('nl_citypay', 'CityPay', 'bank', 'nlongkak', 2200, -400, [['fee', 'Frais', 200]], { interaction: 'atm' }),
    biz('nl_grill', 'Grill House 237', 'restaurant', 'nlongkak', 2300, -320, [['braise', 'Poisson braisé', 5000]]),
    biz('nl_smarttech', 'SmartTech Yaoundé', 'electronics', 'nlongkak', 2100, -480, [['usb', 'Clé USB', 4000]]),

    // Ngousso
    biz('ng_clinique', 'Clinique Mboa', 'clinic', 'ngousso', 3000, 2400, [['consult', 'Consultation (fictive)', 8000]]),
    biz('ng_pharma', 'Pharmacie du Soleil', 'pharmacy', 'ngousso', 3100, 2320, [['syrup', 'Sirop (fictif)', 3000]]),
    biz('ng_saveurs', 'Saveurs du Mfoundi', 'restaurant', 'ngousso', 2900, 2480, [['ndole', 'Ndolé', 4000]]),

    // Etoudi
    biz('et_admin', 'Centre Administratif', 'admin', 'etoudi', 1600, -3600, [['form', 'Dossier (fictif)', 1000]]),
    biz('et_epicerie', 'Bon Panier', 'grocery', 'etoudi', 1500, -3500, [['oil', 'Huile', 1100]]),
    biz('et_palais_note', 'Palais de l’Unité (repère)', 'admin', 'etoudi', 1700, -3700, [], { fictional: false, landmarkReal: true, notes: 'Landmark réel — interaction limitée Phase 1.', interaction: 'menu' }),

    // Ngoa-Ekellé
    biz('nk_uy1', 'Université de Yaoundé I (repère)', 'education', 'ngoa-ekelle', 2000, 800, [], { fictional: false, landmarkReal: true, notes: 'Landmark réel — placement provisoire.', interaction: 'menu' }),
    biz('nk_snack', 'Snack Campus', 'fastfood', 'ngoa-ekelle', 2100, 860, [['rice_plate', 'Riz sauce', 1000]]),
    biz('nk_print', 'Académie Numérique', 'education', 'ngoa-ekelle', 1920, 740, [['print', 'Impression page', 50]]),
    biz('nk_bread', 'Bread & More', 'bakery', 'ngoa-ekelle', 2180, 780, [['baguette', 'Baguette', 250]]),

    // Mvog-Ada
    biz('ma_marche', 'Marché de Mvog-Ada', 'market', 'mvog-ada', 260, -280, [['cloth', 'Tissu', 3000]], { interaction: 'stall' }),
    biz('ma_poisson', 'Le Poisson Braise', 'restaurant', 'mvog-ada', 320, -240, [['fish', 'Poisson', 4500]]),
    biz('ma_moto', 'Moto Livraison', 'logistics', 'mvog-ada', 200, -320, [['run', 'Course moto', 1000]]),

    // Melen
    biz('me_institut', 'Institut Horizon', 'education', 'melen', -220, 360, [['course', 'Cours (fictif)', 15000]]),
    biz('me_auberge', 'Auberge du Quartier', 'hotel', 'melen', -160, 400, [['night', 'Nuit', 8000]]),
    biz('me_fresh', 'Fresh & Local', 'grocery', 'melen', -280, 320, [['fruit', 'Fruits', 1200]]),

    // Simbock
    biz('si_buildpro', 'BuildPro Cameroon', 'furniture', 'simbock', -600, 700, [['cement', 'Ciment (virtuel)', 5500]]),
    biz('si_marche_express', 'Marché Express', 'supermarket', 'simbock', -540, 760, [['water', 'Eau pack', 2000]]),
    biz('si_auto', 'Auto Service Yaoundé', 'garage', 'simbock', -660, 640, [['tires', 'Pneus', 45000]]),

    // Odza
    biz('od_mboa_energy', 'Mboa Energy', 'fuel', 'odza', 3800, -2800, [['fuel_l', 'Essence 1L', 800]]),
    biz('od_city_lodge', 'City Lodge 237', 'hotel', 'odza', 3900, -2700, [['room', 'Chambre', 18000]]),
    biz('od_marche', 'Marché d’Odza', 'market', 'odza', 3700, -2900, [['veg', 'Légumes', 900]], { interaction: 'stall' }),
    biz('od_pizza', 'Pizza Avenue', 'fastfood', 'odza', 4000, -2750, [['pizza', 'Pizza', 4000]]),

    // Ekounou
    biz('ek_marche', 'Marché du Quartier', 'market', 'ekounou', 540, -320, [['meat', 'Viande', 3500]], { interaction: 'stall' }),
    biz('ek_afro', 'Afro Chic', 'fashion', 'ekounou', 600, -280, [['sneakers', 'Baskets', 22000]]),
    biz('ek_chicken', 'Chicken Express 237', 'fastfood', 'ekounou', 500, -360, [['chicken', 'Poulet', 2000]]),

    // Nsam
    biz('ns_parcel', 'Parcel Express', 'logistics', 'nsam', 400, 180, [['parcel', 'Colis', 2000]]),
    biz('ns_pneus', 'Pneus & Services', 'garage', 'nsam', 460, 220, [['align', 'Géométrie', 10000]]),
    biz('ns_materiaux', 'Matériaux Express', 'furniture', 'nsam', 360, 140, [['brick', 'Briques (virtuel)', 150]]),

    // Emana
    biz('em_lycee', 'Lycée du Mfoundi', 'education', 'emana', -160, -700, [['fees', 'Frais (fictifs)', 40000]]),
    biz('em_express_fuel', 'Express Fuel', 'fuel', 'emana', -100, -640, [['fuel_l', 'Essence', 800]]),
    biz('em_douceurs', 'Douceurs de Yaoundé', 'bakery', 'emana', -200, -740, [['cake', 'Gâteau', 3500]]),

    // Nkolbisson
    biz('nk2_marche', 'Marché local Nkolbisson', 'market', 'nkolbisson', -680, 160, [['plantain', 'Plantain', 600]], { interaction: 'stall' }),
    biz('nk2_epicerie', 'Yaoundé Market', 'grocery', 'nkolbisson', -620, 200, [['salt', 'Sel', 200]]),

    // Awaé
    biz('aw_jardin', 'Le Jardin Tropical', 'restaurant', 'awae', 820, 40, [['salad', 'Salade', 2500]]),
    biz('aw_glacier', 'Glacier Tropical', 'cafe', 'awae', 880, 80, [['ice', 'Glace', 1000]]),
    biz('aw_prox', 'Chez Mama Épicerie Awaé', 'grocery', 'awae', 760, 20, [['milk', 'Lait', 900]]),

    // Shared / extra brands from spec
    biz('cv_one_shot', 'One Shot Lounge & Grill', 'nightlife', 'centre-ville', -40, 180, [['grill', 'Grillade', 6000]], { hours: { open: '17:00', close: '02:00', days: ALL_DAYS } }),
    biz('ba_ndole_royal', 'Le Ndolé Royal', 'restaurant', 'bastos', 260, -2480, [['ndole', 'Ndolé Royal', 6000]]),
    biz('cv_maison_deco', 'Maison & Déco 237', 'furniture', 'centre-ville', 100, 200, [['sofa', 'Canapé', 85000], ['bed', 'Lit', 120000]]),
    biz('cv_meuble', 'Meubles du Centre', 'furniture', 'centre-ville', -200, -120, [['table', 'Table', 35000]]),
    biz('cv_hopital', 'Hôpital Central de Yaoundé (repère)', 'hospital', 'centre-ville', -252, -180, [], { fictional: false, landmarkReal: true, notes: 'Landmark 3D — pas de gameplay médical réel.', interaction: 'menu' }),
    biz('es_eglise', 'Cathédrale / Église (repère)', 'admin', 'essos', 180, -108, [], { fictional: true, notes: 'Lieu de culte représenté respectueusement.', interaction: 'menu' }),
    biz('mo_mosquee', 'Mosquée (repère)', 'admin', 'mokolo', -252, 36, [], { fictional: true, notes: 'Lieu de culte représenté respectueusement.', interaction: 'menu' }),
    biz('cv_mboa_courier', 'Mboa Courier', 'logistics', 'centre-ville', 280, 100, [['express', 'Livraison express', 2500]]),
  ];

  return {
    version: 1,
    currency: 'FCFA',
    note: 'Phase 1 data layer. Shops are placeable on the 2D map. Full interiors/payments are NOT implemented yet.',
    businesses,
  };
}

export function businessesToJson(db: BusinessDatabase): string {
  return JSON.stringify(db, null, 2);
}
