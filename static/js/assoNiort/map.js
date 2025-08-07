// static/js/assoNiort/map.js
;(function(window, $, L){
  let map;

  function initMap(){
    // 1) crée la carte et centre sur Niort
    map = L.map('niortMap', { zoomControl:false })
           .setView([46.323, -0.464], 13);

    // 2) tuile OSM
    L.tileLayer(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      { maxZoom:19, attribution:'© OpenStreetMap' }
    ).addTo(map);

    // 3) dès que la tuile de base est chargée, on cache le loader.
    //    Leaflet émet "load" sur le layer
    map.on('load', () => {
      // $('#mapLoader').fadeOut(300);
    });
  }

  // Expose la fonction
  window.initMap = initMap;

})(window, jQuery, L);
