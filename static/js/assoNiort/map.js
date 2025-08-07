// static/js/assoNiort/map.js
;(function(global, $) {
  // 1) Icônes colorées
  function makeIcon(color) {
    return new L.Icon({
      iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34]
    });
  }
  const pinGreen = makeIcon('green'),
        pinRed   = makeIcon('red');

  // 2) Initialisation de la carte + cluster
  let map, markerCluster, $loader, $btnDL;
  function initMap() {
    map = L.map('niortMap', { zoomControl: false }).setView([46.323, -0.464], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '© OpenStreetMap'
    }).addTo(map);

    markerCluster = L.markerClusterGroup();
    map.addLayer(markerCluster);

    $loader = $('#mapLoader');
    $btnDL  = $('#btnDownloadMap').prop('disabled', true);
  }

  /**
   * rows = [ { title, address, lat, lon, website, …}, … ]
   */
  function plotAssociations(rows) {
    markerCluster.clearLayers();
    const bounds = [];

    rows.forEach(a => {
      const lat = a.lat ?? a.latitude ?? a.geo?.lat;
      const lon = a.lon ?? a.longitude ?? a.geo?.lng;
      if (lat == null || lon == null) return;

      const icon = a.website ? pinGreen : pinRed;
      const marker = L.marker([lat, lon], { icon })
                       .bindPopup(`<strong>${a.title}</strong><br>${a.address||''}`);
      markerCluster.addLayer(marker);
      bounds.push([lat, lon]);
    });

    if (bounds.length) {
      map.fitBounds(bounds, { padding: [50, 50] });
    }

    $loader.fadeOut(300, () => $btnDL.prop('disabled', false));
  }

  // Expose
  global.initMap = initMap;
  global.plotAssociations = plotAssociations;
})(window, jQuery);
