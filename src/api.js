import { markerIconFor, markerBalloonHTML, markerBalloonLayout } from './map.js';
import { toast } from './ui.js';

const EXPECTED_URL = 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec';

// Return configured GAS endpoint or empty string if missing
export function endpoint(){
  const ep = window.MARKER_CONFIG?.GAS_ENDPOINT;
  if (!ep || ep.includes('YOUR_DEPLOYMENT_ID')){
    console.warn(`GAS_ENDPOINT is not configured. Expected something like ${EXPECTED_URL}`);
    return '';
  }
  return String(ep);
}

export async function fetchMarkers(){
  if (!window.map) return;
  const ep = endpoint(); if (!ep) return toast(`API не настроено. Укажите GAS_ENDPOINT, например: ${EXPECTED_URL}`);
  const center = window.map.getCenter(), radius = window.MARKER_CONFIG.DEFAULT_RADIUS_METERS;
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

export function renderMarkers(items){
  if (!window.markersCollection) return;
  window.markersCollection.removeAll();
  (items||[]).forEach(m => {
    const t = window.TYPES.find(tt => tt.key === m.type) || window.TYPES[0];
    const content = `<div class="marker-balloon__title"><strong>${t.title}</strong></div>${markerBalloonHTML(m)}`;
    const pm = new ymaps.Placemark([m.lat, m.lng], {
      balloonContent: content,
      hintContent: t.title,
      marker_id: m.id
    }, { ...markerIconFor(t.key), balloonContentLayout: markerBalloonLayout, hideIconOnBalloonOpen: false });
    window.markersCollection.add(pm);
  });
}

function haversine(a, b){
  const R = 6371000; const toRad = d => d*Math.PI/180;
  const dLat = toRad(b[0]-a[0]); const dLng = toRad(b[1]-a[1]);
  const s1 = Math.sin(dLat/2), s2 = Math.sin(dLng/2);
  const c = Math.cos(toRad(a[0]))*Math.cos(toRad(b[0]));
  return 2*R*Math.asin(Math.sqrt(s1*s1 + c*s2*s2));
}

export function hasDuplicateNearby(type, coords, meters=25, minutes=15){
  const list = window.__markersCache || [];
  const since = Date.now() - minutes*60*1000;
  return list.some(m => (
    m.type === type &&
    new Date(m.created_at).getTime() >= since &&
    haversine([m.lat, m.lng], coords) <= meters
  ));
}

export async function publishMarker(){
  const ep = endpoint(); if (!ep) return toast(`API не настроено. Укажите GAS_ENDPOINT, например: ${EXPECTED_URL}`);
  if (!window.selectedType) { toast("Выберите тип метки"); return; }

  if (!window.pickedPoint) {
    window.pickingMode = true;
    toast("Выберите место на карте");
    if (window.els.modal) window.els.modal.classList.add("hidden");
    const btn = document.querySelector('[data-tab="map"]'); if (btn) btn.click();
    return;
  }

  if (hasDuplicateNearby(window.selectedType.key, window.pickedPoint, 25, 15)) {
    toast("Похоже, такая метка уже есть рядом");
    return;
  }

  if (window.isPublishing) return;
  window.isPublishing = true;

  let optimisticPm = null;
  try {
    const t = window.TYPES.find(tt => tt.key === window.selectedType.key) || window.TYPES[0];
    const isAnon = !!window.els.anon?.checked;
    const authorName = isAnon ? '' : (window.tg?.initDataUnsafe?.user?.username || window.tg?.initDataUnsafe?.user?.first_name || "anon");
    let photoData = '';
    const file = window.els.photo?.files?.[0];
    if (file) {
      const maxSize = 2 * 1024 * 1024; // 2 MB
      if (file.size > maxSize) {
        toast("Фото слишком большое (максимум 2 МБ)");
        return;
      }
      if (file.type && !file.type.startsWith('image/')) {
        toast("Можно прикрепить только изображение");
        return;
      }
      photoData = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }
    const draft = { title: (window.els.title?.value||''), description: (window.els.desc?.value||''), author: authorName, is_anon: isAnon, created_at: new Date().toISOString(), image_url: photoData };

    const draftContent = `<div class="marker-balloon__title"><strong>${t.title}</strong></div>${markerBalloonHTML(draft)}`;
    optimisticPm = new ymaps.Placemark(window.pickedPoint, {
      balloonContent: draftContent,
      hintContent: t.title
    }, { ...markerIconFor(t.key), balloonContentLayout: markerBalloonLayout, hideIconOnBalloonOpen: false });
    window.markersCollection.add(optimisticPm);

    const url = new URL(ep); url.searchParams.set("action","add_marker");
    const request_id = `${Date.now()}_${Math.random().toString(36).slice(2,8)}`;

    const payload = {
      type: window.selectedType.key,
      lat: window.pickedPoint[0],
      lng: window.pickedPoint[1],
      title: (window.els.title?.value||"").trim(),
      description: (window.els.desc?.value||"").trim(),
      duration_min: Number(window.els.dur?.value||120),
      author: authorName,
      client_id: window.tg?.initDataUnsafe?.user?.id || "",
      is_anon: isAnon,
      photo: photoData,
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
      window.closeModal();
      window.pickedPoint = null;
      await fetchMarkers();
    } else {
      throw new Error("API error");
    }
  } catch(e){
    console.error("publishMarker", e);
    toast("Не удалось опубликовать: " + (e?.message || e));
    if (optimisticPm) { try { window.markersCollection.remove(optimisticPm); } catch(_){ } }
  } finally {
    window.isPublishing = false;
  }
}

export async function confirmMarker(id, delta=1){
  const ep = endpoint(); if (!ep) return toast(`API не настроено. Укажите GAS_ENDPOINT, например: ${EXPECTED_URL}`);
  try {
    const url = new URL(ep); url.searchParams.set("action","confirm_marker");
    const res = await fetch(url.toString(), {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({ id, delta, client_id: window.tg?.initDataUnsafe?.user?.id || "" })
    });
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
    return data;
  } catch(e){
    console.error("confirmMarker", e);
    toast("Не удалось подтвердить: " + (e?.message || e));
    return { ok:false };
  }
}
