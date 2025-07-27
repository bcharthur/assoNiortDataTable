(function (global, $) {

  /* ---------- 1. Carte ---------- */
  const map = L.map('niortMap', { zoomControl:false })
               .setView([46.323, -0.464], 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
              { maxZoom:19, attribution:'© OpenStreetMap'}).addTo(map);

  /* ---------- 2. Icônes ---------- */
  const mk = c => new L.Icon({
    iconUrl:`https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${c}.png`,
    shadowUrl:'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize:[25,41], iconAnchor:[12,41], popupAnchor:[1,-34]
  });
  const pinGreen = mk('green'), pinRed = mk('red');

  /* ---------- 3. Loader & bouton ---------- */
  const $loader = $('#mapLoader'),
        $bar    = $('#mapProgress'),
        $txt    = $('#mapProgressTxt'),
        $btnDL  = $('#btnDownloadMap').prop('disabled', true);

  /* ---------- 4. Cache ---------- */
  const CACHE_KEY = 'assoGeoCacheV1';
  const geoCache  = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
  const saveCache = () => localStorage.setItem(CACHE_KEY, JSON.stringify(geoCache));

  /* ---------- 5. Géocodage ---------- */
  const fetchPos = addr => fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(addr)}`,
      { headers:{'Accept-Language':'fr'} })
    .then(r=>r.json()).then(js=>js[0]?[+js[0].lat,+js[0].lon]:null);

  /* ---------- 6. Plot ---------- */
  global.plotAssociations = async rows => {

    const todo  = rows.filter(a=>a.address);
    const total = todo.length; let done=0;

    const CHUNK=10;
    const tasks = todo.map(a=>async ()=>{
      const key=a.address; let pos=geoCache[key];
      if(!pos){ pos=await fetchPos(`${key} Niort`); if(pos){geoCache[key]=pos; saveCache();}}
      if(pos){ L.marker(pos,{icon:a.website?pinGreen:pinRed})
                 .addTo(map).bindPopup(`<strong>${a.title}</strong><br>${key}`);}
      done++; const pct=Math.round(done/total*100);
      $bar.css('width',pct+'%'); $txt.text(`${done} / ${total}`);
    });

    for(let i=0;i<tasks.length;i+=CHUNK){
      await Promise.all(tasks.slice(i,i+CHUNK).map(f=>f()));
      await new Promise(r=>setTimeout(r,1000));
    }

    /* Fin : retirer loader (supprime le nœud) */
    $loader.fadeOut(300, ()=>{ $loader.remove(); $btnDL.prop('disabled',false); });
  };

  /* ---------- 7. Download PNG ---------- */
  $btnDL.off().on('click', async ()=>{

    const rows   = JSON.parse(localStorage.getItem('assosRaw')||'[]');
    const total  = rows.length;
    const noSite = rows.filter(r=>!r.website).length;
    const pct    = Math.round(noSite/total*100);

    const canvas = await html2canvas(document.getElementById('niortMap'),
                                     {useCORS:true, backgroundColor:null});

    const ctx=canvas.getContext('2d');
    ctx.fillStyle='rgba(0,0,0,0.65)';
    ctx.fillRect(8,8,200,50);
    ctx.fillStyle='#fff'; ctx.font='14px sans-serif';
    ctx.fillText(`Associations : ${total}`,16,30);
    ctx.fillText(`Sans site   : ${pct}%`,   16,48);

    canvas.toBlob(b=>{
      const link=document.createElement('a');
      link.href=URL.createObjectURL(b);
      link.download='carte_associations_niort.png';
      link.click(); URL.revokeObjectURL(link.href);
    },'image/png');
  });

})(window,jQuery);
