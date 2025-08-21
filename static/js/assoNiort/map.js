// static/js/assoNiort/map.js
(function () {
  const DEFAULT_CENTER = [46.325, -0.455];
  const DEFAULT_ZOOM   = 12;

  // Couleurs hex Bootstrap stables
  const GREEN = '#28a745';   // success
  const RED   = '#dc3545';   // danger

  const esc = (window.esc) || function (s) {
    return String(s ?? '')
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  };

  let smallMap = null, smallLayer = null;
  let fullMap  = null,  fullLayer  = null;

  // ─────────────────────────────────────────────────────────────
  // Normalisation pour matcher /api/assos_geo (coords) ↔ /api/assos (website)
  // ─────────────────────────────────────────────────────────────
  function normStr(s) {
    return String(s || '')
      .replace(/^maison\s+des\s+associations\s*-\s*/i,'') // ton cas courant
      .replace(/[’'´`]/g,"'")
      .replace(/[–—‒-]/g,'-')
      .replace(/\s+/g,' ')
      .trim()
      .toLowerCase();
  }
  function normKey(obj) {
    const t = normStr(obj.title || obj.name);
    const a = normStr(obj.address);
    // si l'adresse est vide côté /assos_geo, on matche au titre seul
    return a ? `${t}|${a}` : t;
  }
  function toNum(x) {
    if (typeof x === 'number' && Number.isFinite(x)) return x;
    const f = parseFloat(String(x).replace(',', '.'));
    return Number.isFinite(f) ? f : null;
  }

  // ─────────────────────────────────────────────────────────────
  // Chargements
  // ─────────────────────────────────────────────────────────────
  async function fetchJSON(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`${url} ${r.status}`);
    return r.json();
  }

  async function loadGeo() {
    // /api/assos_geo : [{title, address, lat, lon}]
    let rows = [];
    try {
      rows = await fetchJSON('/api/assos_geo');
    } catch (e) {
      console.error('fetch /api/assos_geo failed:', e);
      rows = [];
    }
    // garde uniquement points avec coords numériques
    return rows
      .map(r => ({
        title: r.title || r.name || '',
        address: r.address || '',
        lat: toNum(r.lat),
        lon: toNum(r.lon),
      }))
      .filter(r => r.lat !== null && r.lon !== null);
  }

  async function loadSitesIndex() {
    // /api/assos : on construit un index {normKey -> website}
    let rows = [];
    try {
      rows = await fetchJSON('/api/assos');
    } catch (e) {
      console.error('fetch /api/assos failed:', e);
      rows = [];
    }
    const map = new Map();
    for (const a of rows) {
      const key = normKey(a);
      const site = (a.website || '').toString().trim();
      if (key && !map.has(key)) map.set(key, site);
    }
    return map;
  }

  async function loadPointsMerged() {
    const [geo, sites] = await Promise.all([loadGeo(), loadSitesIndex()]);
    // fusion
    const out = geo.map(g => {
      let site = '';
      const k1 = normKey(g);
      if (sites.has(k1)) {
        site = sites.get(k1);
      } else {
        // fallback : match par titre seul si adresse a changé entre endpoints
        const tOnly = normStr(g.title);
        if (sites.has(tOnly)) site = sites.get(tOnly);
      }
      return {
        title: g.title,
        address: g.address,
        website: site,
        lat: g.lat,
        lon: g.lon
      };
    });
    // petit log côté dev
    if (out.length === 0) {
      console.warn('Aucun point à afficher (vérifie /api/assos_geo)');
    } else {
      const withSite = out.filter(x => x.website).length;
      console.log(`Points total: ${out.length} | avec site: ${withSite} | sans site: ${out.length-withSite}`);
    }
    return out;
  }

  // ─────────────────────────────────────────────────────────────
  // PETITE CARTE
  // ─────────────────────────────────────────────────────────────
  window.initMap = function initMap() {
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

    loadPointsMerged()
      .then(list => {
        const bounds = L.latLngBounds();
        list.forEach(a => {
          const hasSite = !!(a.website && a.website.trim());
          const pin = L.circleMarker([a.lat, a.lon], {
            renderer,
            radius: 7,
            weight: 1,
            color: hasSite ? GREEN : RED,
            fillColor: hasSite ? GREEN : RED,
            fillOpacity: 0.9,
          });

          const title = esc(a.title);
          const addr  = esc(a.address);
          const site  = (a.website || '').toString().trim();

          let html = `<strong>${title}</strong>`;
          if (addr) html += `<br><small>${addr}</small>`;
          if (site) {
            const url = /^https?:\/\//i.test(site) ? site : `http://${site}`;
            html += `<br><a href="${url}" target="_blank" rel="noopener">Site web</a>`;
          }

          pin.bindPopup(html);
          smallLayer.addLayer(pin);
          bounds.extend([a.lat, a.lon]);
        });

        if (smallLayer.getLayers().length > 0) smallMap.fitBounds(bounds.pad(0.1));
        else smallMap.setView(DEFAULT_CENTER, DEFAULT_ZOOM);

        requestAnimationFrame(() => smallMap.invalidateSize());
      })
      .catch(e => {
        console.error('loadPointsMerged failed:', e);
        smallMap.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
        requestAnimationFrame(() => smallMap.invalidateSize());
      });

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
      const list = await loadPointsMerged();
      const bounds = L.latLngBounds();

      list.forEach(a => {
        const hasSite = !!(a.website && a.website.trim());
        const pin = L.circleMarker([a.lat, a.lon], {
          renderer,
          radius: 7,
          weight: 1,
          color: hasSite ? GREEN : RED,
          fillColor: hasSite ? GREEN : RED,
          fillOpacity: 0.9,
        });

        const title = esc(a.title);
        const addr  = esc(a.address);
        const site  = (a.website || '').toString().trim();

        let html = `<strong>${title}</strong>`;
        if (addr) html += `<br><small>${addr}</small>`;
        if (site) {
          const url = /^https?:\/\//i.test(site) ? site : `http://${site}`;
          html += `<br><a href="${url}" target="_blank" rel="noopener">Site web</a>`;
        }

        pin.bindPopup(html);
        fullLayer.addLayer(pin);
        bounds.extend([a.lat, a.lon]);
      });

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
