(function (global, $) {

  /* carte centrée sur Niort */
  const map = L.map('niortMap', { zoomControl:false }).setView([46.323, -0.464], 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution:'© OpenStreetMap',
    maxZoom: 19
  }).addTo(map);

  /* icône simple */
  const pin = L.icon({
    iconUrl : 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl:'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize:[25,41], iconAnchor:[12,41]
  });

  /* géocode Nominatim (free, 1 req/s) */
  async function geocode(address){
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`;
    const rsp = await fetch(url, { headers:{ 'Accept-Language':'fr' } });
    const js  = await rsp.json();
    return js[0] ? [ js[0].lat, js[0].lon ] : null;
  }

  /* public : injecte des marqueurs */
  global.plotAssociations = async function (rows) {
    for (const a of rows) {
      if (!a.address) continue;
      const pos = await geocode(`${a.address} Niort`);
      if (!pos) continue;

      L.marker(pos, { icon:pin })
        .addTo(map)
        .bindPopup(`<strong>${a.title}</strong><br>${a.address}`);
      await new Promise(r => setTimeout(r, 1100)); // 1 req/s (politique Nominatim)
    }
  };

})(window, jQuery);
