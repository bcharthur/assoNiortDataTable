// static/js/assoNiort/map.js
(function () {
  const DEFAULT_CENTER = [46.325, -0.455]; // Niort centre
  const DEFAULT_ZOOM   = 12;

  // Appelée depuis static/js/init.js
  window.initMap = function initMap() {
    const el = document.getElementById('niortMap');
    if (!el) return;

    const map = L.map('niortMap').setView(DEFAULT_CENTER, DEFAULT_ZOOM);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19
    }).addTo(map);

    const markers = L.layerGroup().addTo(map);

    // Helpers popup
    function labelOf(a) {
      return (a.title || a.name || '').toString();
    }
    function addressOf(a) {
      return (a.address || '').toString().trim();
    }
    function websiteOf(a) {
      return (a.website || '').toString().trim();
    }

    // Charge UNIQUEMENT les assos qui ont déjà lat/lon (aucun remplissage)
    fetch('/api/assos_geo')
      .then(r => r.json())
      .then(list => {
        const bounds = L.latLngBounds();

        for (const a of list) {
          // sécurité : on ne place que si lat/lon sont bien des nombres
          if (typeof a.lat !== 'number' || typeof a.lon !== 'number') continue;

          const hasSite = !!websiteOf(a);
          // Pins colorées : vert si site, rouge sinon
          const pin = L.circleMarker([a.lat, a.lon], {
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
            const safe = escapeHtml(site);
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
})();
