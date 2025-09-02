import { loadIndex } from './index-loader.js';

const $ = sel => document.querySelector(sel);

function renderResults(list, mount) {
  if (!list.length) {
    mount.innerHTML = `<p class="muted">No matches. Try fewer keywords or remove filters.</p>`;
    return;
  }
  mount.innerHTML = list.map(({ item }) => `
    <article class="result">
      <a class="result-link" href="${item.url}">
        ${item.img ? `<img class="thumb" loading="lazy" src="${item.img}" alt="">` : ''}
        <div class="meta">
          <h3>${escapeHtml(item.title || '(untitled)')}</h3>
          <p class="snip">${escapeHtml(item.text.slice(0, 180))}…</p>
          <p class="tags">
            ${item.type ? `<span class="tag">${item.type}</span>` : ''}
            ${item.year ? `<span class="tag">${item.year}</span>` : ''}
            ${item.date ? `<span class="muted">${new Date(item.date).toLocaleString()}</span>` : ''}
          </p>
        </div>
      </a>
    </article>
  `).join('');
}

function escapeHtml(s){ return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

(async function init() {
  const qInput  = $('#q');
  const typeSel = $('#type');
  const yearSel = $('#year');
  const out     = $('#results');

  const idx = await loadIndex();

  // populate years
  const years = Array.from(new Set(idx.items.map(x => x.year).filter(Boolean))).sort((a,b)=>b-a);
  yearSel.innerHTML = `<option value="">All years</option>` + years.map(y => `<option>${y}</option>`).join('');

  // Fuse from global (loaded via CDN)
  const fuse = new window.Fuse(idx.items, {
    includeScore: true,
    ignoreLocation: true,
    threshold: 0.3,
    keys: ['title', 'text']
  });

  function applyFilters(list) {
    const t = typeSel.value;
    const y = yearSel.value ? Number(yearSel.value) : null;
    return list.filter(({ item }) => (!t || item.type === t) && (!y || item.year === y));
  }

  function search() {
    const q = qInput.value.trim();
    let results = q ? fuse.search(q) : idx.items.map(i => ({ item: i, score: 1 }));
    results = applyFilters(results).slice(0, 200);
    renderResults(results, out);
    history.replaceState(null, '', `?q=${encodeURIComponent(q)}${typeSel.value?`&type=${typeSel.value}`:''}${yearSel.value?`&year=${yearSel.value}`:''}`);
  }

  // restore from URL
  const params = new URLSearchParams(location.search);
  qInput.value  = params.get('q') || '';
  typeSel.value = params.get('type') || '';
  yearSel.value = params.get('year') || '';

  ['input','change'].forEach(ev => qInput.addEventListener(ev, search));
  typeSel.addEventListener('change', search);
  yearSel.addEventListener('change', search);

  search();
})();
