/* TABASAM Fellowship Dashboard
 * Reads data/monthly.csv, data/by_level.csv, data/regions.csv and data/meta.json.
 * Nothing in this file holds figures: every number on the page comes from the data files.
 */
(() => {
  const fmt = d3.format(',');
  const LEVELS = ['Pre-primary', 'Primary', 'Secondary'];
  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const short = (label) => String(label).slice(0, 3);
  const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : null);
  const tipEl = document.getElementById('tip');
  const ALL = 'all';
  const S = { monthly: [], levels: [], regions: [], period: ALL, total: null };

  // ---------- tooltip ----------
  const tip = {
    show(ev, head, line) {
      const h = document.createElement('div'); h.className = 'h'; h.textContent = head;
      const b = document.createElement('div'); b.textContent = line;
      tipEl.replaceChildren(h, b); tipEl.hidden = false;
      const w = tipEl.offsetWidth, hgt = tipEl.offsetHeight;
      let x = ev.clientX + 14; if (x + w > window.innerWidth - 8) x = ev.clientX - w - 14;
      let y = ev.clientY - hgt - 10; if (y < 8) y = ev.clientY + 16;
      tipEl.style.left = Math.max(8, x) + 'px'; tipEl.style.top = y + 'px';
    },
    hide() { tipEl.hidden = true; }
  };
  const hover = (sel, head, line) => sel
    .on('mousemove', (ev) => tip.show(ev, head, line))
    .on('mouseleave', tip.hide)
    .on('touchstart', (ev) => { const t = ev.touches[0]; tip.show(t, head, line); }, { passive: true });

  // ---------- data ----------
  const num = (r, keys) => { keys.forEach((k) => { r[k] = r[k] === '' || r[k] == null ? null : Number(r[k]); }); return r; };

  Promise.all([
    d3.csv('data/monthly.csv'),
    d3.csv('data/by_level.csv'),
    d3.csv('data/regions.csv'),
    d3.json('data/meta.json').catch(() => ({}))
  ]).then(([monthly, levels, regions, meta]) => {
    S.monthly = monthly
      .map((r) => num(r, ['learners', 'girls', 'boys', 'pwd', 'improved', 'improved_girls', 'improved_boys', 'completed', 'institutions', 'educators']))
      .sort((a, b) => d3.ascending(a.period, b.period))
      .map((r, i, all) => {
        r.improved_pct = pct(r.improved, r.learners);
        r.prevRow = i > 0 ? all[i - 1] : null;
        return r;
      });
    S.levels = levels.map((r) => num(r, ['reached', 'improved']));
    S.regions = regions.map((r) => num(r, ['learners', 'schools']));
    S.total = totals();
    document.getElementById('updated').textContent = meta.updated ? d3.timeFormat('%-d %B %Y')(new Date(meta.updated)) : '—';
    if (S.monthly.length) {
      document.getElementById('range').textContent = `${S.monthly[0].label} to ${S.monthly[S.monthly.length - 1].label}`;
    }
    setupSelect();
    window.addEventListener('hashchange', () => { S.period = fromHash(); render(); });
    let t; window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(renderCharts, 120); });
    render();
  }).catch((err) => {
    console.error(err);
    document.querySelector('.take').textContent = 'The data files could not be loaded. If you opened index.html directly from your computer, run a local server instead (see README).';
  });

  // All months: learner counts are the monthly reports added up. Learner IDs restart each month, so a
  // learner reached in several months is counted in each. Institutions and educators are the highest
  // monthly figure, because adding them up would count the same schools and educators again.
  function totals() {
    const sum = (k) => (S.monthly.some((r) => r[k] != null) ? d3.sum(S.monthly, (r) => r[k]) : null);
    const t = { period: ALL, label: 'all months', months: S.monthly.length, prevRow: null, note: '', highlight: '' };
    ['learners', 'girls', 'boys', 'pwd', 'improved', 'improved_girls', 'improved_boys', 'completed'].forEach((k) => { t[k] = sum(k); });
    ['institutions', 'educators'].forEach((k) => { t[k] = d3.max(S.monthly, (r) => r[k]) ?? null; });
    t.improved_pct = pct(t.improved, t.learners);
    return t;
  }

  const fromHash = () => { const p = location.hash.slice(1); return S.monthly.some((r) => r.period === p) ? p : ALL; };
  const pick = (p) => { S.period = p; history.replaceState(null, '', p === ALL ? location.pathname : '#' + p); render(); };

  function setupSelect() {
    const sel = document.getElementById('month');
    sel.replaceChildren(new Option('All months', ALL), ...S.monthly.slice().reverse().map((r) => new Option(r.label, r.period)));
    S.period = fromHash();
    sel.value = S.period;
    sel.addEventListener('change', () => pick(sel.value));
  }

  const isAll = () => S.period === ALL;
  const current = () => (isAll() ? S.total : S.monthly.find((r) => r.period === S.period));
  const take = document.querySelector('.take').innerHTML;

  // ---------- text, tiles ----------
  function render() {
    const r = current(); if (!r) return;
    document.getElementById('month').value = r.period;
    const tk = document.querySelector('.take');
    if (isAll()) {
      tk.replaceChildren('Across ', bold(`${r.months} monthly reports`), ` (${document.getElementById('range').textContent}), TABASAM recorded `,
        bold(fmt(r.learners)), ' learners reached, and ', bold(`${r.improved_pct}%`), ' of them were marked as improved. Up to ',
        bold(fmt(r.institutions)), ' learning institutions took part in a single month.');
    } else if (tk.innerHTML !== take) tk.innerHTML = take;
    document.querySelectorAll('.tile .basis').forEach((el) => { el.hidden = !isAll(); });
    document.querySelectorAll('[data-k]').forEach((el) => {
      const k = el.dataset.k;
      let v;
      if (k === 'label') v = r.label;
      else if (k === 'prev') v = r.prevRow ? short(r.prevRow.label) : '—';
      else if (k === 'improved_pct') v = r.improved_pct == null ? '—' : `${r.improved_pct}%`;
      else v = r[k] == null ? '—' : fmt(r[k]);
      el.textContent = v;
    });
    document.querySelectorAll('[data-d]').forEach((el) => {
      const k = el.dataset.d, p = r.prevRow, box = el.closest('.delta');
      if (isAll()) { box.hidden = true; return; }
      box.hidden = false;
      if (!p || r[k] == null || p[k] == null) { box.classList.add('none'); return; }
      box.classList.remove('none');
      const d = r[k] - p[k];
      el.textContent = d > 0 ? `+${fmt(d)}` : d < 0 ? `−${fmt(-d)}` : '0';
      el.className = d > 0 ? 'up' : d < 0 ? 'down' : 'flat';
    });
    const hl = document.querySelector('#highlight');
    hl.hidden = !r.highlight;
    hl.lastElementChild.innerHTML = r.highlight ? `<b class="hl">Highlight, ${r.label}:</b> ` : '';
    if (r.highlight) hl.lastElementChild.append(r.highlight);
    const note = document.querySelector('#note .caveat span:last-child');
    note.textContent = isAll()
      ? `All months: learner figures add up the ${r.months} monthly reports. A learner reached in more than one month is counted in each month. Pick a month to see its own figures.`
      : r.note
      ? `Note on ${r.label}: ${r.note}`
      : r.source === 'learner records'
        ? `Figures for ${r.label} are counted from the learner, educator and school lists in TUSOME's monthly report to Sahara Consult.`
        : `Figures for ${r.label} are as submitted in the summary sheet of TUSOME's monthly report to Sahara Consult.`;
    renderCharts();
  }

  const bold = (text) => { const b = document.createElement('b'); b.textContent = text; return b; };

  // Level and region rows for the selected month, or added up across months for the all-months view.
  function levelRows() {
    const rows = isAll()
      ? d3.rollups(S.levels, (v) => ({ reached: d3.sum(v, (x) => x.reached), improved: d3.sum(v, (x) => x.improved) }), (x) => x.level)
        .map(([level, v]) => ({ level, ...v }))
      : S.levels.filter((x) => x.period === S.period);
    return LEVELS.map((L) => rows.find((x) => x.level === L)).filter(Boolean);
  }
  function regionRows() {
    if (!isAll()) return S.regions.filter((x) => x.period === S.period);
    return d3.rollups(S.regions, (v) => ({ learners: d3.sum(v, (x) => x.learners), schools: d3.max(v, (x) => x.schools) }), (x) => x.region)
      .map(([region, v]) => ({ region, ...v }));
  }

  function renderCharts() {
    drawReach(); drawRegions(); drawTrend();
    const r = current();
    const lv = levelRows().map((x) => ({ name: x.level, reached: x.reached, improved: x.improved }));
    hbars('#chart-level', lv, css('--c0'), `No level breakdown for ${r ? r.label : 'this month'}.`);
    const g = r && r.girls != null ? [
      { name: 'Girls', reached: r.girls, improved: r.improved_girls },
      { name: 'Boys', reached: r.boys, improved: r.improved_boys }
    ] : [];
    hbars('#chart-gender', g, css('--mutedbar'), 'No gender breakdown for this month.');
  }

  const svgIn = (node, W, H, label) => d3.select(node).append('svg')
    .attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img').attr('aria-label', label);
  const empty = (node, msg) => { const d = document.createElement('div'); d.className = 'empty'; d.textContent = msg; node.replaceChildren(d); };

  // ---------- reach by month, stacked by level ----------
  function drawReach() {
    const node = document.querySelector('#chart-reach'); node.replaceChildren();
    if (!S.monthly.length) return empty(node, 'No data yet.');
    const W = Math.max(300, node.clientWidth), H = 250, m = { l: 40, r: 6, t: 22, b: 26 };
    const x = d3.scaleBand(S.monthly.map((r) => r.period), [m.l, W - m.r]).padding(0.36);
    const y = d3.scaleLinear([0, d3.max(S.monthly, (r) => r.learners) || 1], [H - m.b, m.t]).nice();
    const svg = svgIn(node, W, H, 'Learners reached each month, by level');
    y.ticks(4).forEach((t) => {
      svg.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(t)).attr('y2', y(t)).attr('stroke', css(t === 0 ? '--axis' : '--grid'));
      svg.append('text').attr('x', m.l - 6).attr('y', y(t)).attr('dy', '0.35em').attr('text-anchor', 'end').text(fmt(t));
    });
    const colors = [css('--c0'), css('--c1'), css('--c2')];
    const bw = Math.min(x.bandwidth(), 56), off = (x.bandwidth() - bw) / 2;
    S.monthly.forEach((r) => {
      const on = isAll() || r.period === S.period;
      let acc = 0;
      LEVELS.forEach((L, i) => {
        const seg = S.levels.find((s) => s.period === r.period && s.level === L); if (!seg || !seg.reached) return;
        const rect = svg.append('rect').attr('x', x(r.period) + off).attr('width', bw)
          .attr('y', y(acc + seg.reached)).attr('height', Math.max(0, y(acc) - y(acc + seg.reached)))
          .attr('fill', colors[i]).attr('fill-opacity', on ? 1 : 0.38).style('cursor', 'pointer')
          .on('click', () => pick(r.period));
        hover(rect, `${r.label} · ${L}`, `${fmt(seg.reached)} learners`);
        acc += seg.reached;
      });
      svg.append('text').attr('x', x(r.period) + x.bandwidth() / 2).attr('y', y(r.learners) - 6).attr('text-anchor', 'middle')
        .attr('class', on ? 'strong' : null).text(fmt(r.learners));
      svg.append('text').attr('x', x(r.period) + x.bandwidth() / 2).attr('y', H - 8).attr('text-anchor', 'middle')
        .attr('class', on ? 'strong' : null).text(short(r.label));
    });
  }

  // ---------- improved share trend ----------
  function drawTrend() {
    const node = document.querySelector('#chart-trend'); node.replaceChildren();
    const rows = S.monthly.filter((r) => r.improved_pct != null);
    if (!rows.length) return empty(node, 'No data yet.');
    const W = Math.max(300, node.clientWidth), H = 250, m = { l: 42, r: 16, t: 24, b: 26 };
    const x = d3.scalePoint(rows.map((r) => r.period), [m.l + 14, W - m.r - 14]);
    const y = d3.scaleLinear([0, 100], [H - m.b, m.t]);
    const svg = svgIn(node, W, H, 'Share marked as improved, by month');
    [0, 25, 50, 75, 100].forEach((t) => {
      svg.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(t)).attr('y2', y(t)).attr('stroke', css(t === 0 ? '--axis' : '--grid'));
      svg.append('text').attr('x', m.l - 6).attr('y', y(t)).attr('dy', '0.35em').attr('text-anchor', 'end').text(`${t}%`);
    });
    const flagged = (r) => Boolean(r.note);
    const line = d3.line().x((r) => x(r.period)).y((r) => y(r.improved_pct));
    for (let i = 1; i < rows.length; i++) {
      const a = rows[i - 1], b = rows[i], dashed = flagged(a) || flagged(b);
      svg.append('path').attr('d', line([a, b])).attr('fill', 'none')
        .attr('stroke', dashed ? css('--mutedbar') : css('--c1')).attr('stroke-width', 2)
        .attr('stroke-linecap', 'round').attr('stroke-dasharray', dashed ? '4 4' : null);
    }
    rows.forEach((r) => {
      const on = r.period === S.period, cx = x(r.period), cy = y(r.improved_pct);
      const c = svg.append('circle').attr('cx', cx).attr('cy', cy).attr('r', on ? 5.5 : 3.8)
        .attr('fill', flagged(r) ? css('--warn') : css('--c1')).style('cursor', 'pointer')
        .on('click', () => pick(r.period));
      hover(c, r.label, `${r.improved_pct}% marked as improved (${fmt(r.improved)} of ${fmt(r.learners)})${r.note ? ' · ' + r.note : ''}`);
      svg.append('text').attr('x', cx).attr('y', cy - 11).attr('text-anchor', 'middle').attr('class', on ? 'strong' : null).text(`${r.improved_pct}%`);
      svg.append('text').attr('x', cx).attr('y', H - 8).attr('text-anchor', 'middle').attr('class', on ? 'strong' : null).text(short(r.label));
    });
  }

  // ---------- horizontal share bars (level, gender) ----------
  function hbars(selector, rows, color, emptyMsg) {
    const node = document.querySelector(selector); node.replaceChildren();
    rows = rows.filter((r) => r.reached > 0);
    if (!rows.length) return empty(node, emptyMsg);
    const W = Math.max(300, node.clientWidth), rowH = 30, H = rows.length * rowH + 6;
    const svg = svgIn(node, W, H, 'Improved share');
    // Measure every label used by the level and gender charts so both share one left edge.
    const names = [...new Set([...LEVELS, 'Girls', 'Boys', ...rows.map((r) => r.name)])];
    const probe = svg.selectAll('text.p').data(names).join('text').attr('class', 'p strong').text((n) => n);
    const left = Math.ceil(d3.max(probe.nodes(), (n) => n.getComputedTextLength()) || 60) + 14; probe.remove();
    const ep = svg.append('text').text('100% (8,888 of 8,888)'); const endW = Math.ceil(ep.node().getComputedTextLength()) + 10; ep.remove();
    const x = d3.scaleLinear([0, 100], [left, Math.max(left + 40, W - endW)]);
    rows.forEach((r, i) => {
      const y0 = 3 + i * rowH, rate = pct(r.improved, r.reached);
      svg.append('text').attr('x', left - 10).attr('y', y0 + rowH / 2).attr('dy', '0.35em').attr('text-anchor', 'end').attr('class', 'strong').text(r.name);
      svg.append('rect').attr('x', left).attr('y', y0 + 7).attr('width', x(100) - left).attr('height', rowH - 14).attr('rx', 3).attr('fill', css('--grid'));
      const bar = svg.append('rect').attr('x', left).attr('y', y0 + 7).attr('width', Math.max(0, x(rate) - left)).attr('height', rowH - 14).attr('rx', 3).attr('fill', color);
      hover(bar, r.name, `${rate}% improved (${fmt(r.improved)} of ${fmt(r.reached)})`);
      const t = svg.append('text').attr('x', x(rate) + 6).attr('y', y0 + rowH / 2).attr('dy', '0.35em');
      t.append('tspan').attr('class', 'strong').text(`${rate}%`);
      t.append('tspan').text(` (${fmt(r.improved)} of ${fmt(r.reached)})`);
    });
  }

  // ---------- regions for the selected month ----------
  function drawRegions() {
    const node = document.querySelector('#chart-regions'); node.replaceChildren();
    const r = current();
    const rows = regionRows().sort((a, b) => d3.descending(a.learners, b.learners));
    if (!rows.length) return empty(node, `Region figures for ${r ? r.label : 'this month'} have not been imported yet.`);
    const W = Math.max(300, node.clientWidth), rowH = 32, H = rows.length * rowH + 6;
    const svg = svgIn(node, W, H, 'Learners by region');
    const probe = svg.selectAll('text.p').data(rows).join('text').attr('class', 'p strong').text((d) => d.region);
    const left = Math.ceil(d3.max(probe.nodes(), (n) => n.getComputedTextLength()) || 80) + 14; probe.remove();
    const ep = svg.append('text').text('8,888 learners · 88 schools'); const endW = Math.ceil(ep.node().getComputedTextLength()) + 10; ep.remove();
    const x = d3.scaleLinear([0, d3.max(rows, (d) => d.learners) || 1], [left, Math.max(left + 40, W - endW)]);
    rows.forEach((d, i) => {
      const y0 = 3 + i * rowH;
      svg.append('text').attr('x', left - 10).attr('y', y0 + rowH / 2).attr('dy', '0.35em').attr('text-anchor', 'end').attr('class', 'strong').text(d.region);
      const bar = svg.append('rect').attr('x', left).attr('y', y0 + 8).attr('width', Math.max(2, x(d.learners) - left)).attr('height', rowH - 16).attr('rx', 3)
        .attr('fill', i === 0 ? css('--c0') : css('--mutedbar'));
      const schools = d.schools == null ? '' : ` · ${fmt(d.schools)} ${d.schools === 1 ? 'school' : 'schools'}`;
      hover(bar, d.region, `${fmt(d.learners)} learners${schools}`);
      const t = svg.append('text').attr('x', Math.max(left + 2, x(d.learners)) + 6).attr('y', y0 + rowH / 2).attr('dy', '0.35em');
      t.append('tspan').attr('class', 'strong').text(fmt(d.learners));
      t.append('tspan').text(` learners${schools}`);
    });
  }

  // Redraw charts when the colour scheme changes (light/dark).
  if (window.matchMedia) window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (S.monthly.length) renderCharts(); });
})();
