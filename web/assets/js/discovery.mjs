export function distance(a, b) {
 const rad = Math.PI / 180;
 const dlat = (b.lat - a.lat) * rad, dlng = (b.lng - a.lng) * rad;
 const h = Math.sin(dlat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dlng / 2) ** 2;
 return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}
export function median(values) {
 const a = values.filter(Number.isFinite).slice().sort((a, b) => a - b), m = Math.floor(a.length / 2);
 return a.length ? (a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2) : null;
}
export function shuffle(items, random = Math.random) {
 const out = items.slice();
 for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
 return out;
}
export function diverse(items, previous = []) {
 const avoid = new Set(previous.map(r => r.id));
 const fresh = items.filter(r => !avoid.has(r.id));
 const preferred = [...fresh, ...items.filter(r => avoid.has(r.id))];
 const candidates = fresh.length >= 6 ? fresh : preferred;
 const used = new Set(), first = [];
 for (const r of candidates) {
  if (first.length < 6 && !used.has(r.species)) { first.push(r); used.add(r.species); }
 }
 for (const r of candidates) {
  if (first.length >= 6) break;
  if (!first.some(p => p.id === r.id)) first.push(r);
 }
 return [...first, ...preferred.filter(r => !first.some(p => p.id === r.id))];
}

function region(pool, destination) {
 const sorted = pool.slice().sort((a, b) => distance(destination, a) - distance(destination, b));
 let extent = 250, records = [];
 for (const km of [250, 1000, 2500]) { extent = km; records = sorted.filter(r => distance(destination, r) <= km); if (records.length >= 6) break; }
 if (records.length < Math.min(6, sorted.length)) { extent = Infinity; records = sorted; }
 return { records, extent };
}
export function discover({ records, current, mode, home, destination, broken = new Set(), random = Math.random }) {
 let pool = records.filter(r => !broken.has(r.id) && Number.isFinite(r.lat) && Number.isFinite(r.lng));
 const previous = current?.records.slice(0, 6) || [];
 const origin = current?.destination || previous[0] || pool[0];
 let referenceTemperature = null, excludedSpecies = [];
 if (!pool.length) return { error: 'No usable photographs are available in this dataset.' };
 if (mode === 'near') {
  if (!home) return { error: 'Choose a home country or share your location first.', needsLocation: true };
  if (home.countryCode) {
   pool = pool.filter(r => r.countryCode === home.countryCode);
   if (!pool.length) return { error: 'No photographs are available for that country.' };
   return { mode, destination: pool[0], extent: 'country', homeCountry: home.countryCode, records: diverse(shuffle(pool, random), previous) };
  }
  const local = region(pool, home);
  // Proximity determines the near-me stack, rather than species diversity.
  return { mode, destination: home, ...local };
 }
 if (mode === 'climate') {
  referenceTemperature = median(previous.map(r => r.temperature));
  if (referenceTemperature === null) return { error: 'Historical temperatures are unavailable for these sightings.' };
  pool = pool.filter(r => Number.isFinite(r.temperature) && Math.abs(r.temperature - referenceTemperature) >= 10);
 }
 if (mode === 'water') pool = pool.filter(r => r.aquatic);
 if (mode === 'different') {
  excludedSpecies = [...new Set(previous.map(r => r.species))];
  pool = pool.filter(r => !excludedSpecies.includes(r.species));
 }
 if (!pool.length) return { error: mode === 'climate' ? 'No sightings differ by 10°C from this cluster. Try another journey.' : 'No other matching sightings in this dataset. Try another journey.' };
 if (!destination) {
  let choices = pool;
  if (mode === 'world' && origin) {
   const distant = pool.filter(r => distance(origin, r) >= 3000);
   const abroad = distant.filter(r => r.countryCode !== origin.countryCode);
   choices = abroad.length ? abroad : distant;
   if (!choices.length) choices = [pool.slice().sort((a, b) => distance(origin, b) - distance(origin, a))[0]];
  }
  const fresh = choices.filter(r => !previous.some(p => p.id === r.id));
  destination = shuffle(fresh.length ? fresh : choices, random)[0];
 }
 const local = region(pool, destination);
 return { mode, destination, extent: local.extent, referenceTemperature, excludedSpecies, records: diverse(shuffle(local.records, random), previous) };
}
export function initialContext(records) {
 return { mode: 'initial', destination: records[0] || null, extent: 'worldwide', records: diverse(records) };
}
