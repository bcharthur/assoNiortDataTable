// static/js/assoNiort/common-utils.js
(function () {
  function esc(s) {
    return String(s ?? '')
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  }
  function debounce(fn, ms) {
    let t; return function (...args) {
      clearTimeout(t); t = setTimeout(() => fn.apply(this, args), ms);
    };
  }
  async function fetchJSON(url, opts) {
    const r = await fetch(url, opts);
    if (!r.ok) {
      const txt = await r.text().catch(()=> '');
      throw new Error(`HTTP ${r.status} ${r.statusText}: ${txt}`);
    }
    return r.json();
  }
  // Expose global
  window.esc = esc;
  window.debounce = debounce;
  window.fetchJSON = fetchJSON;
})();
