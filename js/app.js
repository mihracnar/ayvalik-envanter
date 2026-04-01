// ── SABİTLER ─────────────────────────────────────────────────────────────
var COLORS = {
  "Dini Mimari":  "#8b4a2f",
  "Sivil Mimari": "#c8a96e",
  "Su Yapısı":    "#3d4f5c",
  "Ticari Yapı":  "#4a6741",
  "Kamusal Yapı": "#6b5b7a"
};
var KORUMA_STROKE = {
  "İyi":  { color: "#4a6741", weight: 2.5 },
  "Orta": { color: "#f9a825", weight: 2.5 },
  "Kötü": { color: "#8b4a2f", weight: 3.5 }
};
var KORUMA_BADGE = { "İyi": "badge-iyi", "Orta": "badge-orta", "Kötü": "badge-kotu" };
var BOYUTLAR = {
  "AYV-0001": [38,22,12], "AYV-0002": [26,20,-8], "AYV-0003": [24,18,5],
  "AYV-0004": [14,10,15], "AYV-0005": [8,6,0],   "AYV-0006": [50,30,-5],
  "AYV-0007": [32,20,10], "AYV-0008": [28,18,-3]
};

// ── HARİTA ───────────────────────────────────────────────────────────────
var map = L.map('map', { center: [39.3190, 26.6960], zoom: 16 });
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
  attribution: '© OpenStreetMap © CARTO', maxZoom: 20
}).addTo(map);

map.on('mousemove', function(e) {
  document.getElementById('coord-display').textContent =
    e.latlng.lat.toFixed(4) + '° K  ' + e.latlng.lng.toFixed(4) + '° D — Ayvalık, Balıkesir';
});

// ── DURUM ────────────────────────────────────────────────────────────────
var activeFilters = { tur: '', koruma: '', tescil: '' };
var activeMode = 'tumu';
var activeItem = null;
var markers = [];
var hiddenTypes = new Set();

// ── POLIGON ──────────────────────────────────────────────────────────────
function mockPolygon(lat, lng, w, h, rot) {
  var dLat = (h / 2) / 111320;
  var dLng = (w / 2) / (111320 * Math.cos(lat * Math.PI / 180));
  var r = rot * Math.PI / 180;
  var pts = [[-dLng,-dLat],[dLng,-dLat],[dLng,dLat],[-dLng,dLat]].map(function(c) {
    return [lng + c[0]*Math.cos(r) - c[1]*Math.sin(r),
            lat + c[0]*Math.sin(r) + c[1]*Math.cos(r)];
  });
  pts.push(pts[0]);
  return { type: "Polygon", coordinates: [pts] };
}

function makePolygon(eser) {
  var fillColor = COLORS[eser.tur] || '#c8a96e';
  var stroke    = KORUMA_STROKE[eser.koruma] || { color: '#888', weight: 2 };
  var isActive  = activeItem && activeItem.id === eser.id;
  var isTaslak  = eser.durum === 'Taslak';
  var dim       = BOYUTLAR[eser.id] || [18, 12, 0];

  var layer = L.geoJSON(mockPolygon(eser.lat, eser.lng, dim[0], dim[1], dim[2]), {
    style: {
      fillColor:   fillColor,
      fillOpacity: isActive ? 0.88 : 0.55,
      color:       isActive ? '#1a1410' : stroke.color,
      weight:      isActive ? 3.5 : stroke.weight,
      dashArray:   isTaslak ? '5,4' : null,
      opacity:     1
    }
  });

  layer.on('click',    function() { openModal(eser); });
  layer.on('mouseover',function() { layer.setStyle({ fillOpacity: 0.8, weight: stroke.weight + 1 }); });
  layer.on('mouseout', function() {
    if (!activeItem || activeItem.id !== eser.id)
      layer.setStyle({ fillOpacity: 0.55, weight: stroke.weight });
  });
  layer.bindTooltip(
    '<div class="tt-title">' + eser.ad + '</div>' +
    '<div class="tt-sub">'   + eser.tur + ' · ' + eser.donem + '</div>',
    { sticky: true, className: 'leaflet-tooltip-custom' }
  );
  return layer;
}

