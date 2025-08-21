// static/js/assoNiort/deals-kanban.js
// Version "global" : s’appuie sur window.esc / window.debounce / window.fetchJSON

(function(){
  // Fallbacks au cas où common-utils n’est pas encore chargé
  const esc = (window.esc) || function (s) {
    return String(s ?? '')
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  };
  const debounce = (window.debounce) || function(fn, ms){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn.apply(null,a),ms); }; };
  const fetchJSON = (window.fetchJSON) || (async (url, opts)=>{ const r=await fetch(url,opts); if(!r.ok) throw new Error(await r.text()); return r.json(); });

  const STAGES = [
    { key:'CONTACTED',            label:'Démarché',         cls:'badge-primary',  group:'PROSPECT' },
    { key:'RESPONSE_POSITIVE',    label:'Réponse +',        cls:'badge-success',  group:'PROSPECT' },
    { key:'MEETING_SCHEDULED',    label:'RDV planifié',     cls:'badge-info',     group:'MEET'     },
    { key:'MEETING_DONE_POSITIVE',label:'RDV OK',           cls:'badge-info',     group:'MEET'     },
    { key:'MOCKUP_DONE',          label:'Maquette envoyée', cls:'badge-warning',  group:'MOCKUP'   },
    { key:'QUOTE_SENT',           label:'Devis envoyé',     cls:'badge-secondary',group:'QUOTE'    },
    { key:'WON',                  label:'Accepté',          cls:'badge-success',  group:'RESULT'   },
    { key:'LOST',                 label:'Refusé',           cls:'badge-dark',     group:'RESULT'   },
  ];

  const els = {};
  const state = { rows: [], filtered: [], viewFilter:'ALL' };

  document.addEventListener('DOMContentLoaded', init);

  function init(){
    els.board     = document.getElementById('kanbanBoard');
    els.dealQ     = document.getElementById('dealQ');
    els.dealOwner = document.getElementById('dealOwner');
    els.dealCount = document.getElementById('dealCount');
    els.viewBtns  = Array.from(document.querySelectorAll('#kanbanView label[data-view]'));
    if (!els.board) return;

    renderEmptyColumns();

    const tab = document.getElementById('tab-pipeline-link');
    if (tab) {
      // charge la 1re fois quand l’onglet “Pipeline” devient visible
      tab.addEventListener('shown.bs.tab', () => loadDeals(true), { once:true });
      // rafraîchit quand on crée un deal depuis la grille
      window.addEventListener('deal:created', (e)=> loadDeals(false, e.detail && e.detail.id));
    } else {
      loadDeals(true);
    }

    els.dealQ && els.dealQ.addEventListener('input', debounce(applyAndRender, 150));
    els.dealOwner && els.dealOwner.addEventListener('change', applyAndRender);
    els.viewBtns.forEach(b=> b.addEventListener('click', ()=>{
      state.viewFilter = b.getAttribute('data-view') || 'ALL';
      applyAndRender();
    }));

    // utilitaire public
    window.reloadDeals = () => loadDeals(false);
  }

  async function loadDeals(first, highlightId=null){
    try{
      const rows = await fetchJSON('/api/deals');
      state.rows = Array.isArray(rows) ? rows : [];
      applyAndRender(highlightId);
    }catch(e){
      console.error('loadDeals', e);
      state.rows = [];
      applyAndRender();
    }
  }

  function applyAndRender(highlightId=null){
    const q = (els.dealQ?.value || '').trim().toLowerCase();
    const own = (els.dealOwner?.value || '').trim();

    let arr = state.rows.filter(d => {
      // on masque les deals non affectés (association retirée)
      const hasAssoc = (d.association_id != null) || (d.association_title && d.association_title.trim() !== '');
      if (!hasAssoc) return false;

      if (own && (d.owner||'') !== own) return false;
      if (!q) return true;
      const hay = [d.title, d.association_title].join(' ').toLowerCase();
      return hay.includes(q);
    });

    state.filtered = arr;
    renderBoard(arr, highlightId);
    els.dealCount && (els.dealCount.textContent = `${arr.length} deal(s)`);
  }

  function renderEmptyColumns(){
    els.board.innerHTML = '';
    const frag = document.createDocumentFragment();
    STAGES.forEach(st => {
      const col = document.createElement('div');
      col.className = 'kanban-col card shadow-sm';
      col.setAttribute('data-stage-col', st.key);
      col.setAttribute('data-group', st.group);
      col.innerHTML = `
        <div class="kanban-header d-flex align-items-center">
          <span>${st.label}</span>
          <span class="badge badge-light" data-count="${st.key}">0</span>
        </div>
        <div class="kanban-drop" data-stage="${st.key}"></div>
      `;
      const drop = col.querySelector('.kanban-drop');
      drop.addEventListener('dragover', (e)=>{ e.preventDefault(); drop.classList.add('drag-over'); });
      drop.addEventListener('dragleave', ()=> drop.classList.remove('drag-over'));
      drop.addEventListener('drop', (e)=>{
        e.preventDefault();
        drop.classList.remove('drag-over');
        const id = e.dataTransfer.getData('text/plain');
        const card = document.querySelector(`.kanban-card[data-id="${CSS.escape(id)}"]`);
        if (!card) return;
        const fromStage = card.getAttribute('data-stage');
        if (fromStage === st.key) return;

        drop.appendChild(card);
        card.setAttribute('data-stage', st.key);
        updateCounts();

        patchStage(id, st.key).catch(err => {
          console.error('PATCH failed, revert', err);
          const from = els.board.querySelector(`.kanban-drop[data-stage="${fromStage}"]`);
          if (from) from.appendChild(card);
          card.setAttribute('data-stage', fromStage);
          updateCounts();
          alert('Impossible de changer l’étape (voir logs).');
        });
      });

      frag.appendChild(col);
    });
    els.board.appendChild(frag);
  }

  function renderBoard(list, highlightId=null){
    const activeGroup = state.viewFilter;
    els.board.querySelectorAll('[data-stage-col]').forEach(col=>{
      const grp = col.getAttribute('data-group') || 'PROSPECT';
      col.style.display = (activeGroup==='ALL' || grp===activeGroup) ? '' : 'none';
    });
    els.board.querySelectorAll('.kanban-drop').forEach(d => d.innerHTML = '');

    list.forEach(d => {
      const card = document.createElement('div');
      card.className = 'kanban-card';
      card.setAttribute('draggable', 'true');
      card.setAttribute('data-id', String(d.id));
      card.setAttribute('data-stage', d.stage || '');

      const badgeCls = (STAGES.find(s=>s.key===d.stage)?.cls) || 'badge-secondary';
      const when = d.updated_at ? new Date(d.updated_at).toLocaleString() : '';
      const assoc = d.association_title ? `<div class="small text-muted"><i class="fas fa-users mr-1"></i>${esc(d.association_title)}</div>` : '';

      // ── bouton retirer l’affectation ─────────────────────────
      // supprime l’association du deal, puis enlève la carte du board
      const unlinkBtnHtml = `
        <button type="button" class="btn btn-sm btn-outline-danger ml-2" data-action="unlink"
                title="Retirer l’association (la carte sera retirée)">
          <i class="fas fa-unlink"></i>
        </button>
      `;

      card.innerHTML = `
        <div class="d-flex justify-content-between align-items-start">
          <div class="font-weight-bold">${esc(d.title || '—')}</div>
          <div class="d-flex align-items-center">
            <span class="badge ${badgeCls} stage-badge">${esc(stageLabel(d.stage))}</span>
            ${unlinkBtnHtml}
          </div>
        </div>
        ${assoc}
        <div class="small mt-1">
          <i class="fas fa-user mr-1"></i>${esc(d.owner || '—')}
          ${when ? `<span class="text-muted ml-2"><i class="far fa-clock mr-1"></i>${esc(when)}</span>` : ''}
        </div>
      `;
      card.addEventListener('dragstart', (e)=>{
        e.dataTransfer.setData('text/plain', String(d.id));
        e.dataTransfer.effectAllowed = 'move';
      });

      // action unlink
      const unlinkBtn = card.querySelector('[data-action="unlink"]');
      if (unlinkBtn) {
        unlinkBtn.addEventListener('click', async (ev) => {
          ev.stopPropagation();
          const ok = confirm("Retirer l’association de ce deal ?\nLa carte sera retirée du pipeline.");
          if (!ok) return;
          try {
            await unlinkAssociation(d.id);
            // maj state en mémoire
            const idx = state.rows.findIndex(x => Number(x.id) === Number(d.id));
            if (idx >= 0) {
              state.rows[idx].association_id = null;
              state.rows[idx].association_title = null;
            }
            // retire la carte du DOM + refresh compteurs
            card.parentElement && card.parentElement.removeChild(card);
            updateCounts();
          } catch (err) {
            console.error('unlink failed', err);
            alert("Impossible de retirer l’affectation (voir logs).");
          }
        });
      }

      const col = els.board.querySelector(`.kanban-drop[data-stage="${CSS.escape(d.stage || '')}"]`)
               || els.board.querySelector(`.kanban-drop[data-stage="CONTACTED"]`);
      col.appendChild(card);

      if (highlightId && Number(highlightId) === Number(d.id)) {
        card.classList.add('shadow', 'border', 'border-primary');
        setTimeout(()=> card.scrollIntoView({ behavior:'smooth', block:'center' }), 150);
        setTimeout(()=> card.classList.remove('shadow','border','border-primary'), 2000);
      }
    });

    updateCounts();
  }

  function updateCounts(){
    STAGES.forEach(st => {
      const box = els.board.querySelector(`[data-count="${CSS.escape(st.key)}"]`);
      const drop = els.board.querySelector(`.kanban-drop[data-stage="${CSS.escape(st.key)}"]`);
      if (box && drop) box.textContent = String(drop.children.length);
    });
  }

  function stageLabel(key){
    return (STAGES.find(s => s.key === key)?.label) || key || '';
  }

  function patchStage(id, toStage){
    return fetch(`/api/deals/${encodeURIComponent(id)}/stage`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to_stage: toStage })
    }).then(r => {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Retirer l’affectation (unlink association) d’un deal
  // Tente PATCH /api/deals/<id>/association, sinon fallback PATCH /api/deals/<id>
  // ─────────────────────────────────────────────────────────────
  async function unlinkAssociation(id){
    // endpoint préféré
    let res = await fetch(`/api/deals/${encodeURIComponent(id)}/association`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ association_id: null })
    });

    if (res.ok) return res.json();

    // fallback générique
    res = await fetch(`/api/deals/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ association_id: null })
    });
    if (!res.ok) {
      const txt = await res.text().catch(()=> '');
      throw new Error(`unlinkAssociation failed: ${res.status} ${res.statusText} ${txt}`);
    }
    return res.json();
  }
})();
