import { loadTheme, saveTheme, applyTheme } from './src/theme.js';
import { loadMapPrefs, saveMapPrefs, markerIconFor, markerBalloonHTML, setPreset, highlightActivePreset, applyMapPrefs, markCustomIfTweaked } from './src/map.js';
import { fetchMarkers, publishMarker, confirmMarker } from './src/api.js';
import { toast, openModal, closeModal, showOnbIfNeeded, buildTypes, renderProfile, loadFeed } from './src/ui.js';
import { escapeHTML } from './src/utils.js';

const tg = window.Telegram?.WebApp;
if (tg) { try { tg.expand(); tg.MainButton.hide(); } catch(_){} }
window.tg = tg;

const $ = (sel) => document.querySelector(sel);
const on = (el, ev, fn, opts) => { if (el) el.addEventListener(ev, fn, opts||false); };
window.escapeHTML = escapeHTML;

const els = {
  tabs: {
    map: $("#tab-map"),
    feed: $("#tab-feed"),
    radar: $("#tab-radar"),
    profile: $("#tab-profile"),
  },
  navBtns: document.querySelectorAll(".navbtn"),
  map: $("#map"),
  geoBtn: $("#geoBtn"),
  zoomIn: $("#zoomIn"),
  zoomOut: $("#zoomOut"),
  miniZoom: $("#miniZoom"),
  fabAdd: $("#fabAdd"),
  confirm: $("#confirm"),
  onb: $("#onb"),
  modal: $("#modal"),
  types: $("#types"),
  title: $("#title"),
  desc: $("#desc"),
  photo: $("#photo"),
  dur: $("#dur"),
  useHere: $("#useHere"),
  pickOnMap: $("#pickOnMap"),
  coords: $("#coords"),
  publish: $("#publish"),
  cancel: $("#cancel"),
  anon: $("#anon"),
  feed: $("#feed"),
  profile: $("#profile"),
  toast: $("#toast"),
};
window.els = els;

const TYPES = [
  { key: "gai_raid", title: "Рейд ГАИ" },
  { key: "gai_post", title: "Пост ГАИ" },
  { key: "camera", title: "Камера" },
  { key: "fire", title: "Пожар" },
  { key: "ambulance", title: "Скорая" },
  { key: "no_water", title: "Нет воды" },
  { key: "no_power", title: "Нет света" },
  { key: "pit", title: "Яма" },
  { key: "repair", title: "Ремонт" },
  { key: "clear", title: "Чисто" },
  { key: "sos", title: "SOS" },
];
window.TYPES = TYPES;

window.map = null;
window.userCoords = null;
window.markersCollection = null;
window.activeMarkerId = null;
window.selectedType = null;
window.pickedPoint = null;
window.pickingMode = false;
window.isPublishing = false;
window.clickCooldownUntil = 0;
window.trafficControl = null;

window.toast = toast;
window.openModal = openModal;
window.closeModal = closeModal;

function loadYaMaps(cb){
  const key = window.MARKER_CONFIG?.YA_MAPS_KEY || document.querySelector('meta[name="ya-maps-key"]')?.content;
  const script = document.createElement('script');
  script.src = 'https://api-maps.yandex.ru/2.1/?lang=ru_RU' + (key ? '&apikey=' + encodeURIComponent(key) : '');
  script.onload = cb;
  document.head.appendChild(script);
}

function initMap(){
  if (!window.ymaps) return;
  ymaps.ready(() => {
    window.map = new ymaps.Map("map", { center: [55.751244, 37.618423], zoom: 12, controls: ["zoomControl","searchControl","geolocationControl","typeSelector","fullscreenControl"] });
    window.markersCollection = new ymaps.GeoObjectCollection({}, {});
    window.map.geoObjects.add(window.markersCollection);

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(pos => {
        window.userCoords = [pos.coords.latitude, pos.coords.longitude];
        window.map.setCenter(window.userCoords, 14);
        fetchMarkers();
      }, () => fetchMarkers(), { enableHighAccuracy:true, timeout:6000 });
    } else { fetchMarkers(); }

    applyMapPrefs();

    window.map.events.add("click", e => {
      const now = Date.now();
      if (now < window.clickCooldownUntil) return;
      window.clickCooldownUntil = now + 1200;

      const coords = e.get("coords");
      if (window.pickingMode && window.selectedType) {
        window.pickedPoint = coords;
        window.pickingMode = false;
        publishMarker();
        window.pickedPoint = null;
        return;
      }
      if (!els.modal || els.modal.classList.contains("hidden")) return;
      window.pickedPoint = coords;
      if (els.coords) els.coords.textContent = window.pickedPoint.map(x=>x.toFixed(6)).join(", ");
      if (els.publish) els.publish.disabled = !window.selectedType || !window.pickedPoint;
    });

    window.markersCollection.events.add("balloonopen", e => {
      window.activeMarkerId = e.get('target').properties.get('marker_id');
      if (els.confirm) els.confirm.classList.remove('hidden');
    });

    window.markersCollection.events.add("balloonclose", () => {
      window.activeMarkerId = null;
      if (els.confirm) els.confirm.classList.add('hidden');
    });
  });
}

els.navBtns.forEach(btn => {
  on(btn, "click", async () => {
    document.querySelectorAll(".navbtn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    const target = btn.dataset.tab;
    Object.entries(els.tabs).forEach(([k, el]) => el && el.classList.toggle("active", k === target));
    if (target === "feed") loadFeed();
    if (target === "profile") {
      if (!window.__markersCache || !window.__markersCache.length) {
        await fetchMarkers();
      }
      renderProfile();
    }
  });
});

on(els.fabAdd, "click", openModal);
on(els.cancel, "click", closeModal);
on(els.publish, "click", publishMarker);
on(els.confirm, "click", async ()=>{
  if (!window.activeMarkerId) return;
  els.confirm.disabled = true;
  const res = await confirmMarker(window.activeMarkerId);
  els.confirm.disabled = false;
  if (res?.ok){
    toast("Спасибо за подтверждение");
    window.activeMarkerId = null;
    els.confirm.classList.add('hidden');
    fetchMarkers();
  }
});
on(els.useHere, "click", ()=>{
  if (!window.map) return;
  window.pickedPoint = window.map.getCenter();
  if (els.coords) els.coords.textContent = window.pickedPoint.map(x=>x.toFixed(6)).join(", ");
  if (els.publish) els.publish.disabled = !window.selectedType || !window.pickedPoint;
});
on(els.pickOnMap, "click", ()=>{
  window.pickingMode = true;
  toast("Ткните на карте место метки");
  if (els.modal) els.modal.classList.add("hidden");
  const btn = document.querySelector('[data-tab="map"]'); if (btn) btn.click();
});
on(els.geoBtn, "click", ()=>{
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(pos => {
      window.userCoords = [pos.coords.latitude, pos.coords.longitude];
      if (window.map) window.map.setCenter(window.userCoords, 15);
    });
  }
});
on(els.zoomIn, "click", ()=>{ if (window.map) window.map.setZoom(window.map.getZoom()+1, { duration:200 }); });
on(els.zoomOut, "click", ()=>{ if (window.map) window.map.setZoom(window.map.getZoom()-1, { duration:200 }); });

applyTheme();
showOnbIfNeeded();
buildTypes();
loadYaMaps(initMap);
