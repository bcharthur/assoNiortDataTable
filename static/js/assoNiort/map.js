/* public/js/map.js */
(function (global, $) {
  /* ---------- 1. Carte ---------- */
  const map = L.map('niortMap', { zoomControl: false })
               .setView([46.323, -0.464], 13);

  L.tileLayer(
    'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    { maxZoom: 19, attribution: '© OpenStreetMap' }
  ).addTo(map);

  /* ---------- 2. Icônes ---------- */
  const mk = color => new L.Icon({
    iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34]
  });
  const pinGreen = mk('green');
  const pinRed   = mk('red');

  /* ---------- 3. Loader & bouton ---------- */
  const $loader = $('#mapLoader'),
        $bar    = $('#mapProgress'),
        $txt    = $('#mapProgressTxt'),
        $btnDL  = $('#btnDownloadMap').prop('disabled', true);

  /* ---------- 4. Cache (localStorage) ---------- */
  const CACHE_KEY = 'assoGeoCacheV1';
  const geoCache  = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
  const saveCache = () => localStorage.setItem(CACHE_KEY, JSON.stringify(geoCache));

  /* ---------- 5. Appel API géocodage ---------- */
  async function fetchPos(address) {
    if (!address) return null;
    try {
      const resp = await fetch(`/api/geocode?q=${encodeURIComponent(address)}`);
      if (!resp.ok) return null;           // 4xx / 5xx  -> on ignore
      return resp.json();                  // { lat, lon }
    } catch {
      return null;                         // réseau KO
    }
  }

  /* ---------- 6. Fonction globale appelée après DataTable ---------- */
  global.plotAssociations = async rows => {
    // On ne garde qu’une occurrence par adresse
    const dedup = {};
    rows.forEach(r => { if (r.address) dedup[r.address] = r; });
    const todo  = Object.values(dedup);
    const total = todo.length;
    let done    = 0;

    const CHUNK = 10;                      // 10 req / seconde max
    const chunkDelay = 1000;

    for (let i = 0; i < todo.length; i += CHUNK) {
      await Promise.all(
        todo.slice(i, i + CHUNK).map(async a => {
          const addr = `${a.address} Niort`;
          let pos = geoCache[addr];

          if (!pos) {
            pos = await fetchPos(addr);
            if (pos) { geoCache[addr] = pos; saveCache(); }
          }
          if (pos) {
            L.marker(pos, { icon: a.website ? pinGreen : pinRed })
              .addTo(map)
              .bindPopup(`<strong>${a.title}</strong><br>${a.address}`);
          }
          // Progress bar
          done++;
          const pct = Math.round(done / total * 100);
          $bar.css('width', pct + '%');
          $txt.text(`${done} / ${total}`);
        })
      );

      // throttle
      if (i + CHUNK < todo.length)
        await new Promise(r => setTimeout(r, chunkDelay));
    }

    // Fin
    $loader.fadeOut(300, () => {
      $loader.remove();
      $btnDL.prop('disabled', false);
    });
  };

  /* ---------- 7. Export PNG ---------- */
  $btnDL.on('click', async () => {
    const rows   = JSON.parse(localStorage.getItem('assosRaw') || '[]');
    const total  = rows.length;
    const pct    = Math.round(rows.filter(r => !r.website).length / total * 100);

    const canvas = await html2canvas(document.getElementById('niortMap'),
                                     { useCORS: true, backgroundColor: null });

    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(8, 8, 200, 50);
    ctx.fillStyle = '#fff';
    ctx.font      = '14px sans-serif';
    ctx.fillText(`Associations : ${total}`, 16, 30);
    ctx.fillText(`Sans site   : ${pct}%`,   16, 48);

    canvas.toBlob(blob => {
      const link = document.createElement('a');
      link.href     = URL.createObjectURL(blob);
      link.download = 'carte_associations_niort.png';
      link.click();
      URL.revokeObjectURL(link.href);
    }, 'image/png');
  });

})(window, jQuery);
