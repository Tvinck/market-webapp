export function loadMapPrefs(){
  try { return JSON.parse(localStorage.getItem("map_prefs_v2")) || { type: "yandex#map", traffic: false, preset: "standard" }; }
  catch(_) { return { type: "yandex#map", traffic: false, preset: "standard" }; }
}

export function saveMapPrefs(patch){
  const cur = loadMapPrefs();
  const next = { ...cur, ...patch };
  try { localStorage.setItem("map_prefs_v2", JSON.stringify(next)); } catch(_){}
  return next;
}

export function markerIconFor(typeKey){
  const path = `icons/${typeKey}.svg`;
  return {
    iconLayout: 'default#image',
    iconImageHref: path,
    iconImageSize: [34,42],
    iconImageOffset: [-17,-42]
  };
}

export function markerBalloonHTML(m){
  const dateStr = m.created_at ? new Date(m.created_at).toLocaleString('ru-RU') : '';
  const author = m.is_anon ? 'Аноним' : (m.author || '?');
  return `<div class="marker-card">${m.title ? `<div style="font-weight:600">${escapeHTML(m.title)}</div>` : ''}<div>${escapeHTML(m.description||'')}</div><div class="meta">${author}${dateStr ? ' • ' + dateStr : ''}</div></div>`;
}

export function setPreset(name){
  let cfg;
  switch(name){
    case "standard": cfg = { type: "yandex#map", traffic: false, preset: "standard" }; break;
    case "night": cfg = { type: "yandex#map", traffic: true, preset: "night" }; break;
    case "hybrid": cfg = { type: "yandex#hybrid", traffic: true, preset: "hybrid" }; break;
    case "mono": cfg = { type: "yandex#map", traffic: false, preset: "mono" }; break;
    case "minimal": cfg = { type: "yandex#map", traffic: false, preset: "minimal" }; break;
    case "reset": default: cfg = { type: "yandex#map", traffic: false, preset: "standard" }; break;
  }
  saveMapPrefs(cfg);
  applyMapPrefs();
  const typeSel = document.querySelector("#mapTypeSelect");
  const traffic = document.querySelector("#trafficToggle");
  if (typeSel) typeSel.value = cfg.type;
  if (traffic) traffic.checked = cfg.traffic;
  highlightActivePreset(cfg.preset);
}

export function highlightActivePreset(name){
  document.querySelectorAll(".preset").forEach(b => b.classList.remove("active"));
  const id = {
    standard: "presetDefault",
    night: "presetNight",
    hybrid: "presetHybrid",
    mono: "presetMono",
    minimal: "presetMinimal",
    custom: null
  }[name] || "presetDefault";
  if (id){
    const el = document.getElementById(id);
    if (el) el.classList.add("active");
  }
}

export function applyMapPrefs(){
  if (!window.map) return;
  const cfg = loadMapPrefs();
  try { window.map.setType(cfg.type); } catch(_){}
  try {
    if (cfg.traffic) {
      if (!window.trafficControl) {
        window.trafficControl = new ymaps.control.TrafficControl({ state: { trafficShown: true } });
        window.map.controls.add(window.trafficControl);
      } else {
        window.trafficControl.state.set("trafficShown", true);
      }
    } else if (window.trafficControl) {
      window.trafficControl.state.set("trafficShown", false);
    }
  } catch(_){}
  document.body.classList.toggle("mono-map", cfg.preset === "mono");
  document.body.classList.toggle("minimal-map", cfg.preset === "minimal");
  if (cfg.preset === "minimal") window.els.miniZoom?.classList.remove("hidden"); else window.els.miniZoom?.classList.add("hidden");
}

export function markCustomIfTweaked(){
  const cfg = loadMapPrefs();
  if (cfg.preset !== "custom"){
    saveMapPrefs({ preset: "custom" });
    highlightActivePreset("custom");
  }
}
