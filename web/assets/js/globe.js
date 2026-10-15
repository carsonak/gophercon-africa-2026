import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.186.1/build/three.module.js';

export function mountGlobe({ destination, paused = false }) {
 const canvas = document.getElementById('globe');
 if (!canvas) return;
 let renderer;
 try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' }); } catch { return; }
 renderer.setClearColor(0x000000, 0);
 renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
 const scene = new THREE.Scene();
 const camera = new THREE.PerspectiveCamera(45, 1, .1, 100);
 camera.position.z = 5.8;
 const globe = new THREE.Group(); scene.add(globe);
 const radius = 1.76;
 const material = new THREE.LineBasicMaterial({ color: 0xc5a05b, transparent: true, opacity: .27, depthWrite: false });
 function line(points) { globe.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), material)); }
 for (let lng = 0; lng < 180; lng += 15) {
  const theta = lng * Math.PI / 180;
  line(Array.from({ length: 181 }, (_, i) => {
   const a = i * Math.PI / 90;
   return new THREE.Vector3(radius * Math.cos(a) * Math.sin(theta), radius * Math.sin(a), radius * Math.cos(a) * Math.cos(theta));
  }));
 }
 for (let lat = -75; lat <= 75; lat += 15) {
  const phi = lat * Math.PI / 180;
  line(Array.from({ length: 181 }, (_, i) => { const a = i * Math.PI / 90; return new THREE.Vector3(radius * Math.cos(phi) * Math.sin(a), radius * Math.sin(phi), radius * Math.cos(phi) * Math.cos(a)); }));
 }
 const points = new Float32Array(220 * 3);
 for (let i = 0; i < 220; i++) {
  const a = Math.random() * Math.PI * 2, r = 1.9 + Math.random() * 1.1;
  points[i * 3] = Math.cos(a) * r; points[i * 3 + 1] = Math.sin(a) * r; points[i * 3 + 2] = (Math.random() - .5) * 2;
 }
 const dustGeometry = new THREE.BufferGeometry(); dustGeometry.setAttribute('position', new THREE.BufferAttribute(points, 3));
 const dust = new THREE.Points(dustGeometry, new THREE.PointsMaterial({ color: 0xd4ac67, size: .012, transparent: true, opacity: .45, depthWrite: false }));
 scene.add(dust);
 const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
 let visible = true, motionPaused = paused, frame = 0, last = 0, start = 0;
 let from = globe.quaternion.clone(), to = globe.quaternion.clone(), turning = false;
 function target(lat = 0, lng = 0) {
  const phi = lat * Math.PI / 180, theta = lng * Math.PI / 180;
  const normal = new THREE.Vector3(Math.cos(phi) * Math.sin(theta), Math.sin(phi), Math.cos(phi) * Math.cos(theta));
  return new THREE.Quaternion().setFromUnitVectors(normal, new THREE.Vector3(0, 0, 1));
 }
 if (destination) globe.quaternion.copy(target(destination.lat, destination.lng));
 from.copy(globe.quaternion); to.copy(globe.quaternion);
 function draw(time) {
  frame = 0;
  if (!visible || document.hidden) return;
  if (turning) {
   const progress = Math.min(1, (time - start) / 900), eased = progress * progress * (3 - 2 * progress);
   globe.quaternion.slerpQuaternions(from, to, eased);
   if (progress >= 1) turning = false;
  }
  if (!motionPaused && !reduce.matches) dust.rotation.z += Math.min((time - last) / 1000, .05) * .016;
  dust.visible = !reduce.matches;
  last = time; renderer.render(scene, camera);
  canvas.parentElement.classList.add('has-webgl');
  if (turning || (!motionPaused && !reduce.matches)) requestDraw();
 }
 function requestDraw() { if (!frame) frame = requestAnimationFrame(draw); }
 function resize() {
  const width = canvas.parentElement.clientWidth, height = canvas.parentElement.clientHeight;
  renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix(); requestDraw();
 }
 new ResizeObserver(resize).observe(canvas.parentElement);
 new IntersectionObserver(entries => { visible = entries[0].isIntersecting; if (visible) requestDraw(); }).observe(canvas);
 document.addEventListener('visibilitychange', () => { if (!document.hidden) requestDraw(); });
 window.addEventListener('orbit:destination', e => {
  from = globe.quaternion.clone(); to = target(e.detail.lat, e.detail.lng); start = performance.now(); turning = !reduce.matches;
  if (!turning) globe.quaternion.copy(to);
  requestDraw();
 });
 window.addEventListener('orbit:motion', e => { motionPaused = e.detail.paused; requestDraw(); });
 reduce.addEventListener('change', () => { if (reduce.matches) { globe.quaternion.copy(to); turning = false; } requestDraw(); });
 canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); canvas.parentElement.classList.remove('has-webgl'); if (frame) cancelAnimationFrame(frame); frame = 0; });
 resize();
}
