/** Маркер — Google Apps Script backend (v2.2 без setHeader) */
const SPREADSHEET_ID = '1kthJTm6r27LFQdqL2HvlWkhWFknZgH4YpUye3AbuR0U';
const SHEET_MARKERS  = 'markers';


const SHEET_USERS    = 'users';

const PHOTOS_FOLDER_ID = '1CDe78tk-Urh35r0GxMHPVDPt9I-dvvrU';
// escapeHTML and haversine utilities (copied from src/utils.js for GAS compatibility)
function escapeHTML(text) {
  return String(text || '').replace(/[&<>"']/g, function (c) {
    return ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[c];
  });
}

function haversine(a, b) {
  const R = 6371000;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLng / 2);
  const c = Math.cos(toRad(a[0])) * Math.cos(toRad(b[0]));
  return 2 * R * Math.asin(Math.sqrt(s1 * s1 + c * s2 * s2));
}

function withCors(out){
  out.setHeader('Access-Control-Allow-Origin', '*');
  return out;
}

function doOptions(e){
  return withCors(ContentService.createTextOutput(''));
}

function rankFor(r){
  return r >= 50 ? 'Профи' : (r >= 10 ? 'Опытный' : 'Начинающий пользователь');
}

function ensureUserSheet(){
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sh = ss.getSheetByName(SHEET_USERS);
  if (!sh) sh = ss.insertSheet(SHEET_USERS);
  const header = sh.getRange(1,1,1, sh.getLastColumn() || 4).getValues()[0];
  if (!header || header[0] !== 'client_id') {
    sh.clear();
    sh.getRange(1,1,1,4).setValues([[ 'client_id','rating','rank','prefix' ]]);
  }
  return sh;
}

function getUser(clientId){
  if (!clientId) return { rating:0, rank: rankFor(0), prefix:'' };
  const sh = ensureUserSheet();
  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === clientId) {
      const rating = Number(data[i][1] || 0);
      const rank = data[i][2] || rankFor(rating);
      const prefix = data[i][3] || '';
      return { rating, rank, prefix };
    }
  }
  return { rating:0, rank: rankFor(0), prefix:'' };
}

function updateUserRating(clientId, delta){
  if (!clientId) return { rating:0, rank: rankFor(0) };
  const sh = ensureUserSheet();
  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === clientId) {
      let rating = Number(data[i][1] || 0) + delta;
      if (rating < 0) rating = 0;
      const rank = rankFor(rating);
      sh.getRange(i+1,2).setValue(rating);
      sh.getRange(i+1,3).setValue(rank);
      return { rating, rank };
    }
  }
  let rating = delta < 0 ? 0 : delta;
  const rank = rankFor(rating);
  sh.appendRow([clientId, rating, rank, '']);
  return { rating, rank };
}

function getUserStats(clientId){
  const info = getUser(clientId);
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const mSh = ss.getSheetByName(SHEET_MARKERS);
  let count = 0;
  if (mSh){
    const mData = mSh.getDataRange().getValues();
    for (let i = 1; i < mData.length; i++) {
      if (mData[i][8] === clientId) count++;
    }
  }
  return { rating: info.rating, prefix: info.prefix || '', markers: count };
}
// Создать лист и заголовки (один раз)
function bootstrap() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sh = ss.getSheetByName(SHEET_MARKERS);
  if (!sh) sh = ss.insertSheet(SHEET_MARKERS);
  const headers = ["id","type","lat","lng","title","description","image_url","author","client_id","is_anon","created_at","expires_at","rating","confirmations"];
  sh.getRange(1,1,1,headers.length).setValues([headers]);
  ensureUserSheet();
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

      return withCors(ContentService
        .createTextOutput(JSON.stringify({ ok: true, markers }))
        .setMimeType(ContentService.MimeType.JSON));
    }

    if (action === 'ping') {
      return withCors(ContentService
        .createTextOutput(JSON.stringify({ ok: true, pong: true }))
        .setMimeType(ContentService.MimeType.JSON));
    }

    if (action === 'get_user') {
      const clientId = String(e.parameter.client_id || '');
      const info = getUser(clientId);
      return withCors(ContentService
        .createTextOutput(JSON.stringify({ ok: true, rating: info.rating, rank: info.rank }))
        .setMimeType(ContentService.MimeType.JSON));
    }

    if (action === 'get_user_stats') {
      const clientId = String(e.parameter.client_id || '');
      const info = getUserStats(clientId);
      return withCors(ContentService
        .createTextOutput(JSON.stringify({ ok: true, rating: info.rating, markers: info.markers, prefix: info.prefix }))
        .setMimeType(ContentService.MimeType.JSON));
    }

    return withCors(ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: 'unknown_action' }))
      .setMimeType(ContentService.MimeType.JSON));

  } catch (err) {
    return withCors(ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON));
  }
}

