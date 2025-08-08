/** Маркер — Google Apps Script backend (v2.2 без setHeader) */
const SPREADSHEET_ID = '1kthJTm6r27LFQdqL2HvlWkhWFknZgH4YpUye3AbuR0U';
const SHEET_MARKERS  = 'markers';

function escapeHTML(text) {
  return String(text || '').replace(/[&<>"']/g, function(c) {
    return ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[c];
  });
}

// Создать лист и заголовки (один раз)
function bootstrap() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sh = ss.getSheetByName(SHEET_MARKERS);
  if (!sh) sh = ss.insertSheet(SHEET_MARKERS);
  const headers = ["id","type","lat","lng","title","description","author","client_id","is_anon","created_at","expires_at","rating","confirmations"];
  sh.getRange(1,1,1,headers.length).setValues([headers]);
}

// ---- Handlers ----
function doGet(e) {
  try {
    const action = String(e.parameter.action || '');

    if (action === 'list_markers') {
      const lat = parseFloat(e.parameter.lat);
      const lng = parseFloat(e.parameter.lng);
      const radius = parseInt(e.parameter.radius || '5000', 10);
      const markers = listMarkers(lat, lng, radius);

      return ContentService
        .createTextOutput(JSON.stringify({ ok: true, markers }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'ping') {
      return ContentService
        .createTextOutput(JSON.stringify({ ok: true, pong: true }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: 'unknown_action' }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    const action = String(e.parameter.action || '');
    const body = e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : {};

    if (action === 'add_marker') {
      const id = addMarker(body);
      return ContentService
        .createTextOutput(JSON.stringify({ ok: true, id }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'confirm_marker') {
      const result = updateRating(String(body.id || ''), Number(body.delta || 1));
      return ContentService
        .createTextOutput(JSON.stringify({ ok: true, rating: result.rating, confirmations: result.confirmations }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: 'unknown_action' }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ---- Core logic ----
function addMarker(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sh = ss.getSheetByName(SHEET_MARKERS) || ss.insertSheet(SHEET_MARKERS);

  // гарантируем заголовки
  const header = sh.getRange(1,1,1, sh.getLastColumn() || 13).getValues()[0];
  if (!header || header[0] !== 'id') {
    sh.clear();
    sh.getRange(1,1,1,13).setValues([[
      'id','type','lat','lng','title','description','author','client_id','is_anon','created_at','expires_at','rating','confirmations'
    ]]);
  }

  const now = new Date();
  const durationMin = Math.max(5, Math.min(720, Number(data.duration_min || 120)));
  const expires = new Date(now.getTime() + durationMin * 60000);
  const id = 'm_' + now.getTime();

  const title = escapeHTML(data.title || '');
  const description = escapeHTML(data.description || '');
  const author = escapeHTML(data.author || '');

  sh.appendRow([
    id,
    String(data.type || ''),
    Number(data.lat || 0),
    Number(data.lng || 0),
    title,
    description,
    author,
    String(data.client_id || ''),
    Boolean(data.is_anon),
    now,
    expires,
    0, // rating
    0  // confirmations
  ]);

  return id;
}

function listMarkers(lat, lng, radiusMeters) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sh = ss.getSheetByName(SHEET_MARKERS);
  if (!sh) return [];

  const rows = sh.getDataRange().getValues();
  const out = [];
  const now = new Date();

  for (let i = 1; i < rows.length; i++) {
    const [id, type, la, ln, title, description, author, client_id, isAnon, created, expires, rating, confirmations] = rows[i];
    if (!la || !ln) continue;
    if (expires && expires < now) continue; // истёкшие скрываем

    const dkm = haversine(lat, lng, la, ln);
    if (dkm * 1000 <= radiusMeters) {
      out.push({
        id, type, lat: la, lng: ln,
        title, description, author, is_anon: isAnon, created_at: created, expires_at: expires,
        rating: Number(rating || 0), confirmations: Number(confirmations || 0)
      });
    }
  }
  return out;
}

function updateRating(id, delta) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sh = ss.getSheetByName(SHEET_MARKERS);
  if (!sh) throw new Error('no_sheet');

  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === id) {
      const rating = Number(data[i][11] || 0) + delta;
      const conf = Number(data[i][12] || 0) + (delta > 0 ? 1 : 0);
      sh.getRange(i + 1, 12).setValue(rating);
      sh.getRange(i + 1, 13).setValue(conf);
      return { rating, confirmations: conf };
    }
  }
  throw new Error('not_found');
}

// расстояние между точками (км)
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371; // km
  const toRad = x => x * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
