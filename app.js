/* v3.9: theme toggle fix (explicit localStorage) + clean SVG icons */
/* global ymaps, Telegram */
(() => {
  const tg = window.Telegram?.WebApp;
  if (tg) { try { tg.expand(); tg.MainButton.hide(); } catch(_){} }

  const $ = (sel) => document.querySelector(sel);
  const on = (el, ev, fn, opts) => { if (el) el.addEventListener(ev, fn, opts||false); };

  const escapeHTML = (text) =>
    (text || "").replace(/[&<>"']/g, c => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[c]);

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
    onb: $("#onb"),
    modal: $("#modal"),
    types: $("#types"),
    title: $("#title"),
    desc: $("#desc"),
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

  let map, userCoords, markersCollection, selectedType = null, pickedPoint = null;
  let pickingMode = false;
  let isPublishing = false;
  let clickCooldownUntil = 0;
  let trafficControl = null;

  // ===== Theming (explicit, no auto) =====
  function loadTheme(){
    try { return localStorage.getItem("ui_theme_v2") || "dark"; } catch(_) { return "dark"; }
  }
  function saveTheme(val){
    try { localStorage.setItem("ui_theme_v2", val); } catch(_){}
    applyTheme();
  }
  function applyTheme(){
    const t = loadTheme();
    document.documentElement.setAttribute("data-theme", t === "light" ? "light" : "dark");
  }

  // ===== Map prefs + icons =====
  function loadMapPrefs(){
    try { return JSON.parse(localStorage.getItem("map_prefs_v2")) || { type: "yandex#map", traffic: false, preset: "standard" }; }
    catch(_) { return { type: "yandex#map", traffic: false, preset: "standard" }; }
  }
  function saveMapPrefs(patch){
    const cur = loadMapPrefs();
    const next = { ...cur, ...patch };
    try { localStorage.setItem("map_prefs_v2", JSON.stringify(next)); } catch(_){}
    return next;
  }

  function markerIconFor(typeKey){
    // clean minimal pin icons (no emoji)
    const path = `icons/${typeKey}.svg`;
    return {
      iconLayout: 'default#image',
      iconImageHref: path,
      iconImageSize: [34,42],
      iconImageOffset: [-17,-42]
    };
  }

  function markerBalloonHTML(m){
    const dateStr = m.created_at ? new Date(m.created_at).toLocaleString('ru-RU') : '';
    const author = m.is_anon ? 'Аноним' : (m.author || '?');
    return `<div class="marker-card">${m.title ? `<div style="font-weight:600">${escapeHTML(m.title)}</div>` : ''}<div>${escapeHTML(m.description||'')}</div><div class="meta">${author}${dateStr ? ' • ' + dateStr : ''}</div></div>`;
  }

  function setPreset(name){
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

  function highlightActivePreset(name){
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

  function applyMapPrefs(){
    if (!map) return;
    const cfg = loadMapPrefs();
    try { map.setType(cfg.type); } catch(_){}
    try {
      if (cfg.traffic) {
        if (!trafficControl) {
          trafficControl = new ymaps.control.TrafficControl({ state: { trafficShown: true } });
          map.controls.add(trafficControl);
        } else {
          trafficControl.state.set("trafficShown", true);
        }
      } else if (trafficControl) {
        trafficControl.state.set("trafficShown", false);
      }
    } catch(_){}
    document.body.classList.toggle("mono-map", cfg.preset === "mono");
    document.body.classList.toggle("minimal-map", cfg.preset === "minimal");
    if (cfg.preset === "minimal") els.miniZoom?.classList.remove("hidden"); else els.miniZoom?.classList.add("hidden");
  }

  function markCustomIfTweaked(){
    const cfg = loadMapPrefs();
    if (cfg.preset !== "custom"){
      saveMapPrefs({ preset: "custom" });
      highlightActivePreset("custom");
    }
  }

  // ===== General UI =====
  function toast(msg, t=2200){ if(!els.toast) return; els.toast.textContent = msg; els.toast.classList.remove("hidden"); setTimeout(()=>els.toast.classList.add("hidden"), t); }

  // ===== Tabs =====
  els.navBtns.forEach(btn => {
    on(btn, "click", () => {
      document.querySelectorAll(".navbtn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const target = btn.dataset.tab;
      Object.entries(els.tabs).forEach(([k, el]) => el && el.classList.toggle("active", k === target));
      if (target === "feed") loadFeed();
      if (target === "profile") renderProfile();
    });
  });

  // ===== Onboarding =====
  function showOnbIfNeeded(){
    try { if (localStorage.getItem("onboarded_v2")) return; } catch(_){}
    if (!els.onb) return;
    els.onb.classList.remove("hidden");
    const slides = els.onb.querySelectorAll(".onb-slide");
    const nexts = els.onb.querySelectorAll(".onb-next");
    const done = els.onb.querySelector(".onb-done");
    let i = 0;
    nexts.forEach(n => on(n, "click", () => { slides[i].classList.add("hidden"); i=Math.min(i+1,slides.length-1); slides[i].classList.remove("hidden"); }));
    on(done, "click", () => { els.onb.classList.add("hidden"); try{ localStorage.setItem("onboarded_v2","1"); }catch(_){}});
  }

  // ===== Map init =====
  function initMap(){
    if (!window.ymaps) return;
    ymaps.ready(() => {
      map = new ymaps.Map("map", { center: [55.751244, 37.618423], zoom: 12, controls: ["zoomControl","searchControl","geolocationControl","typeSelector","fullscreenControl"] });
      markersCollection = new ymaps.GeoObjectCollection({}, {});
      map.geoObjects.add(markersCollection);

      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => {
          userCoords = [pos.coords.latitude, pos.coords.longitude];
          map.setCenter(userCoords, 14);
          fetchMarkers();
        }, () => fetchMarkers(), { enableHighAccuracy:true, timeout:6000 });
      } else { fetchMarkers(); }

      applyMapPrefs();

      map.events.add("click", e => {
        const now = Date.now();
        if (now < clickCooldownUntil) return;
        clickCooldownUntil = now + 1200;

        const coords = e.get("coords");
        if (pickingMode && selectedType) {
          pickedPoint = coords;
          pickingMode = false;
          publishMarker();
          pickedPoint = null;
          return;
        }
        if (!els.modal || els.modal.classList.contains("hidden")) return;
        pickedPoint = coords;
        if (els.coords) els.coords.textContent = pickedPoint.map(x=>x.toFixed(6)).join(", ");
        if (els.publish) els.publish.disabled = !selectedType || !pickedPoint;
      });
    });
  }

  // ===== Types grid =====
  function buildTypes(){
    if (!els.types) return;
    TYPES.forEach(t => {
      const b = document.createElement("button");
      b.className = "type";
      b.innerHTML = `<strong>${t.title}</strong>`;
      on(b, "click", () => {
        selectedType = t;
        els.types.querySelectorAll(".type").forEach(x=>x.classList.remove("selected"));
        b.classList.add("selected");
        if (els.publish) els.publish.disabled = !selectedType || !pickedPoint;
      });
      els.types.appendChild(b);
    });
  }

  // ===== API helpers =====
  function endpoint(){ return String(window.MARKER_CONFIG?.GAS_ENDPOINT || ""); }

  async function fetchMarkers(){
    if (!map) return;
    const ep = endpoint(); if (!ep) return toast("API не настроено");
    const center = map.getCenter(), radius = window.MARKER_CONFIG.DEFAULT_RADIUS_METERS;
    const url = new URL(ep); url.searchParams.set("action","list_markers"); url.searchParams.set("lat",center[0]); url.searchParams.set("lng",center[1]); url.searchParams.set("radius",radius);
    try {
      const res = await fetch(url.toString(), { method:"GET" });
      if (!res.ok) throw new Error(res.status);
      const data = await res.json();
      renderMarkers(Array.isArray(data?.markers) ? data.markers : []);
      window.__markersCache = data.markers || [];
    } catch(e){
      console.error("fetchMarkers", e);
      toast("Не удалось загрузить метки: " + (e?.message || e));
    }
  }

  function renderMarkers(items){
    if (!markersCollection) return;
    markersCollection.removeAll();
    (items||[]).forEach(m => {
      const t = TYPES.find(tt => tt.key === m.type) || TYPES[0];
      const pm = new ymaps.Placemark([m.lat, m.lng], {
        balloonContentHeader: `<strong>${t.title}</strong>`,
        balloonContentBody: markerBalloonHTML(m),
        hintContent: t.title
      }, markerIconFor(t.key));
      markersCollection.add(pm);
    });
  }

  // ===== Publish with optimistic UI =====
  function haversine(a, b){
    const R = 6371000; const toRad = d => d*Math.PI/180;
    const dLat = toRad(b[0]-a[0]); const dLng = toRad(b[1]-a[1]);
    const s1 = Math.sin(dLat/2), s2 = Math.sin(dLng/2);
    const c = Math.cos(toRad(a[0]))*Math.cos(toRad(b[0]));
    return 2*R*Math.asin(Math.sqrt(s1*s1 + c*s2*s2));
  }
  function hasDuplicateNearby(type, coords, meters=25, minutes=15){
    const list = window.__markersCache || [];
    const since = Date.now() - minutes*60*1000;
    return list.some(m => (
      m.type === type &&
      new Date(m.created_at).getTime() >= since &&
      haversine([m.lat, m.lng], coords) <= meters
    ));
  }

  async function publishMarker(){
    const ep = endpoint(); if (!ep) return toast("API не настроено");
    if (!selectedType) { toast("Выберите тип метки"); return; }

    if (!pickedPoint) {
      pickingMode = true;
      toast("Выберите место на карте");
      if (els.modal) els.modal.classList.add("hidden");
      const btn = document.querySelector('[data-tab="map"]'); if (btn) btn.click();
      return;
    }

    if (hasDuplicateNearby(selectedType.key, pickedPoint, 25, 15)) {
      toast("Похоже, такая метка уже есть рядом");
      return;
    }

    if (isPublishing) return;
    isPublishing = true;

    let optimisticPm = null;
    try {
      const t = TYPES.find(tt => tt.key === selectedType.key) || TYPES[0];
      const isAnon = !!els.anon?.checked;
      const authorName = isAnon ? '' : (tg?.initDataUnsafe?.user?.username || tg?.initDataUnsafe?.user?.first_name || "anon");
      const draft = { title: (els.title?.value||''), description: (els.desc?.value||''), author: authorName, is_anon: isAnon, created_at: new Date().toISOString() };

      optimisticPm = new ymaps.Placemark(pickedPoint, {
        balloonContentHeader: `<strong>${t.title}</strong>`,
        balloonContentBody: markerBalloonHTML(draft),
        hintContent: t.title
      }, markerIconFor(t.key));
      markersCollection.add(optimisticPm);

      const url = new URL(ep); url.searchParams.set("action","add_marker");
      const request_id = `${Date.now()}_${Math.random().toString(36).slice(2,8)}`;

      const payload = {
        type: selectedType.key,
        lat: pickedPoint[0],
        lng: pickedPoint[1],
        title: (els.title?.value||"").trim(),
        description: (els.desc?.value||"").trim(),
        duration_min: Number(els.dur?.value||120),
        author: authorName,
        client_id: tg?.initDataUnsafe?.user?.id || "",
        is_anon: isAnon,
        request_id
      };

      const res = await fetch(url.toString(), {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(res.status);
      const data = await res.json();

      if (data?.ok){
        toast("Метка опубликована");
        closeModal();
        pickedPoint = null;
        await fetchMarkers();
      } else {
        throw new Error("API error");
      }
    } catch(e){
      console.error("publishMarker", e);
      toast("Не удалось опубликовать: " + (e?.message || e));
      if (optimisticPm) { try { markersCollection.remove(optimisticPm); } catch(_){ } }
    } finally {
      isPublishing = false;
    }
  }

  // ===== Profile (theme + presets) =====
  function renderProfile(){
    if (!els.profile) return;
    const u = tg?.initDataUnsafe?.user;
    const cfg = loadMapPrefs();
    const theme = loadTheme();

    els.profile.innerHTML = `
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

    // Theme buttons
    $("#themeLight")?.addEventListener("click", ()=>{
      saveTheme("light");
      toast("Тема: Светлая");
      renderProfile();
    });
    $("#themeDark")?.addEventListener("click", ()=>{
      saveTheme("dark");
      toast("Тема: Тёмная");
      renderProfile();
    });

    // Map manual controls
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

    // Presets
    $("#presetDefault")?.addEventListener("click", () => { setPreset("standard"); toast("Стандарт"); });
    $("#presetNight")?.addEventListener("click", () => { setPreset("night"); toast("Ночной режим"); });
    $("#presetHybrid")?.addEventListener("click", () => { setPreset("hybrid"); toast("Спутник Pro"); });
    $("#presetMono")?.addEventListener("click", () => { setPreset("mono"); toast("Монохром"); });
    $("#presetMinimal")?.addEventListener("click", () => { setPreset("minimal"); toast("Минимал"); });
    $("#presetReset")?.addEventListener("click", () => { setPreset("reset"); toast("Сброс настроек"); });

    highlightActivePreset(cfg.preset);
    applyMapPrefs();
  }

  // ===== Modal control =====
  function openModal(){
    if(!els.modal) return;
    pickingMode = false;
    pickedPoint = null;
    isPublishing = false;
    selectedType = null;
    els.modal.classList.remove("hidden");
    if(els.coords) els.coords.textContent = "Координаты не выбраны";
    if(els.publish) els.publish.disabled = true;
    if(els.types) els.types.querySelectorAll(".type").forEach(x=>x.classList.remove("selected"));
  }
  function closeModal(){ if(!els.modal) return; els.modal.classList.add("hidden"); selectedType=null; if(els.types) els.types.querySelectorAll(".type").forEach(x=>x.classList.remove("selected")); }

  // ===== Events =====
  on(els.fabAdd, "click", openModal);
  on(els.cancel, "click", closeModal);
  on(els.publish, "click", publishMarker);
  on(els.useHere, "click", ()=>{
    if (!map) return;
    pickedPoint = map.getCenter();
    if (els.coords) els.coords.textContent = pickedPoint.map(x=>x.toFixed(6)).join(", ");
    if (els.publish) els.publish.disabled = !selectedType || !pickedPoint;
  });
  on(els.pickOnMap, "click", ()=>{
    pickingMode = true;
    toast("Ткните на карте место метки");
    if (els.modal) els.modal.classList.add("hidden");
    const btn = document.querySelector('[data-tab=\"map\"]'); if (btn) btn.click();
  });
  on(els.geoBtn, "click", ()=>{
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(pos => {
        userCoords = [pos.coords.latitude, pos.coords.longitude];
        if (map) map.setCenter(userCoords, 15);
      });
    }
  });
  on(els.zoomIn, "click", ()=>{ if (map) map.setZoom(map.getZoom()+1, { duration:200 }); });
  on(els.zoomOut, "click", ()=>{ if (map) map.setZoom(map.getZoom()-1, { duration:200 }); });

  // ===== Feed =====
  function loadFeed(){
    if (!els.feed) return;
    const list = window.__markersCache || [];
    els.feed.innerHTML = "";
    if (!list.length){ els.feed.innerHTML = '<div class="placeholder">Пока меток нет рядом.</div>'; return; }
    list
      .slice()
      .sort((a,b)=> new Date(b.created_at) - new Date(a.created_at))
      .forEach(m => {
        const t = TYPES.find(tt => tt.key === m.type) || TYPES[0];
        const el = document.createElement("div");
        el.className = "card";
        el.innerHTML = `<div><strong>${t.title}</strong></div>
                        <div class="meta">${new Date(m.created_at).toLocaleString()} • ${m.author||'?'}</div>
                        <div>${escapeHTML(m.description||'')}</div>`;
        on(el, "click", ()=>{
          const btn = document.querySelector('[data-tab="map"]');
          if (btn) btn.click();
          if (map) map.setCenter([m.lat, m.lng], 15, {duration:200});
        });
        els.feed.appendChild(el);
      });
  }

  // ===== Boot =====
  applyTheme(); // make sure theme applied before render
  showOnbIfNeeded();
  buildTypes();
  initMap();
})();