function doPost(e) {
  try {
    const action = String(e.parameter.action || '');
    const body = e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : {};

    if (action === 'add_marker') {
      const id = addMarker(body);
      return withCors(ContentService
        .createTextOutput(JSON.stringify({ ok: true, id }))
        .setMimeType(ContentService.MimeType.JSON));
    }

    if (action === 'confirm_marker') {
      const result = updateRating(String(body.id || ''), Number(body.delta || 1), String(body.client_id || ''));
      return withCors(ContentService
        .createTextOutput(JSON.stringify({ ok: true, rating: result.rating, confirmations: result.confirmations, author: result.author, confirmer: result.confirmer }))
        .setMimeType(ContentService.MimeType.JSON));
    }

    return withCors(ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: 'unknown_action' }))
      .setMimeType(ContentService.MimeType.JSON));

  } catch (err) {
    return withCors(ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON));
  }
}

// ---- Core logic ----
function addMarker(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sh = ss.getSheetByName(SHEET_MARKERS) || ss.insertSheet(SHEET_MARKERS);

  // гарантируем заголовки
  const header = sh.getRange(1,1,1, sh.getLastColumn() || 14).getValues()[0];
  if (!header || header[0] !== 'id') {
    sh.clear();
    sh.getRange(1,1,1,14).setValues([[
      'id','type','lat','lng','title','description','image_url','author','client_id','is_anon','created_at','expires_at','rating','confirmations'
    ]]);
  }

  const now = new Date();
  const durationMin = Math.max(5, Math.min(720, Number(data.duration_min || 120)));
  const expires = new Date(now.getTime() + durationMin * 60000);
  const id = 'm_' + now.getTime();

  const title = escapeHTML(data.title || '');
  const description = escapeHTML(data.description || '');
  const author = escapeHTML(data.author || '');
  let imageUrl = '';
  if (data.photo) {
    try {
      const match = String(data.photo).match(/^data:(.+);base64,(.+)$/);
      if (match) {
        const contentType = match[1];
        const bytes = Utilities.base64Decode(match[2]);
        const ext = contentType.split('/')[1] || 'png';
        const blob = Utilities.newBlob(bytes, contentType, id + '.' + ext);
        const folder = PHOTOS_FOLDER_ID ? DriveApp.getFolderById(PHOTOS_FOLDER_ID) : DriveApp.getRootFolder();
        const file = folder.createFile(blob);
        imageUrl = file.getUrl();
      }
    } catch(err) {}
  }

  sh.appendRow([
    id,
    String(data.type || ''),
    Number(data.lat || 0),
    Number(data.lng || 0),
    title,
    description,
    imageUrl,
    author,
    String(data.client_id || ''),
    Boolean(data.is_anon),
    now,
    expires,
    0, // rating
    0  // confirmations
  ]);

  updateUserRating(String(data.client_id || ''), 1);
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
    const [id, type, la, ln, title, description, imageUrl, author, client_id, isAnon, created, expires, rating, confirmations] = rows[i];
    if (!la || !ln) continue;
    if (expires && expires < now) continue; // истёкшие скрываем

    const dkm = haversine([lat, lng], [la, ln]) / 1000;
    if (dkm * 1000 <= radiusMeters) {
      out.push({
        id, type, lat: la, lng: ln,
        title, description, author, image_url: imageUrl, is_anon: isAnon, created_at: created, expires_at: expires,
        rating: Number(rating || 0), confirmations: Number(confirmations || 0)
      });
    }
  }
  return out;
}

function updateRating(id, delta, confirmerId) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sh = ss.getSheetByName(SHEET_MARKERS);
  if (!sh) throw new Error('no_sheet');

  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === id) {
      const rating = Number(data[i][12] || 0) + delta;
      const conf = Number(data[i][13] || 0) + (delta > 0 ? 1 : 0);
      sh.getRange(i + 1, 13).setValue(rating);
      sh.getRange(i + 1, 14).setValue(conf);
      const authorId = String(data[i][8] || '');
      const author = updateUserRating(authorId, delta);
      const confirmer = updateUserRating(confirmerId, delta);
      return { rating, confirmations: conf, author, confirmer };
    }
  }
  throw new Error('not_found');
}

