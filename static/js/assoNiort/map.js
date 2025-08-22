// static/js/assoNiort/map.js
(function () {
  const DEFAULT_CENTER = [46.325, -0.455];
  const DEFAULT_ZOOM   = 12;

  // Bootstrap-ish couleurs
  const GREEN = '#28a745';   // success
  const RED   = '#dc3545';   // danger

  const esc = window.esc || function (s) {
    return String(s ?? '')
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  };

  let smallMap = null, smallLayer = null;
  let fullMap  = null,  fullLayer  = null;

  async function fetchJSON(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`${url} ${r.status}`);
    return r.json();
  }

  async function loadPoints() {
    // On tente d'abord la base ; si vide, on demande un fallback (géocodage à la volée, non persistant)
    const url = '/api/assos_geo?fill_if_empty=1&limit=200&persist=0';
    const rows = await fetchJSON(url);
    if (!Array.isArray(rows) || rows.length === 0) {
      console.warn("[map] aucun point servi par /api/assos_geo (même avec fallback)");
      return [];
    }

    // Normalise et filtre coords numériques
    const out = [];
    for (const r of rows) {
      const lat = toNum(r.lat);
      const lon = toNum(r.lon);
      if (lat == null || lon == null) continue;
      out.push({
        title: String(r.title || ''),
        address: String(r.address || ''),
        website: String(r.website || '').trim(),
        lat, lon
      });
    }

    if (out.length === 0) {
      console.warn("[map] points reçus mais lat/lon non numériques");
    } else {
      const withSite = out.filter(x => x.website).length;
      console.log(`[map] points: ${out.length} (avec site: ${withSite}, sans site: ${out.length - withSite})`);
    }
    return out;
  }

  function toNum(x) {
    if (typeof x === 'number' && Number.isFinite(x)) return x;
    const f = parseFloat(String(x).replace(',', '.'));
    return Number.isFinite(f) ? f : null;
  }

  // ─────────────────────────────────────────────────────────────
  // PETITE CARTE
  // ─────────────────────────────────────────────────────────────
  window.initMap = async function initMap() {
    const el = document.getElementById('niortMap');
    if (!el) return;

    if (!smallMap) {
      smallMap = L.map('niortMap', { preferCanvas: true }).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap', maxZoom: 19, crossOrigin: true
      }).addTo(smallMap);
      smallLayer = L.layerGroup().addTo(smallMap);
    } else {
      smallLayer.clearLayers();
    }

    const renderer = L.canvas({ padding: 0.5 });

    try {
      const list = await loadPoints();
      const bounds = L.latLngBounds();

      for (const a of list) {
        const hasSite = !!a.website;
        const pin = L.circleMarker([a.lat, a.lon], {
          renderer,
          radius: 7,
          weight: 1,
          color: hasSite ? GREEN : RED,
          fillColor: hasSite ? GREEN : RED,
          fillOpacity: 0.9,
        });

        let html = `<strong>${esc(a.title)}</strong>`;
        if (a.address) html += `<br><small>${esc(a.address)}</small>`;
        if (a.website) {
          const url = /^https?:\/\//i.test(a.website) ? a.website : `http://${a.website}`;
          html += `<br><a href="${url}" target="_blank" rel="noopener">Site web</a>`;
        }
        pin.bindPopup(html);

        smallLayer.addLayer(pin);
        bounds.extend([a.lat, a.lon]);
      }

      if (smallLayer.getLayers().length > 0) smallMap.fitBounds(bounds.pad(0.1));
      else smallMap.setView(DEFAULT_CENTER, DEFAULT_ZOOM);

      requestAnimationFrame(() => smallMap.invalidateSize());
    } catch (e) {
      console.error('initMap failed:', e);
      smallMap.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
      requestAnimationFrame(() => smallMap.invalidateSize());
    }

    // Bouton d’ouverture de la modale plein écran
    const btnOpen = document.getElementById('btnOpenMapModal');
    if (btnOpen) btnOpen.addEventListener('click', openModal);

    window.addEventListener('resize', () => smallMap && smallMap.invalidateSize(), { passive: true });
    window.invalidateNiortMap = () => smallMap && smallMap.invalidateSize();
  };

  // ─────────────────────────────────────────────────────────────
  // MODALE PLEIN ÉCRAN
  // ─────────────────────────────────────────────────────────────
  function openModal(){
    $('#mapFullscreenModal').modal('show');
    $('#mapFullscreenModal').one('shown.bs.modal', function () {
      buildFullMap();
    });
  }

  async function buildFullMap(){
    const el = document.getElementById('niortMapFull');
    if (!el) return;

    if (!fullMap) {
      fullMap = L.map('niortMapFull', { preferCanvas: true }).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap', maxZoom: 19, crossOrigin: true
      }).addTo(fullMap);
      fullLayer = L.layerGroup().addTo(fullMap);
    } else {
      fullLayer.clearLayers();
    }

    const renderer = L.canvas({ padding: 0.5 });

    try {
      const list = await loadPoints();
      const bounds = L.latLngBounds();

      for (const a of list) {
        const hasSite = !!a.website;
        const pin = L.circleMarker([a.lat, a.lon], {
          renderer,
          radius: 7,
          weight: 1,
          color: hasSite ? GREEN : RED,
          fillColor: hasSite ? GREEN : RED,
          fillOpacity: 0.9,
        });

        let html = `<strong>${esc(a.title)}</strong>`;
        if (a.address) html += `<br><small>${esc(a.address)}</small>`;
        if (a.website) {
          const url = /^https?:\/\//i.test(a.website) ? a.website : `http://${a.website}`;
          html += `<br><a href="${url}" target="_blank" rel="noopener">Site web</a>`;
        }
        pin.bindPopup(html);

        fullLayer.addLayer(pin);
        bounds.extend([a.lat, a.lon]);
      }

      if (fullLayer.getLayers().length > 0) fullMap.fitBounds(bounds.pad(0.1));
      else fullMap.setView(DEFAULT_CENTER, DEFAULT_ZOOM);

      requestAnimationFrame(() => fullMap.invalidateSize());

      // Download dans la modale
      const btn = document.getElementById('btnDownloadMapFull');
      if (btn) btn.onclick = () => downloadMapPNG(fullMap, el, btn);
    } catch (e) {
      console.error('buildFullMap failed:', e);
      fullMap.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
      requestAnimationFrame(() => fullMap.invalidateSize());
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Export PNG (optionnel)
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