// ── RENDER ───────────────────────────────────────────────────────────────
function renderAll() {
  markers.forEach(function(m) { map.removeLayer(m); });
  markers = [];

  var search = document.getElementById('search-input').value.toLowerCase();

  var filtered = ESERLER.filter(function(e) {
    if (hiddenTypes.has(e.tur))                                         return false;
    if (activeFilters.tur    && e.tur    !== activeFilters.tur)         return false;
    if (activeFilters.koruma && e.koruma !== activeFilters.koruma)      return false;
    if (activeFilters.tescil && e.tescil !== activeFilters.tescil)      return false;
    if (activeMode === 'risk'   && e.koruma !== 'Kötü')                 return false;
    if (activeMode === 'taslak' && e.durum  !== 'Taslak')               return false;
    if (search &&
        e.ad.toLowerCase().indexOf(search)     === -1 &&
        e.mahalle.toLowerCase().indexOf(search) === -1)                 return false;
    return true;
  });

  filtered.forEach(function(e) {
    var m = makePolygon(e);
    m.addTo(map);
    markers.push(m);
  });

  document.getElementById('visible-count').textContent = filtered.length;
  document.getElementById('risk-count').textContent =
    ESERLER.filter(function(e) { return e.koruma === 'Kötü'; }).length;

  renderList(filtered);
}

function renderList(items) {
  document.getElementById('results-list').innerHTML = items.map(function(e) {
    return (
      '<div class="result-item' + (activeItem && activeItem.id === e.id ? ' active' : '') + '"' +
      ' onclick="openModal(ESERLER.find(function(x){return x.id===\'' + e.id + '\'}))">'+
      (e.koruma === 'Kötü' ? '<div class="risk-indicator"></div>' : '') +
      '<div class="result-item-name">' + e.ad + '</div>' +
      '<div class="result-item-meta">' +
        '<span class="badge ' + KORUMA_BADGE[e.koruma] + '">' + e.koruma + '</span>' +
        '<span class="result-item-sub">' + e.tur + '</span>' +
        '<span class="result-item-sub" style="color:#ccc">·</span>' +
        '<span class="result-item-sub">' + e.mahalle + '</span>' +
        (e.durum === 'Taslak' ? '<span class="badge badge-taslak">Taslak</span>' : '') +
      '</div></div>'
    );
  }).join('');
}

// ── MODAL ────────────────────────────────────────────────────────────────
function openModal(eser) {
  activeItem = eser;
  renderAll();
  buildModal(eser);
  document.getElementById('modal-overlay').classList.add('open');
  map.setView([eser.lat, eser.lng], 17);
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
  activeItem = null;
  renderAll();
}

function handleOverlayClick(e) {
  if (e.target === document.getElementById('modal-overlay')) closeModal();
}

