import { discover, distance, initialContext } from './discovery.mjs';

const payload = document.getElementById('orbit-data');
if (payload) start(JSON.parse(payload.textContent));

function start(data) {
 const $ = id => document.getElementById(id);
 const records = data.records;
 const byID = new Map(records.map(r => [r.id, r]));
 const broken = new Set();
 const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
 const stage = $('photo-stage'), list = $('photo-list'), observatory = $('observatory');
 const dialog = $('sighting-dialog');
 let context = initialContext(records), home = null, grid = false, limit = 24, busy = false;
 let locationRequest = 0, trigger = null, movedLocation = false, touched = false;
 let motionPaused = reduced.matches;
 document.querySelectorAll('.enhanced').forEach(el => { el.hidden = false; });
 $('context-label').tabIndex = -1;

 function node(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text != null) el.textContent = text;
  return el;
 }
 function safeLink(url) { try { const u = new URL(url); return ['http:', 'https:'].includes(u.protocol) ? u.href : ''; } catch { return ''; } }
 function recordImage(r, eager = false, full = false) {
  const img = node('img'); img.src = safeLink(full ? (r.photo.large || r.photo.url) : (r.photo.thumb || r.photo.url)); img.alt = `${r.name} — ${r.place}`;
  img.loading = eager ? 'eager' : 'lazy'; img.decoding = 'async';
  let triedOriginal = false;
  img.addEventListener('error', () => {
   if (!triedOriginal && img.src !== safeLink(r.photo.url)) { triedOriginal = true; img.src = safeLink(r.photo.url); return; }
   broken.add(r.id);
   img.replaceWith(node('span', 'photo-fallback', `Photo unavailable · ${r.name}`));
  });
  return img;
 }
 function card(r, i) {
  const slot = node('article', `photo-slot slot-${i}`);
  const button = node('button', 'photo-card'); button.type = 'button'; button.dataset.id = r.id;
  button.setAttribute('aria-label', `Explore ${r.name}, ${r.place}`);
  const wrap = node('div', 'image-wrap'); wrap.append(recordImage(r, i < 6));
  const caption = node('div', 'photo-caption');
  const arrow = node('span', 'photo-arrow', '↗'); arrow.setAttribute('aria-hidden', 'true');
  caption.append(node('span', '', r.name), arrow, node('small', '', r.country || 'Location unknown'));
  button.append(wrap, caption, node('span', 'observer', r.observer || 'Observer not recorded'));
  slot.append(button); return slot;
 }
 function summary() {
  const c = context;
  const title = { initial: 'A window into the world', world: 'Across the world', climate: 'Different climate', water: 'On the water', different: 'Something different', near: home?.countryCode ? 'Your home country' : 'Nearest recorded wildlife', location: 'Around this sighting' }[c.mode];
  const area = c.homeCountry ? data.countries.find(x => x.code === c.homeCountry)?.name : c.mode === 'near' ? 'Your coordinates' : c.destination?.country;
  $('context-label').textContent = c.mode === 'initial' ? title : `${title} · ${area || 'Selected area'}`;
  let message = `${grid ? Math.min(limit, c.records.length) : Math.min(6, c.records.length)} of ${c.records.length} matching sightings`;
  if (c.extent === 'worldwide') message += ' · Worldwide collection';
  else if (c.extent === 'country') message += ' · Country selection, not your exact location';
  else if (c.extent === Infinity) message += ' · Sparse local coverage; showing nearest available matches';
  else message += ` · Within ${c.extent.toLocaleString()} km of the selected point`;
  if (c.mode === 'near' && home && !home.countryCode && c.records.length) {
   message += ` · Closest ${Math.round(distance(home, c.records[0])).toLocaleString()} km away`;
  }
  if (c.mode === 'climate') message += ` · Historical temperatures at least 10°C from ${Math.round(c.referenceTemperature)}°C; not a climate classification`;
  $('result-status').textContent = message + '.';
  $('show-more').hidden = !grid || limit >= c.records.length;
  $('layout-toggle').setAttribute('aria-pressed', String(grid));
  const layoutIcon = node('span', '', grid ? '▱' : '▦'); layoutIcon.setAttribute('aria-hidden', 'true');
  $('layout-toggle').replaceChildren(layoutIcon, document.createTextNode(grid ? ' Stack' : ' Grid'));
  $('stack-hint').textContent = matchMedia('(hover:hover)').matches ? 'HOVER TO SHUFFLE · CLICK TO EXPLORE' : 'TAP A PHOTO TO EXPLORE';
  document.querySelectorAll('[data-mode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === c.mode)));
 }
 function render() {
  observatory.classList.toggle('is-grid', grid);
  list.replaceChildren(...context.records.slice(0, grid ? limit : 6).map(card));
  if (!context.records.length) list.append(node('p', 'empty-state', 'No photographs in this orbit yet. Import sightings using the workshop CLI to begin exploring.'));
  summary();
 }
 function setBusy(value) {
  busy = value; observatory.classList.toggle('is-transitioning', value);
  observatory.setAttribute('aria-busy', String(value));
  document.querySelectorAll('[data-mode], #layout-toggle, #show-more').forEach(b => { b.disabled = value; });
 }
 function animate(el, frames, options) {
  if (reduced.matches || typeof el.animate !== 'function') return Promise.resolve();
  return el.animate(frames, options).finished.catch(() => {});
 }
 async function preload(items) {
  await Promise.all(items.slice(0, 6).map(r => new Promise(resolve => {
   const img = new Image(); const timer = setTimeout(resolve, 1200);
   img.onload = () => { clearTimeout(timer); resolve(); };
   img.onerror = () => { clearTimeout(timer); resolve(); };
   img.src = safeLink(r.photo.thumb || r.photo.url);
  })));
 }
 async function journey(mode, destination, focusHeading = false, initialArrival = false) {
  if (busy) return;
  const next = discover({ records, current: context, mode, home, destination, broken });
  if (next.error) {
   $('result-status').textContent = next.error;
   if (next.needsLocation) openLocation();
   return;
  }
  setBusy(true);
  if (!initialArrival) { touched = true; $('near-me').hidden = false; }
  $('result-status').textContent = 'Finding your next glimpse of the wild…';
  await preload(next.records);
  window.dispatchEvent(new CustomEvent('orbit:destination', { detail: { lat: next.destination.lat, lng: next.destination.lng } }));
  const outgoing = grid ? [{ opacity: 1 }, { opacity: 0, transform: 'translateY(12px)' }] : [{ opacity: 1, transform: 'translateX(0) rotateY(0)' }, { opacity: 0, transform: 'translateX(-190px) rotateY(-32deg) scale(.8)' }];
  await animate(list, outgoing, { duration: 430, easing: 'cubic-bezier(.4,0,.6,1)' });
  context = next; limit = 24; render();
  await animate(list, grid ? [{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }] : [{ opacity: 0, transform: 'translateX(190px) rotateY(32deg) scale(.8)' }, { opacity: 1, transform: 'none' }], { duration: 470, easing: 'cubic-bezier(.2,.8,.2,1)' });
  setBusy(false);
  if (focusHeading) { $('context-label').focus({ preventScroll: true }); observatory.scrollIntoView({ behavior: reduced.matches ? 'instant' : 'smooth', block: 'start' }); }
 }
 async function toggleLayout() {
  if (busy) return;
  setBusy(true);
  const before = new Map([...list.children].map(el => [el.querySelector('[data-id]')?.dataset.id, el.getBoundingClientRect()]));
  grid = !grid; render();
  const transitions = [...list.children].map(el => {
   const id = el.querySelector('[data-id]')?.dataset.id, old = before.get(id), now = el.getBoundingClientRect();
   if (old && now.width) return animate(el, [{ transform: `translate(${old.left - now.left}px,${old.top - now.top}px) scale(${old.width / now.width},${old.height / now.height})`, transformOrigin: '0 0' }, { transform: 'none', transformOrigin: '0 0' }], { duration: 450, easing: 'cubic-bezier(.2,.8,.2,1)' });
   return animate(el, [{ opacity: 0 }, { opacity: 1 }], { duration: 450 });
  });
  await Promise.all(transitions); setBusy(false);
 }
 function openLocation(message) {
  $('location-panel').hidden = false;
  if (message) $('location-message').textContent = message;
  $('location-panel').scrollIntoView({ behavior: reduced.matches ? 'instant' : 'smooth', block: 'center' });
  $('country').focus({ preventScroll: true });
 }
 function requestLocation() {
  const request = ++locationRequest;
  $('retry-location').disabled = true;
  $('location-trigger').textContent = 'Locating your orbit…';
  let settled = false;
  const fail = message => {
   if (settled || request !== locationRequest) return;
   settled = true; clearTimeout(timer); $('retry-location').disabled = false;
   $('location-trigger').textContent = 'Choose your location ↗';
   $('location-panel').hidden = false; $('location-message').textContent = message;
  };
  const timer = setTimeout(() => fail('Location took too long. Choose a country, or try sharing your location again.'), 8000);
  if (!navigator.geolocation) { fail('Your browser cannot share a location. Choose a country to begin.'); return; }
  navigator.geolocation.getCurrentPosition(position => {
   if (settled || request !== locationRequest) return;
   settled = true; clearTimeout(timer); $('retry-location').disabled = false;
   home = { lat: position.coords.latitude, lng: position.coords.longitude };
   $('location-trigger').textContent = 'Your location is set ↗'; $('location-panel').hidden = true;
   if (!busy && !touched) { void journey('near', undefined, false, true); }
   else $('result-status').textContent = 'Your home location is ready. Choose Near me to return to it.';
  }, () => fail('Location was unavailable or permission was declined. Choose a country instead, or retry.'), { timeout: 8000, maximumAge: 300000, enableHighAccuracy: false });
 }
 function addMeta(dl, label, value) { dl.append(node('dt', '', label), node('dd', '', value)); }
 function showSighting(r, opener) {
  if (!dialog.open) { trigger = opener; movedLocation = false; }
  const detail = node('article', 'sighting-detail');
  const image = node('div', 'detail-image'); image.append(recordImage(r, true, true));
  const info = node('div', 'detail-info');
  const heading = node('h2', '', r.name); heading.id = 'sighting-title'; heading.tabIndex = -1;
  const location = node('button', 'detail-location', `⌖ ${r.place} ↗`);
  location.addEventListener('click', () => {
   if (busy) return;
   movedLocation = true; dialog.close(); void journey('location', r, true);
  });
  const meta = node('dl', 'detail-meta');
  addMeta(meta, 'Observed', r.date); addMeta(meta, 'Recorded by', r.observer || 'Not recorded');
  if (r.count != null) addMeta(meta, 'Individuals', String(r.count));
  addMeta(meta, 'Coordinates', `${r.lat.toFixed(3)}°, ${r.lng.toFixed(3)}°`);
  info.append(node('p', 'eyebrow', 'A MOMENT IN THE WILD'), heading);
  if (r.scientific) info.append(node('p', 'scientific', r.scientific));
  info.append(location, meta);
  if (r.remarks) info.append(node('p', 'detail-remarks', r.remarks));
  const weather = node('section', 'weather-panel');
  weather.append(node('h3', '', 'WEATHER WHEN IT WAS SEEN'));
  const temp = node('p'); temp.append(node('strong', '', `${r.temperature.toFixed(1)}°C`), document.createTextNode(r.condition || 'Historical conditions'));
  weather.append(temp, node('p', '', `Feels like ${r.feelsLike.toFixed(1)}°C · Humidity ${r.humidity}%`), node('p', '', `Rain ${r.rain} mm · Wind ${r.wind} km/h`));
  info.append(weather);
  if (safeLink(r.source)) { const a = node('a', 'detail-source', 'View original observation ↗'); a.href = safeLink(r.source); a.target = '_blank'; a.rel = 'noopener noreferrer'; info.append(a); }
  info.append(node('p', 'photo-credit', [r.photo.creator && `Photo: ${r.photo.creator}`, r.photo.rightsHolder, r.photo.license && `Licence: ${r.photo.license}`].filter(Boolean).join(' · ') || 'Photo credit and licence not supplied in this record.'));
  detail.append(image, info); $('sighting-content').replaceChildren(detail);
  const similar = records.filter(x => x.species === r.species && x.id !== r.id);
  const similarList = $('similar-list'); similarList.replaceChildren();
  similar.slice(0, 24).forEach(other => {
   const b = node('button', 'similar-card'); b.setAttribute('aria-label', `${other.name}, ${other.place}, ${other.date}`);
   b.append(recordImage(other), node('span', '', other.country || other.place), node('span', '', other.date));
   b.addEventListener('click', () => showSighting(other)); similarList.append(b);
  });
  if (!similar.length) similarList.append(node('p', 'similar-empty', 'This is the only recorded sighting of this species in this collection.'));
  $('similar-prev').hidden = $('similar-next').hidden = !similar.length;
  similarList.scrollLeft = 0;
  if (!dialog.open) dialog.showModal();
  else heading.focus({ preventScroll: true });
  dialog.scrollTop = 0;
 }
 list.addEventListener('click', e => { const card = e.target.closest('[data-id]'); if (card && !busy) showSighting(byID.get(card.dataset.id), card); });
 document.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => journey(b.dataset.mode)));
 $('layout-toggle').addEventListener('click', toggleLayout);
 $('show-more').addEventListener('click', () => {
  const prior = limit; limit += 24; render();
  list.children[prior]?.querySelector('button')?.focus({ preventScroll: true });
 });
 $('location-trigger').addEventListener('click', () => openLocation());
 $('retry-location').addEventListener('click', requestLocation);
 $('close-location').addEventListener('click', () => { $('location-panel').hidden = true; $('location-trigger').focus(); });
 $('country').addEventListener('change', e => {
  if (!e.target.value) return;
  locationRequest++; $('retry-location').disabled = false;
  home = { countryCode: e.target.value };
  $('location-trigger').textContent = `${data.countries.find(c => c.code === home.countryCode).name} ↗`;
  $('location-panel').hidden = true; void journey('near', undefined, true);
 });
 $('dialog-close').addEventListener('click', () => dialog.close());
 dialog.addEventListener('click', e => { if (e.target === dialog) { const r = dialog.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close(); } });
 dialog.addEventListener('close', () => { if (!movedLocation) { if (trigger?.isConnected) trigger.focus({ preventScroll: true }); else $('context-label').focus({ preventScroll: true }); } });
 $('similar-prev').addEventListener('click', () => $('similar-list').scrollBy({ left: -350, behavior: reduced.matches ? 'instant' : 'smooth' }));
 $('similar-next').addEventListener('click', () => $('similar-list').scrollBy({ left: 350, behavior: reduced.matches ? 'instant' : 'smooth' }));
 function motion() {
  $('motion-toggle').disabled = reduced.matches;
  $('motion-toggle').textContent = reduced.matches ? 'Reduced motion' : motionPaused ? 'Resume dust' : 'Pause dust';
  $('motion-toggle').setAttribute('aria-pressed', String(motionPaused));
  window.dispatchEvent(new CustomEvent('orbit:motion', { detail: { paused: motionPaused } }));
 }
 $('motion-toggle').addEventListener('click', () => { motionPaused = !motionPaused; motion(); });
 reduced.addEventListener('change', () => { motionPaused = reduced.matches; motion(); });
 render(); motion();
 if (records.length) requestLocation();
 import('./globe.js').then(m => m.mountGlobe({ destination: context.destination, paused: motionPaused })).catch(() => {});
}
