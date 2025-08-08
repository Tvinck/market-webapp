import { saveTheme, loadTheme } from './theme.js';
import { loadMapPrefs, saveMapPrefs, applyMapPrefs, setPreset, highlightActivePreset, markCustomIfTweaked } from './map.js';

export function toast(msg, t=2200){ if(!window.els.toast) return; window.els.toast.textContent = msg; window.els.toast.classList.remove("hidden"); setTimeout(()=>window.els.toast.classList.add("hidden"), t); }

export function openModal(){
  if(!window.els.modal) return;
  window.pickingMode = false;
  window.pickedPoint = null;
  window.isPublishing = false;
  window.selectedType = null;
  window.els.modal.classList.remove("hidden");
  if(window.els.coords) window.els.coords.textContent = "Координаты не выбраны";
  if(window.els.publish) window.els.publish.disabled = true;
  if(window.els.types) window.els.types.querySelectorAll(".type").forEach(x=>x.classList.remove("selected"));
}

export function closeModal(){ if(!window.els.modal) return; window.els.modal.classList.add("hidden"); window.selectedType=null; if(window.els.types) window.els.types.querySelectorAll(".type").forEach(x=>x.classList.remove("selected")); }

export function showOnbIfNeeded(){
  try { if (localStorage.getItem("onboarded_v2")) return; } catch(_){}
  if (!window.els.onb) return;
  window.els.onb.classList.remove("hidden");
  const slides = window.els.onb.querySelectorAll(".onb-slide");
  const nexts = window.els.onb.querySelectorAll(".onb-next");
  const done = window.els.onb.querySelector(".onb-done");
  let i = 0;
  nexts.forEach(n => n.addEventListener("click", () => { slides[i].classList.add("hidden"); i=Math.min(i+1,slides.length-1); slides[i].classList.remove("hidden"); }));
  done?.addEventListener("click", () => { window.els.onb.classList.add("hidden"); try{ localStorage.setItem("onboarded_v2","1"); }catch(_){}});
}

export function buildTypes(){
  if (!window.els.types) return;
  window.TYPES.forEach(t => {
    const b = document.createElement("button");
    b.className = "type";
    b.innerHTML = `<strong>${t.title}</strong>`;
    b.addEventListener("click", () => {
      window.selectedType = t;
      window.els.types.querySelectorAll(".type").forEach(x=>x.classList.remove("selected"));
      b.classList.add("selected");
      if (window.els.publish) window.els.publish.disabled = !window.selectedType || !window.pickedPoint;
    });
    window.els.types.appendChild(b);
  });
}

export function renderProfile(){
  if (!window.els.profile) return;
  const u = window.tg?.initDataUnsafe?.user;
  const cfg = loadMapPrefs();
  const theme = loadTheme();

  window.els.profile.innerHTML = `
      <div class="card"><strong>${u?.first_name||'Гость'} ${u?.last_name||''}</strong>
        <div class="meta">@${u?.username||''}</div>
      </div>

      <div class="card">
        <div style="font-weight:600;margin-bottom:8px">Тема интерфейса</div>
        <div class="preset-row">
          <button class="preset ${theme==='light'?'active':''}" id="themeLight">Светлая</button>
          <button class="preset ${theme==='dark'?'active':''}" id="themeDark">Тёмная</button>
        </div>
      </div>

      <div class="card">
        <div style="font-weight:600;margin-bottom:8px">Пресеты карты</div>
        <div class="preset-row">
          <button class="preset" id="presetDefault">Стандарт</button>
          <button class="preset" id="presetNight">Ночной</button>
          <button class="preset" id="presetHybrid">Спутник Pro</button>
          <button class="preset" id="presetMono">Монохром</button>
          <button class="preset" id="presetMinimal">Минимал</button>
          <button class="preset" id="presetReset">Сброс</button>
        </div>

        <label class="lbl" style="margin-top:10px">Тип карты</label>
        <select id="mapTypeSelect">
          <option value="yandex#map">Схема</option>
          <option value="yandex#satellite">Спутник</option>
          <option value="yandex#hybrid">Гибрид</option>
          <option value="yandex#publicMap">Народная</option>
        </select>

        <div class="row" style="margin-top:10px">
          <input id="trafficToggle" type="checkbox" ${cfg.traffic ? 'checked':''}>
          <label for="trafficToggle" style="margin-left:6px">Показывать пробки</label>
        </div>
      </div>
    `;

  document.getElementById("themeLight")?.addEventListener("click", ()=>{
    saveTheme("light");
    toast("Тема: Светлая");
    renderProfile();
  });
  document.getElementById("themeDark")?.addEventListener("click", ()=>{
    saveTheme("dark");
    toast("Тема: Тёмная");
    renderProfile();
  });

  const typeSel = document.querySelector("#mapTypeSelect");
  if (typeSel) typeSel.value = cfg.type;

  typeSel?.addEventListener("change", () => {
    saveMapPrefs({ type: typeSel.value });
    applyMapPrefs();
    markCustomIfTweaked();
  });

  const traffic = document.querySelector("#trafficToggle");
  traffic?.addEventListener("change", () => {
    saveMapPrefs({ traffic: !!traffic.checked });
    applyMapPrefs();
    markCustomIfTweaked();
  });

  document.getElementById("presetDefault")?.addEventListener("click", () => { setPreset("standard"); toast("Стандарт"); });
  document.getElementById("presetNight")?.addEventListener("click", () => { setPreset("night"); toast("Ночной режим"); });
  document.getElementById("presetHybrid")?.addEventListener("click", () => { setPreset("hybrid"); toast("Спутник Pro"); });
  document.getElementById("presetMono")?.addEventListener("click", () => { setPreset("mono"); toast("Монохром"); });
  document.getElementById("presetMinimal")?.addEventListener("click", () => { setPreset("minimal"); toast("Минимал"); });
  document.getElementById("presetReset")?.addEventListener("click", () => { setPreset("reset"); toast("Сброс настроек"); });

  highlightActivePreset(cfg.preset);
  applyMapPrefs();
}

export function loadFeed(){
  if (!window.els.feed) return;
  const list = window.__markersCache || [];
  window.els.feed.innerHTML = "";
  if (!list.length){ window.els.feed.innerHTML = '<div class="placeholder">Пока меток нет рядом.</div>'; return; }
  list
    .slice()
    .sort((a,b)=> new Date(b.created_at) - new Date(a.created_at))
    .forEach(m => {
      const t = window.TYPES.find(tt => tt.key === m.type) || window.TYPES[0];
      const el = document.createElement("div");
      el.className = "card";
      const author = m.is_anon ? 'Аноним' : (m.author||'?');
      el.innerHTML = `<div><strong>${t.title}</strong></div>`+
                      `<div class="meta">${new Date(m.created_at).toLocaleString()} • ${author}</div>`+
                      `<div>${escapeHTML(m.description||'')}</div>`;
      el.addEventListener("click", ()=>{
        const btn = document.querySelector('[data-tab="map"]');
        if (btn) btn.click();
        if (window.map) window.map.setCenter([m.lat, m.lng], 15, {duration:200});
      });
      window.els.feed.appendChild(el);
    });
}