function buildModal(eser) {
  var korumaLabel =
    eser.koruma === 'İyi'  ? 'Stabil — İyi korunmuş' :
    eser.koruma === 'Orta' ? 'Dikkat — Kısmi bozulma mevcut' :
                             'Risk altında — Acil müdahale gerekli';

  var curLevel = eser.koruma === 'İyi' ? 3 : eser.koruma === 'Orta' ? 2 : 1;
  var segs = ['İyi','Orta','Kötü'].map(function(k) {
    var lv  = k === 'İyi' ? 3 : k === 'Orta' ? 2 : 1;
    var cls = lv <= curLevel ? ' on-' + k.toLowerCase().replace('ö','o') : '';
    return '<div class="koruma-seg' + cls + '"></div>';
  }).join('');

  // Görsel: dosya varsa img, yoksa sadece gradient arka plan
  var fotoHTML = eser.fotoUrl
    ? '<img src="' + eser.fotoUrl + '" onerror="this.style.display=\'none\'">'
    : '';

  document.getElementById('modal').innerHTML =
    '<div class="modal-photo">' +
      '<div class="modal-photo-main" style="background:' + eser.fotoBg + '">' +
        fotoHTML +
        '<div class="modal-photo-gradient"></div>' +
        '<div class="modal-photo-meta">' +
          '<div class="modal-photo-id">' + eser.id + '</div>' +
          '<div class="modal-photo-name">' + eser.ad + '</div>' +
          '<div class="modal-photo-sub">' + eser.tur + ' · ' + eser.mahalle + '</div>' +
        '</div>' +
      '</div>' +
    '</div>' +
    '<div class="modal-content">' +
      '<div class="modal-topbar">' +
        '<div class="modal-badges-top">' +
          '<span class="badge ' + KORUMA_BADGE[eser.koruma] + '">' + eser.koruma + ' korunma</span>' +
          '<span class="badge" style="background:#f5f0e8;color:#888;font-size:9px">' + eser.tescil + '</span>' +
          '<span class="badge" style="background:#f5f0e8;color:#888;font-size:9px">' + eser.mulkiyet + '</span>' +
          (eser.durum === 'Taslak' ? '<span class="badge badge-taslak">Onay Bekliyor</span>' : '') +
        '</div>' +
        '<button class="modal-close" onclick="closeModal()">✕</button>' +
      '</div>' +
      '<div class="modal-body">' +
        '<div class="modal-section-title" style="margin-bottom:8px">Korunma Durumu</div>' +
        '<div class="koruma-bar">' + segs + '</div>' +
        '<div class="koruma-bar-text">' + korumaLabel + '</div>' +
        '<div class="modal-info-grid" style="margin-top:18px">' +
          '<div class="modal-field"><span class="field-label">Özgün İşlev</span><span class="field-value">' + eser.islevOzgun   + '</span></div>' +
          '<div class="modal-field"><span class="field-label">Güncel İşlev</span><span class="field-value">' + eser.islevGuncel  + '</span></div>' +
          '<div class="modal-field"><span class="field-label">Dönem</span><span class="field-value">'        + eser.donem        + '</span></div>' +
          '<div class="modal-field"><span class="field-label">Malzeme</span><span class="field-value">'      + eser.malzeme      + '</span></div>' +
          '<div class="modal-field"><span class="field-label">Mülkiyet</span><span class="field-value">'     + eser.mulkiyet     + '</span></div>' +
          '<div class="modal-field"><span class="field-label">Koordinat</span>' +
            '<span class="field-value" style="font-family:\'DM Mono\',monospace;font-size:11px">' +
              eser.lat.toFixed(4) + ', ' + eser.lng.toFixed(4) +
            '</span></div>' +
        '</div>' +
        '<div class="modal-section-title">Açıklama</div>' +
        '<div class="modal-desc">' + eser.aciklama + '</div>' +
      '</div>' +
      '<div class="modal-footer">' +
        '<div style="display:flex;align-items:center;opacity:0.3;margin-right:auto">' +
          '<img src="images/logo-ayvalik.png" onerror="this.style.display=\'none\'" style="height:18px">' +
        '</div>' +
        '<button class="btn" onclick="map.setView([' + eser.lat + ',' + eser.lng + '],18);closeModal()">Haritada Göster</button>' +
        '<button class="btn btn-primary">Envanter Fişi PDF</button>' +
      '</div>' +
    '</div>';
}

// ── LEGEND TOGGLE ────────────────────────────────────────────────────────
document.querySelectorAll('.legend-item').forEach(function(item) {
  item.addEventListener('click', function() {
    var t = item.dataset.type;
    if (hiddenTypes.has(t)) hiddenTypes.delete(t); else hiddenTypes.add(t);
    item.classList.toggle('inactive');
    renderAll();
  });
});

// ── FİLTRELER ────────────────────────────────────────────────────────────
document.getElementById('filter-tur').addEventListener('change',    function(e) { activeFilters.tur    = e.target.value; renderAll(); });
document.getElementById('filter-koruma').addEventListener('change', function(e) { activeFilters.koruma = e.target.value; renderAll(); });
document.getElementById('filter-tescil').addEventListener('change', function(e) { activeFilters.tescil = e.target.value; renderAll(); });
document.getElementById('search-input').addEventListener('input', renderAll);
document.addEventListener('keydown', function(e) { if (e.key === 'Escape') closeModal(); });

// ── MODE ─────────────────────────────────────────────────────────────────
function setMode(mode) {
  activeMode = mode;
  var modes = ['tumu', 'risk', 'taslak'];
  document.querySelectorAll('.mode-btn').forEach(function(b, i) {
    b.classList.toggle('active', modes[i] === mode);
  });
  renderAll();
}

// ── BAŞLAT ───────────────────────────────────────────────────────────────
renderAll();
