// static/js/assoNiort/map.js  (Bootstrap 4.6 compatible)
(function () {
  const DEFAULT_CENTER = [46.325, -0.455];
  const DEFAULT_ZOOM   = 12;

  let cachedAssos = null;  // on charge une seule fois
  let mainMap = null;
  let modalMap = null;

  // ========= Public (appelée depuis static/js/init.js) =========
  window.initMap = function initMap() {
    const mainEl = document.getElementById('niortMap');
    if (!mainEl) return;

    // 1) Carte principale
    mainMap = buildLeafletMap('niortMap');

    ensureAssos().then(list => {
      populateMap(mainMap, list);
      requestAnimationFrame(() => mainMap.invalidateSize());
    }).catch(() => {
      mainMap.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
      requestAnimationFrame(() => mainMap.invalidateSize());
    });

    // 2) Initialiser/rafraîchir la carte modale à l’ouverture (BS4)
    $('#mapModal').on('shown.bs.modal', function () {
      // ajuster la hauteur (selon viewport & header)
      setModalMapHeight();

      if (!modalMap) {
        modalMap = buildLeafletMap('niortMapModal');
        ensureAssos().then(list => {
          populateMap(modalMap, list);
          // après peinture DOM
          setTimeout(() => modalMap.invalidateSize(), 0);
        });
      } else {
        setTimeout(() => modalMap.invalidateSize(), 0);
      }
    });

    // (optionnel) si tu veux libérer au close :
    // $('#mapModal').on('hidden.bs.modal', function () { /* garder en cache pour réouverture rapide */ });

    // 3) Bouton Télécharger (dans la modale seulement)
    const btnDlModal = document.getElementById('btnDownloadMapModal');
    if (btnDlModal) {
      btnDlModal.addEventListener('click', () => {
        if (!modalMap) return;
        const containerEl = document.getElementById('niortMapModal');
        downloadMapPNG(modalMap, containerEl, btnDlModal);
      });
    }

    // 4) Resize global
    window.addEventListener('resize', () => {
      if (mainMap) mainMap.invalidateSize();
      if ($('#mapModal').hasClass('show') && modalMap) {
        setModalMapHeight();
        modalMap.invalidateSize();
      }
    }, { passive: true });

    // Helper global si d’autres scripts changent des hauteurs
    window.invalidateNiortMap = () => {
      if (mainMap) mainMap.invalidateSize();
      if ($('#mapModal').hasClass('show') && modalMap) modalMap.invalidateSize();
    };
  };

  // ========= Helpers =========

  function setModalMapHeight() {
    const el = document.getElementById('niortMapModal');
    const modal = document.getElementById('mapModal');
    if (!el || !modal) return;
    const header = modal.querySelector('.modal-header');
    const headerH = header ? header.getBoundingClientRect().height : 60;
    const h = Math.max(420, window.innerHeight - headerH);
    el.style.height = h + 'px';
  }

  function buildLeafletMap(containerId) {
    const map = L.map(containerId, { preferCanvas: true }).setView(DEFAULT_CENTER, DEFAULT_ZOOM);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
      crossOrigin: true
    }).addTo(map);

    map.__markersLayer   = L.layerGroup().addTo(map);
    map.__canvasRenderer = L.canvas({ padding: 0.5 });
    return map;
  }

  function ensureAssos() {
    if (Array.isArray(cachedAssos)) return Promise.resolve(cachedAssos);
    return fetch('/api/assos_geo')   // retourne {title,address,lat,lon,(website?)}
      .then(r => r.json())
      .then(list => {
        cachedAssos = Array.isArray(list) ? list : [];
        return cachedAssos;
      });
  }

  function populateMap(map, list) {
    const markers = map.__markersLayer;
    const canvasRenderer = map.__canvasRenderer;
    markers.clearLayers();

    const bounds = L.latLngBounds();

    for (const a of list) {
      if (typeof a.lat !== 'number' || typeof a.lon !== 'number') continue;

      const hasSite = !!((a.website || '').toString().trim());
      const pin = L.circleMarker([a.lat, a.lon], {
        renderer: canvasRenderer,   // Canvas => compatible leaflet-image
        radius: 7,
        weight: 1,
        color: hasSite ? 'green' : 'red',
        fillColor: hasSite ? 'green' : 'red',
        fillOpacity: 0.9,
      });

      const title = escapeHtml((a.title || a.name || '').toString());
      const addr  = escapeHtml((a.address || '').toString().trim());
      const site  = (a.website || '').toString().trim();

      let html = `<strong>${title}</strong>`;
      if (addr) html += `<br><small>${addr}</small>`;
      if (site) {
        const url = site.match(/^https?:\/\//i) ? site : `http://${site}`;
        html += `<br><a href="${url}" target="_blank" rel="noopener">Site web</a>`;
      }
      pin.bindPopup(html);

      markers.addLayer(pin);
      bounds.extend([a.lat, a.lon]);
    }

    if (markers.getLayers().length > 0) {
      map.fitBounds(bounds.pad(0.1));
    } else {
      map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
    }
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;')
      .replace(/'/g,'&#039;');
  }

  // ========= Export PNG (leaflet-image prioritaire, html2canvas en secours) =========
  function downloadMapPNG(map, containerEl, btn) {
    const restoreBtn = disableBtn(btn);
    const filename = `carte_associations_${new Date().toISOString().slice(0,10)}.png`;

    if (window.leafletImage) {
      window.leafletImage(map, function (err, canvas) {
        restoreBtn();
        if (err || !canvas) {
          console.error('leaflet-image error:', err);
          return alert("Erreur lors du rendu de la carte.");
        }
        triggerDownload(canvas, filename);
      });
      return;
    }

    if (window.html2canvas) {
      window.html2canvas(containerEl, {
        useCORS: true,
        backgroundColor: null,
        scale: Math.min(2, window.devicePixelRatio || 1.5)
      }).then(canvas => {
        restoreBtn();
        triggerDownload(canvas, filename);
      }).catch(err => {
        restoreBtn();
        console.error(err);
        alert("Impossible de capturer la carte (CORS ?).");
      });
      return;
    }

    restoreBtn();
    alert("Ajoute 'leaflet-image' (prioritaire) ou 'html2canvas' pour capturer la carte.");
  }

  function triggerDownload(canvas, filename) {
    try {
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      requestAnimationFrame(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL?.(url);
      });
    } catch (e) {
      console.error(e);
      alert("Téléchargement impossible dans ce navigateur.");
    }
  }

  function disableBtn(btn) {
    if (!btn) return () => {};
    const prev = { disabled: btn.disabled, title: btn.title };
    btn.disabled = true;
    btn.classList.add('disabled');
    btn.title = 'Préparation du PNG...';
    return function restore() {
      btn.disabled = prev.disabled;
      btn.classList.remove('disabled');
      btn.title = prev.title;
    };
  }
})();
