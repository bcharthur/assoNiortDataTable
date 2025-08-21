// static/js/assoNiort/associations-dashboard.js
// Version "global" (pas d'import ES). Requiert que common-utils.js soit chargé avant.
(function () {
  const { esc, debounce, fetchJSON } = window;
  const state = { src: [], view: [], statsMap: {} };
  const els = {};
  const qs = (id) => document.getElementById(id);

  document.addEventListener('DOMContentLoaded', async () => {
    els.q = qs('q');
    els.sort = qs('sort');
    els.cardGrid = qs('cardGrid');
    els.emptyState = qs('emptyState');
    els.cardsCount = qs('cardsCount');
    els.loading = qs('cardsLoading');
    els.btnRefresh = qs('btnRefreshAssos');

    els.filterCat = qs('filterCat');
    els.filterSub = qs('filterSub');
    els.siteRadios = Array.from(document.querySelectorAll('input[name="siteRadio"]'));

    // Modale "Nouvelle opportunité"
    els.newDealModal = $('#newDealModal');
    els.dealAssocId = qs('dealAssocId');
    els.dealTitle = qs('dealTitle');
    els.dealAssocHelp = qs('dealAssocNameHelp');
    els.dealOwnerSel = qs('dealOwnerSelect');
    els.dealStageSel = qs('dealStageSelect');
    els.dealNotes = qs('dealNotes');
    els.newDealForm = qs('newDealForm');
    els.dealCreateBtn = qs('dealCreateBtn');

    setLoading(true);
    try {
      const [assos, stats] = await Promise.all([
        fetchJSON('/api/assos'),
        fetchJSON('/api/stats/category').catch(() => ({})),
      ]);
      state.src = Array.isArray(assos) ? assos : [];
      state.statsMap = stats || {};

      buildCategories(state.src);
      buildSubcategories(state.src);
      applyAndRender();

      // Utilise la version globale si chargée
      if (typeof window.buildDashCards === 'function') {
        try { window.buildDashCards(state.src, state.statsMap); } catch (e) { console.warn(e); }
      }
    } finally {
      setLoading(false);
    }

    if (els.q) els.q.addEventListener('input', debounce(applyAndRender, 150));
    if (els.sort) els.sort.addEventListener('change', applyAndRender);
    if (els.filterCat) els.filterCat.addEventListener('change', () => {
      buildSubcategories(state.src);
      applyAndRender();
    });
    if (els.filterSub) els.filterSub.addEventListener('change', applyAndRender);
    els.siteRadios.forEach(r => r.addEventListener('change', applyAndRender));
    if (els.btnRefresh) els.btnRefresh.addEventListener('click', onRefresh);

    if (els.newDealForm) els.newDealForm.addEventListener('submit', onCreateDealSubmit);
  });

  function uniqueSorted(arr) {
    return Array.from(new Set(arr.filter(Boolean)))
      .sort((a, b) => String(a).localeCompare(String(b), 'fr', { sensitivity: 'base' }));
  }
  function buildCategories(src) {
    if (!els.filterCat) return;
    const cats = uniqueSorted(src.map(a => a.category));
    const cur = els.filterCat.value || '';
    els.filterCat.innerHTML = ['<option value="">Toutes catégories</option>']
      .concat(cats.map(c => `<option value="${esc(c)}"${c === cur ? ' selected' : ''}>${esc(c)}</option>`))
      .join('');
  }
  function buildSubcategories(src) {
    if (!els.filterSub) return;
    const cat = (els.filterCat && els.filterCat.value) || '';
    const subs = uniqueSorted(src.filter(a => !cat || a.category === cat).map(a => a.sub_category));
    const cur = els.filterSub.value || '';
    els.filterSub.innerHTML = ['<option value="">Toutes sous-catégories</option>']
      .concat(subs.map(s => `<option value="${esc(s)}"${s === cur ? ' selected' : ''}>${esc(s)}</option>`))
      .join('');
  }

  async function onRefresh() {
    setLoading(true);
    try {
      const assos = await fetchJSON('/api/assos?refresh=1');
      state.src = Array.isArray(assos) ? assos : [];
      buildCategories(state.src);
      buildSubcategories(state.src);
      applyAndRender();
      if (typeof window.buildDashCards === 'function') {
        try { window.buildDashCards(state.src, state.statsMap); } catch (e) { console.warn(e); }
      }
    } finally { setLoading(false); }
  }

  function applyAndRender() {
    const q = (els.q?.value || '').trim().toLowerCase();
    const cat = els.filterCat?.value || '';
    const sub = els.filterSub?.value || '';
    const site = (els.siteRadios.find(r => r.checked)?.value) || '';

    let arr = state.src.filter(a => {
      if (cat && a.category !== cat) return false;
      if (sub && a.sub_category !== sub) return false;
      if (site === 'with' && !a.website) return false;
      if (site === 'without' && a.website) return false;
      if (!q) return true;
      const hay = [a.title, a.category, a.sub_category, a.address, a.mail, a.manager, a.contact]
        .join(' ').toLowerCase();
      return hay.includes(q);
    });

    const s = els.sort?.value;
    arr.sort((a, b) => {
      if (s === 'name_desc') return cmp(b.title, a.title);
      if (s === 'category')  return cmp(a.category, b.category) || cmp(a.title, b.title);
      if (s === 'nosite_first') {
        const aw = a.website ? 1 : 0, bw = b.website ? 1 : 0;
        if (aw !== bw) return aw - bw;
        return cmp(a.title, b.title);
      }
      return cmp(a.title, b.title);
    });

    state.view = arr;
    renderCards(arr);
  }

  function renderCards(list) {
    if (els.cardsCount) els.cardsCount.textContent = `${list.length} élément(s)`;
    if (!list.length) {
      els.emptyState?.classList.remove('d-none');
      if (els.cardGrid) els.cardGrid.innerHTML = '';
      return;
    }
    els.emptyState?.classList.add('d-none');

    const df = document.createDocumentFragment();
    list.forEach(a => df.appendChild(renderCard(a)));
    if (els.cardGrid) {
      els.cardGrid.innerHTML = '';
      els.cardGrid.appendChild(df);
    }

    if (window.adjustVisibleTables) setTimeout(window.adjustVisibleTables, 0);
  }

  function renderCard(a) {
    const col = document.createElement('div');
    col.className = 'col mb-3';
    const hasSite = !!a.website;
    const badgeSite = hasSite
      ? '<span class="badge badge-success">Site</span>'
      : '<span class="badge badge-danger">Sans site</span>';
    const cat = esc(a.category || '—');
    const sub = esc(a.sub_category || '');
    const mail = a.mail ? `<a href="mailto:${esc(a.mail)}" class="text-decoration-none"><i class="far fa-envelope"></i> ${esc(a.mail)}</a>` : '<span class="text-muted">—</span>';
    const phone = a.phone ? `<span><i class="fas fa-phone"></i> ${esc(a.phone)}</span>` : '';
    const mobile = a.mobile ? `<span class="ml-2"><i class="fas fa-mobile-alt"></i> ${esc(a.mobile)}</span>` : '';
    const website = a.website ? linkifyWebsite(a.website) : '';

    col.innerHTML = `
      <div class="card h-100 shadow-sm">
        <div class="card-body d-flex flex-column">
          <div class="d-flex align-items-start justify-content-between">
            <h5 class="card-title mb-1">${esc(a.title || '')}</h5>
            ${badgeSite}
          </div>
          <div class="small text-muted mb-2">
            <i class="fas fa-tag mr-1"></i>${cat}${sub ? ' · ' + esc(sub) : ''}
          </div>
          <div class="mb-2 small">
            <i class="fas fa-map-marker-alt mr-1"></i>${esc(a.address || '—')}
          </div>
          <div class="mb-2 small d-flex flex-wrap align-items-center">
            ${mail}
            ${phone}
            ${mobile}
            ${website ? `<span class="ml-2"><i class="fas fa-globe"></i> ${website}</span>` : ''}
          </div>
          <div class="mt-auto d-flex align-items-center">
            <button class="btn btn-sm btn-outline-primary mr-2" data-action="detail">
              <i class="far fa-eye"></i> Détails
            </button>
            ${a.mail ? `<button class="btn btn-sm btn-outline-secondary" data-action="mail">
              <i class="far fa-paper-plane"></i> E-mail
            </button>` : ''}
            <div class="ml-auto">
              <button class="btn btn-sm btn-success" data-action="deal">
                <i class="fas fa-flag"></i> Opportunité
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
    col.querySelector('[data-action="detail"]')?.addEventListener('click', () => openDetailModal(a));
    col.querySelector('[data-action="mail"]')?.addEventListener('click', () => openMailModal(a));
    col.querySelector('[data-action="deal"]')?.addEventListener('click', () => openNewDealModal(a));
    return col;
  }

  function openNewDealModal(a) {
    if (!els.newDealModal) return;
    if (els.dealAssocId) els.dealAssocId.value = a.id;
    if (els.dealTitle) els.dealTitle.value = `Site — ${a.title || ''}`;
    if (els.dealAssocHelp) els.dealAssocHelp.textContent = a.title || '';
    if (els.dealNotes) els.dealNotes.value = '';
    if (els.dealOwnerSel) els.dealOwnerSel.value = 'Théo';
    if (els.dealStageSel) els.dealStageSel.value = 'CONTACTED';
    els.newDealModal.modal('show');
  }

  async function onCreateDealSubmit(e) {
    e.preventDefault();
    const payload = {
      title: (els.dealTitle?.value || '').trim(),
      association_id: Number(els.dealAssocId?.value) || null,
      owner: els.dealOwnerSel?.value || '',
      stage: els.dealStageSel?.value || 'CONTACTED',
      notes: els.dealNotes?.value || ''
    };
    if (!payload.title) { alert('Titre requis'); return; }
    if (els.dealCreateBtn) els.dealCreateBtn.disabled = true;
    try {
      const res = await fetch('/api/deals/', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(await res.text());
      const js = await res.json();
      els.newDealModal.modal('hide');
      $('#tab-pipeline-link').tab('show');
      window.dispatchEvent(new CustomEvent('deal:created', { detail: { id: js.id } }));
    } catch (err) {
      console.error(err); alert('Création impossible');
    } finally {
      if (els.dealCreateBtn) els.dealCreateBtn.disabled = false;
    }
  }

  function openDetailModal(a) {
    const titleEl = document.getElementById('assoTitle');
    const bodyEl = document.getElementById('assoBody');
    if (!titleEl || !bodyEl) return;
    titleEl.textContent = a.title || '';
    bodyEl.innerHTML = `
      <div class="row">
        <div class="col-md-6">
          <h6 class="text-primary">Infos</h6>
          <ul class="list-unstyled small">
            <li><strong>Catégorie :</strong> ${esc(a.category || '—')}</li>
            <li><strong>Sous-catégorie :</strong> ${esc(a.sub_category || '—')}</li>
            <li><strong>Adresse :</strong> ${esc(a.address || '—')}</li>
          </ul>
        </div>
        <div class="col-md-6">
          <h6 class="text-primary">Contact</h6>
          <ul class="list-unstyled small">
            <li><strong>Responsable :</strong> ${esc(a.manager || '—')}</li>
            <li><strong>Contact :</strong> ${esc(a.contact || '—')}</li>
            <li><strong>Téléphone :</strong> ${esc(a.phone || '—')}</li>
            <li><strong>Mobile :</strong> ${esc(a.mobile || '—')}</li>
            <li><strong>Mail :</strong> ${a.mail ? `<a href="mailto:${esc(a.mail)}">${esc(a.mail)}</a>` : '—'}</li>
            <li><strong>Site :</strong> ${a.website ? linkifyWebsite(a.website) : '—'}</li>
          </ul>
        </div>
      </div>
      ${a.description ? `<hr><div class="small"><strong>Description :</strong><br>${esc(a.description)}</div>` : ''}
    `;
    $('#assoModal').modal('show');
  }
  function openMailModal(a) {
    const assoName = document.getElementById('mailAssoName');
    const mailTo = document.getElementById('mailTo');
    const subj = document.getElementById('mailSubject');
    const body = document.getElementById('mailBody');
    const link = document.getElementById('mailtoLink');
    if (!assoName || !mailTo || !subj || !body || !link) return;
    assoName.textContent = a.title || '';
    mailTo.textContent = a.mail || '';
    subj.value = `Contact — ${a.title || ''}`;
    body.value = `Bonjour,\n\nJe me permets de vous contacter au sujet de ...\n\nCordialement,\nAstroWeb`;
    const href = `mailto:${encodeURIComponent(a.mail || '')}?subject=${encodeURIComponent(subj.value)}&body=${encodeURIComponent(body.value)}`;
    link.setAttribute('href', href);
    $('#mailModal').modal('show');
  }

  function cmp(a, b) { const sa = String(a || '').toLowerCase(), sb = String(b || '').toLowerCase(); return sa < sb ? -1 : sa > sb ? 1 : 0; }
  function linkifyWebsite(u) { u = String(u || '').trim(); if (!u) return ''; const href = /^https?:\/\//i.test(u) ? u : 'http://' + u; const short = u.replace(/^https?:\/\//i, '').replace(/\/$/, ''); return `<a href="${esc(href)}" target="_blank" rel="noopener">${esc(short)}</a>`; }
  function setLoading(on) { if (!els.loading) return; els.loading.classList.toggle('d-none', !on); }
})();
