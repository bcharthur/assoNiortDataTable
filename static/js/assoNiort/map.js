// static/js/assoNiort/map.js
(function () {
  const DEFAULT_CENTER = [46.325, -0.455]; // Niort centre
  const DEFAULT_ZOOM   = 12;

  // Appelée depuis static/js/init.js
  window.initMap = function initMap() {
    const el = document.getElementById('niortMap');
    if (!el) return;

    // ⚠️ Clé: forcer le rendu Canvas pour que leaflet-image capture les points
    const map = L.map('niortMap', { preferCanvas: true }).setView(DEFAULT_CENTER, DEFAULT_ZOOM);

    // IMPORTANT: crossOrigin pour permettre l'export en PNG
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
      crossOrigin: true
    }).addTo(map);

    const markers = L.layerGroup().addTo(map);

    // Renderer Canvas dédié (assure le rendu des path sur Canvas)
    const canvasRenderer = L.canvas({ padding: 0.5 });

    // Helpers popup
    function labelOf(a)   { return (a.title || a.name || '').toString(); }
    function addressOf(a) { return (a.address || '').toString().trim(); }
    function websiteOf(a) { return (a.website || '').toString().trim(); }

    // Charge UNIQUEMENT les assos qui ont déjà lat/lon (aucun remplissage)
    fetch('/api/assos_geo')
      .then(r => r.json())
      .then(list => {
        const bounds = L.latLngBounds();

        for (const a of list) {
          if (typeof a.lat !== 'number' || typeof a.lon !== 'number') continue;

          const hasSite = !!websiteOf(a);
          // Pins colorées : vert si site, rouge sinon — ⚠️ renderer: canvasRenderer
          const pin = L.circleMarker([a.lat, a.lon], {
            renderer: canvasRenderer,
            radius: 7,
            weight: 1,
            color: hasSite ? 'green' : 'red',
            fillColor: hasSite ? 'green' : 'red',
            fillOpacity: 0.9,
          });

          const title = escapeHtml(labelOf(a));
          const addr  = escapeHtml(addressOf(a));
          const site  = websiteOf(a);

          let html = `<strong>${title}</strong>`;
          if (addr) html += `<br><small>${addr}</small>`;
          if (site) {
            const url  = site.match(/^https?:\/\//i) ? site : `http://${site}`;
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
      })
      .catch(() => map.setView(DEFAULT_CENTER, DEFAULT_ZOOM));

    // Bouton "Télécharger la carte"
    const btn = document.getElementById('btnDownloadMap');
    if (btn) {
      btn.addEventListener('click', () => downloadMapPNG(map, el, btn));
    }

    // petite évasion HTML pour les popups
    function escapeHtml(s) {
      return String(s)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
    }
  };

  // ─────────────────────────────────────────────────────────────
  // Export PNG
  // ─────────────────────────────────────────────────────────────
  function downloadMapPNG(map, containerEl, btn) {
    const restoreBtn = disableBtn(btn);
    const filename = `carte_associations_${new Date().toISOString().slice(0,10)}.png`;

    // 1) Priorité: leaflet-image (rendu tuiles + vecteurs Canvas)
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

    // 2) Fallback: html2canvas (si présent ; nécessite CORS sur tuiles)
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

    // 3) Sinon, message d’aide
    restoreBtn();
    alert(
      "Pour télécharger la carte, charge la librairie 'leaflet-image' :\n" +
      "<script src=\"https://unpkg.com/leaflet-image/leaflet-image.js\"></script>\n" +
      "Ou en fallback 'html2canvas' :\n" +
      "<script src=\"https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js\"></script>"
    );
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
