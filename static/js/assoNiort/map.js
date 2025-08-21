// static/js/assoNiort/map.js
(function () {
  const DEFAULT_CENTER = [46.325, -0.455];
  const DEFAULT_ZOOM   = 12;

  const esc = (window.esc) || function (s) {
    return String(s ?? '')
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  };

  let smallMap = null;
  let fullMap  = null;
  let markersData = null;

  // ─────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────
  function normalizeKey(obj) {
    const t = (obj.title || obj.name || '').toString().trim().toLowerCase();
    const a = (obj.address || '').toString().trim().toLowerCase();
    return `${t}|${a}`;
  }
  function parseNum(x) {
    const v = typeof x === 'number' ? x : parseFloat(String(x));
    return Number.isFinite(v) ? v : null;
  }

  // ─────────────────────────────────────────────────────────────
  // Chargement des points
  // ─────────────────────────────────────────────────────────────
  async function loadPoints(){
    if (markersData) return markersData;

    // 1) Prend uniquement les enregistrements avec lat/lon via /api/assos_geo
    let geo = [];
    try {
      const r = await fetch('/api/assos_geo');
      geo = await r.json();
      if (!Array.isArray(geo)) geo = [];
    } catch (_) { geo = []; }

    // 2) Vérifie si cet endpoint expose déjà "website"
    const hasWebsiteField = geo.length > 0 && Object.prototype.hasOwnProperty.call(geo[0], 'website');

    // 3) Si website absent → enrichir avec /api/assos (clé = title+address)
    let websiteByKey = null;
    if (!hasWebsiteField) {
      try {
        const r2 = await fetch('/api/assos');
        const all = await r2.json();
        if (Array.isArray(all)) {
          websiteByKey = new Map(
            all.map(a => [normalizeKey(a), (a.website || '').toString().trim()])
          );
        }
      } catch (_) {}
    }

    // 4) Construit la liste finale
    markersData = geo.map(g => {
      const lat = parseNum(g.lat);
      const lon = parseNum(g.lon);
      if (lat == null || lon == null) return null;

      const key = normalizeKey(g);
      const website = hasWebsiteField
        ? (g.website || '').toString().trim()
        : (websiteByKey?.get(key) || '');

      return {
        title: g.title || g.name || '',
        address: g.address || '',
        website,
        lat, lon
      };
    }).filter(Boolean);

    return markersData;
  }

  // ─────────────────────────────────────────────────────────────
  // Init PETITE carte (dans la card)
  // ─────────────────────────────────────────────────────────────
  window.initMap = function initMap() {
    const el = document.getElementById('niortMap');
    if (!el) return;
    if (smallMap) { setTimeout(()=> smallMap.invalidateSize(), 0); return; }

    smallMap = L.map('niortMap', { preferCanvas: true }).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap', maxZoom: 19, crossOrigin: true
    }).addTo(smallMap);

    const markers = L.layerGroup().addTo(smallMap);
    const canvasRenderer = L.canvas({ padding: 0.5 });

    loadPoints().then(list => {
      const bounds = L.latLngBounds();
      list.forEach(a => {
        const hasSite = !!a.website;
        const pin = L.circleMarker([a.lat, a.lon], {
          renderer: canvasRenderer, radius: 7, weight: 1,
          color: hasSite ? 'green' : 'red',
          fillColor: hasSite ? 'green' : 'red',
          fillOpacity: 0.9,
        });

        const title = esc((a.title || '').toString());
        const addr  = esc((a.address || '').toString().trim());
        const site  = (a.website || '').toString().trim();

        let html = `<strong>${title}</strong>`;
        if (addr) html += `<br><small>${addr}</small>`;
        if (site) {
          const url = /^https?:\/\//i.test(site) ? site : `http://${site}`;
          html += `<br><a href="${url}" target="_blank" rel="noopener">Site web</a>`;
        }
        pin.bindPopup(html);
        markers.addLayer(pin);
        bounds.extend([a.lat, a.lon]);
      });

      if (markers.getLayers().length > 0) smallMap.fitBounds(bounds.pad(0.1));
      else smallMap.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
      requestAnimationFrame(() => smallMap.invalidateSize());
    }).catch(()=>{
      smallMap.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
      requestAnimationFrame(() => smallMap.invalidateSize());
    });

    // Bouton pour ouvrir la modale plein écran
    const btnOpen = document.getElementById('btnOpenMapModal');
    if (btnOpen) btnOpen.addEventListener('click', openModal);

    window.addEventListener('resize', () => smallMap && smallMap.invalidateSize(), { passive: true });
    window.invalidateNiortMap = () => smallMap && smallMap.invalidateSize();
  };

  // ─────────────────────────────────────────────────────────────
  // Modal + GRANDE carte
  // ─────────────────────────────────────────────────────────────
  function openModal(){
    $('#mapFullscreenModal').modal('show');
    $('#mapFullscreenModal').one('shown.bs.modal', function () { buildFullMap(); });
  }

  async function buildFullMap(){
    const el = document.getElementById('niortMapFull');
    if (!el) return;
    if (fullMap) { setTimeout(()=> fullMap.invalidateSize(), 0); return; }

    fullMap = L.map('niortMapFull', { preferCanvas: true }).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap', maxZoom: 19, crossOrigin: true
    }).addTo(fullMap);

    const markers = L.layerGroup().addTo(fullMap);
    const canvasRenderer = L.canvas({ padding: 0.5 });

    const list = await loadPoints();
    const bounds = L.latLngBounds();
    list.forEach(a => {
      const hasSite = !!a.website;
      const pin = L.circleMarker([a.lat, a.lon], {
        renderer: canvasRenderer, radius: 7, weight: 1,
        color: hasSite ? 'green' : 'red',
        fillColor: hasSite ? 'green' : 'red',
        fillOpacity: 0.9,
      });

      const title = esc((a.title || '').toString());
      const addr  = esc((a.address || '').toString().trim());
      const site  = (a.website || '').toString().trim();

      let html = `<strong>${title}</strong>`;
      if (addr) html += `<br><small>${addr}</small>`;
      if (site) {
        const url = /^https?:\/\//i.test(site) ? site : `http://${site}`;
        html += `<br><a href="${url}" target="_blank" rel="noopener">Site web</a>`;
      }
      pin.bindPopup(html);
      markers.addLayer(pin);
      bounds.extend([a.lat, a.lon]);
    });

    if (markers.getLayers().length > 0) fullMap.fitBounds(bounds.pad(0.1));
    else fullMap.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
    requestAnimationFrame(() => fullMap.invalidateSize());

    const btn = document.getElementById('btnDownloadMapFull');
    if (btn) btn.addEventListener('click', () => downloadMapPNG(fullMap, el, btn));
  }

  // ─────────────────────────────────────────────────────────────
  // Export PNG
  // ─────────────────────────────────────────────────────────────
  function downloadMapPNG(map, containerEl, btn) {
    const restoreBtn = disableBtn(btn);
    const filename = `carte_associations_${new Date().toISOString().slice(0,10)}.png`;

    if (window.leafletImage) {
      window.leafletImage(map, function (err, canvas) {
        restoreBtn();
        if (err || !canvas) { console.error('leaflet-image error:', err); return alert("Erreur lors du rendu de la carte."); }
        triggerDownload(canvas, filename);
      });
      return;
    }
    if (window.html2canvas) {
      window.html2canvas(containerEl, { useCORS: true, backgroundColor: null, scale: Math.min(2, window.devicePixelRatio || 1.5) })
        .then(canvas => { restoreBtn(); triggerDownload(canvas, filename); })
        .catch(err => { restoreBtn(); console.error(err); alert("Impossible de capturer la carte (CORS ?)."); });
      return;
    }
    restoreBtn();
    alert("Ajoute 'leaflet-image' ou 'html2canvas' pour exporter la carte.");
  }

  function triggerDownload(canvas, filename) {
    try {
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click();
      requestAnimationFrame(() => { document.body.removeChild(a); URL.revokeObjectURL?.(url); });
    } catch (e) { console.error(e); alert("Téléchargement impossible dans ce navigateur."); }
  }

  function disableBtn(btn) {
    if (!btn) return () => {};
    const prev = { disabled: btn.disabled, title: btn.title };
    btn.disabled = true; btn.classList.add('disabled'); btn.title = 'Préparation du PNG...';
    return function restore() { btn.disabled = prev.disabled; btn.classList.remove('disabled'); btn.title = prev.title; };
  }
})();
