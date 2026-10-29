/* TABASAM Fellowship Dashboard
 * Reads data/monthly.csv, data/by_level.csv, data/regions.csv and data/meta.json.
 * Nothing in this file holds figures: every number on the page comes from the data files.
 */
(() => {
  const fmt = d3.format(',');
  const LEVELS = ['Pre-primary', 'Primary', 'Secondary', 'Tertiary', 'Professional'];
  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const short = (label) => String(label).slice(0, 3);
  const pct = (a, b) => (a != null && b > 0 ? Math.round((a / b) * 100) : null);
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
    d3.json('data/meta.json').catch(() => ({})),
    d3.csv('data/milestones.csv').catch(() => []),
    d3.csv('data/partners.csv').catch(() => []),
    d3.json('assets/tza-regions.json').catch(() => null)
  ]).then(([monthly, levels, regions, meta, milestones, partners, geo]) => {
    S.milestones = milestones; S.partners = partners; S.geo = geo;
    S.monthly = monthly
      .map((r) => num(r, ['learners', 'girls', 'boys', 'pwd', 'improved', 'improved_girls', 'improved_boys', 'completed', 'institutions', 'educators',
        'needs_support', 'educators_female', 'educators_male']))
      .sort((a, b) => d3.ascending(a.period, b.period))
      .map((r, i, all) => {
        r.improved_pct = pct(r.improved, r.learners);
        r.prevRow = i > 0 ? all[i - 1] : null;
        return r;
      });
    S.levels = levels.map((r) => num(r, ['reached', 'improved']));
    S.regions = regions.map((r) => num(r, ['learners', 'schools', 'improved']));
    S.total = totals();
    S.target = meta.target || null;
    document.getElementById('updated').textContent = meta.updated ? d3.timeFormat('%-d %B %Y')(new Date(meta.updated)) : '—';
    if (S.monthly.length) {
      document.getElementById('range').textContent = `${S.monthly[0].label} to ${S.monthly[S.monthly.length - 1].label}`;
    }
    setupSelect();
    setupNav();
    window.addEventListener('hashchange', () => { S.period = fromHash(); render(); });
    let t; window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(renderCharts, 120); });
    render();
  }).catch((err) => {
    console.error(err);
    document.querySelector('.take').textContent = 'The data files could not be loaded. If you opened index.html directly from your computer, run a local server instead (see README).';
  });

  // All months: every count is the monthly reports added up, as TUSOME reports them.
  function totals() {
    const sum = (k) => (S.monthly.some((r) => r[k] != null) ? d3.sum(S.monthly, (r) => r[k]) : null);
    const t = { period: ALL, label: 'all months', months: S.monthly.length, prevRow: null, note: '', highlight: '', priority: '' };
    ['learners', 'girls', 'boys', 'pwd', 'improved', 'improved_girls', 'improved_boys', 'completed', 'institutions', 'educators',
      'needs_support', 'educators_female', 'educators_male'].forEach((k) => { t[k] = sum(k); });
    // Improved share counts only months in which learning outcomes were assessed.
    const assessed = S.monthly.filter((r) => r.improved != null);
    t.assessed = d3.sum(assessed, (r) => r.learners);
    t.assessed_girls = d3.sum(assessed, (r) => r.girls);
    t.assessed_boys = d3.sum(assessed, (r) => r.boys);
    t.improved_pct = pct(t.improved, t.assessed);
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

  // ---------- text, tiles ----------
  function render() {
    const r = current(); if (!r) return;
    document.getElementById('month').value = r.period;
    const tk = document.querySelector('.take');
    if (isAll()) {
      tk.replaceChildren('Across ', bold(`${r.months} monthly reports`), ` (${document.getElementById('range').textContent}), TABASAM reached `,
        bold(fmt(r.learners)), ' learners in ', bold(fmt(r.institutions)), ' learning institutions, with ', bold(fmt(r.educators)),
        ' educators. ', bold(`${r.improved_pct}%`), ' of learners assessed demonstrated improved learning outcomes.');
    } else {
      tk.replaceChildren('In ', bold(r.label), ', TABASAM reached ', bold(fmt(r.learners)), ' learners in ', bold(fmt(r.institutions)),
        ` learning ${r.institutions === 1 ? 'institution' : 'institutions'}`,
        ...(r.improved_pct == null ? ['.'] : [', and ', bold(`${r.improved_pct}%`), ' of them demonstrated improved learning outcomes.']));
    }
    const first = S.monthly[0], last = S.monthly[S.monthly.length - 1];
    document.getElementById('asof').textContent = isAll()
      ? `Data: ${first.label} – ${last.label}` : `Showing ${r.label} · data to ${last.label}`;
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
    // Two lines under the headline, from the month's narrative report. Notes on the figures are shown in the
    // improved-share chart instead; the box is hidden for the all-months view.
    const line = (sel, head, text) => {
      const el = document.querySelector(sel); el.hidden = !text;
      el.lastElementChild.replaceChildren(...(text ? [head ? Object.assign(bold(head), { className: 'hl' }) : '', head ? ' ' : '', text] : []));
    };
    line('#highlight', `Highlight, ${r.label}:`, r.highlight);
    line('#priority', 'Priority for the next month:', r.priority);
    renderCharts();
  }

  const bold = (text) => { const b = document.createElement('b'); b.textContent = text; return b; };

  // Level and region rows for the selected month, or added up across months for the all-months view.
  function levelRows() {
    const assessed = new Set(S.monthly.filter((r) => r.improved != null).map((r) => r.period));
    const rows = isAll()
      ? d3.rollups(S.levels.filter((x) => assessed.has(x.period)), (v) => ({ reached: d3.sum(v, (x) => x.reached), improved: d3.sum(v, (x) => x.improved) }), (x) => x.level)
        .map(([level, v]) => ({ level, ...v }))
      : S.levels.filter((x) => x.period === S.period);
    return LEVELS.map((L) => rows.find((x) => x.level === L)).filter(Boolean);
  }
  function regionRows() {
    if (!isAll()) return S.regions.filter((x) => x.period === S.period);
    return d3.rollups(S.regions, (v) => ({ learners: d3.sum(v, (x) => x.learners), improved: d3.sum(v, (x) => x.improved) }), (x) => x.region)
      .map(([region, v]) => ({ region, ...v }));
  }

  // Progress to the fellowship target: beneficiaries (learners plus educators) added up from the first
  // report to the selected month.
  function renderGoal() {
    const box = document.getElementById('goal'), T = S.target && S.target.beneficiaries;
    box.hidden = !T; if (!T) return;
    const reached = (r) => (r.learners || 0) + (r.educators || 0);
    const upto = isAll() ? S.monthly : S.monthly.filter((r) => r.period <= S.period);
    const n = d3.sum(upto, reached), last = upto[upto.length - 1], scale = Math.max(n, T);
    let run = 0; const hit = S.monthly.find((r) => (run += reached(r)) >= T);
    box.querySelector('.goal-label').textContent = `${S.target.label}${isAll() ? '' : `, by end of ${last.label}`}`;
    box.querySelector('.goal-n').textContent = fmt(n);
    box.querySelector('.goal-t').textContent = fmt(T);
    box.querySelector('.goal-pct').textContent = `${Math.round((n / T) * 100)}%`;
    box.querySelector('.goal-fill').style.width = `${(n / scale) * 100}%`;
    const mark = box.querySelector('.goal-mark');
    mark.style.left = `${(T / scale) * 100}%`;
    mark.classList.toggle('end', T / scale > 0.9);
    mark.firstElementChild.textContent = `Target ${fmt(T)}`;
    box.querySelector('.goal-sub').textContent = hit && hit.period <= last.period
      ? `Target reached in ${hit.label}.` : `${fmt(T - n)} beneficiaries to go.`;
  }

  // ---------- milestones and partners (text from the narrative reports) ----------
  const CATS = ['Product', 'Implementation', 'Training', 'Research', 'Event', 'Partnership', 'Organisation'];
  const catColor = (c) => css(['--c1', '--c0', '--c2', '--c3', '--c4', '--ink', '--muted'][CATS.indexOf(c)] || '--muted');
  const labelOf = (p) => (S.monthly.find((r) => r.period === p) || {}).label || p;
  S.cat = 'All';

  function renderMilestones() {
    const items = S.milestones.filter((m) => (isAll() || m.period === S.period) && (S.cat === 'All' || m.category === S.cat))
      .sort((a, b) => d3.descending(a.period, b.period));
    const used = ['All', ...CATS.filter((c) => S.milestones.some((m) => m.category === c))];
    document.getElementById('ms-filter').replaceChildren(...used.map((c) => {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = c;
      b.setAttribute('aria-pressed', String(S.cat === c)); b.addEventListener('click', () => { S.cat = c; renderMilestones(); });
      return b;
    }));
    const list = document.getElementById('ms-list'), out = [];
    d3.groups(items, (m) => m.period).forEach(([p, ms]) => {
      if (isAll()) {
        const h = document.createElement('li'); h.className = 'ms-month';
        const b = document.createElement('button'); b.textContent = labelOf(p); b.addEventListener('click', () => pick(p));
        h.append(b); out.push(h);
      }
      ms.forEach((m) => {
        const li = document.createElement('li'); li.className = 'ms-item';
        const cat = document.createElement('span'); cat.className = 'ms-cat';
        const dot = document.createElement('i'); dot.style.background = catColor(m.category); cat.append(dot, m.category);
        const body = document.createElement('div'); body.append(bold(m.title)); const t = document.createElement('span'); t.textContent = m.text; body.append(t);
        li.append(cat, body); out.push(li);
      });
    });
    if (!out.length) { const li = document.createElement('li'); li.className = 'cap'; li.textContent = 'No milestones of this type for this month.'; out.push(li); }
    list.replaceChildren(...out);
  }

  // Partners grouped by status: signed agreements and the fellowship first, then joint work, then talks.
  const GROUPS = [
    { title: 'Agreements and fellowship programme', status: ['agreement', 'programme'] },
    { title: 'Working with', status: ['collaboration', 'exploring'], sortBy: 'since' }
  ];
  const TAG = { agreement: 'Agreement signed', programme: 'Fellowship programme' };
  function renderPartners() {
    const out = [];
    GROUPS.forEach((g) => {
      const ps = S.partners.filter((p) => g.status.includes(p.status))
        .sort((a, b) => (g.sortBy === 'since' ? 0 : g.status.indexOf(a.status) - g.status.indexOf(b.status)) || d3.ascending(a.since, b.since));
      if (!ps.length) return;
      const h = document.createElement('h4'); h.className = 'partner-group'; h.textContent = `${g.title} (${ps.length})`; out.push(h);
      ps.forEach((p) => {
        const d = document.createElement('div'); d.className = 'partner';
        if (TAG[p.status]) { const t = document.createElement('span'); t.className = 'tag'; t.textContent = TAG[p.status]; d.append(t); }
        const meta = document.createElement('span'); meta.className = 'meta'; meta.textContent = [p.type, p.schools ? `${fmt(+p.schools)} schools` : '', `since ${labelOf(p.since)}`].filter(Boolean).join(' · ');
        const desc = document.createElement('p'); desc.textContent = p.description;
        d.append(bold(p.name), meta, desc); out.push(d);
      });
    });
    document.getElementById('partner-list').replaceChildren(...out);
  }

  function renderCharts() {
    renderGoal(); renderMilestones(); renderPartners();
    drawGrowth(); drawReach(); drawMap(); drawRegions(); drawTrend();
    const r = current();
    const lv = levelRows().map((x) => ({ name: x.level, reached: x.reached, improved: x.improved }));
    const measured = r && r.improved != null;
    const none = `Learning outcomes were not yet assessed in ${r ? r.label : 'this month'}.`;
    hbars('#chart-level', measured ? lv : [], css('--c0'), measured ? `No level breakdown for ${r.label}.` : none);
    const g = measured && r.girls != null ? [
      { name: 'Girls', reached: isAll() ? r.assessed_girls : r.girls, improved: r.improved_girls },
      { name: 'Boys', reached: isAll() ? r.assessed_boys : r.boys, improved: r.improved_boys }
    ] : [];
    hbars('#chart-gender', g, css('--mutedbar'), measured ? 'No gender breakdown for this month.' : '');
    // Region outcomes: only months with assessed outcomes count, so the all-months view uses those months.
    const assessed = new Set(S.monthly.filter((x) => x.improved != null).map((x) => x.period));
    const rg = (isAll()
      ? d3.rollups(S.regions.filter((x) => assessed.has(x.period)), (v) => ({ reached: d3.sum(v, (x) => x.learners), improved: d3.sum(v, (x) => x.improved) }), (x) => x.region)
        .map(([name, v]) => ({ name, ...v }))
      : S.regions.filter((x) => x.period === S.period).map((x) => ({ name: x.region, reached: x.learners, improved: x.improved })))
      .sort((a, b) => d3.descending(a.reached, b.reached));
    hbars('#chart-region-outcomes', measured ? rg : [], css('--c1'), measured ? 'No region breakdown for this month.' : none);
    monthBars('#chart-support', 'needs_support', css('--c2'), 'Learners identified for support, by month');
    monthBars('#chart-pwd', 'pwd', css('--c0'), 'Learners with disability, by month');
    splits('#chart-split', [
      { name: 'Learners', a: r.girls, b: r.boys, la: 'Girls', lb: 'Boys' },
      { name: 'Educators', a: r.educators_female, b: r.educators_male, la: 'Female', lb: 'Male' }
    ]);
  }

  // One bar per month for a single monthly count; months without the count are left out.
  function monthBars(selector, key, color, label) {
    const node = document.querySelector(selector); node.replaceChildren();
    const rows = S.monthly.filter((r) => r[key] != null);
    if (!rows.length) return empty(node, 'No data yet.');
    const W = Math.max(300, node.clientWidth), H = 240, m = { l: 40, r: 6, t: 22, b: 38 };
    const x = d3.scaleBand(rows.map((r) => r.period), [m.l, W - m.r]).padding(rows.length > 8 ? 0.2 : 0.36);
    const y = d3.scaleLinear([0, d3.max(rows, (r) => r[key]) || 1], [H - m.b, m.t]).nice();
    const roomy = x.bandwidth() >= 34;
    const svg = svgIn(node, W, H, label);
    y.ticks(4).forEach((t) => {
      svg.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(t)).attr('y2', y(t)).attr('stroke', css(t === 0 ? '--axis' : '--grid'));
      svg.append('text').attr('x', m.l - 6).attr('y', y(t)).attr('dy', '0.35em').attr('text-anchor', 'end').text(fmt(t));
    });
    rows.forEach((r, i) => {
      const picked = r.period === S.period, on = isAll() || picked, cx = x(r.period) + x.bandwidth() / 2;
      const bar = svg.append('rect').attr('x', x(r.period)).attr('width', x.bandwidth()).attr('y', y(r[key]))
        .attr('height', Math.max(0, y(0) - y(r[key]))).attr('rx', 2).attr('fill', color).attr('fill-opacity', on ? 1 : 0.38)
        .style('cursor', 'pointer').on('click', () => pick(r.period));
      hover(bar, r.label, fmt(r[key]));
      if (roomy || picked) svg.append('text').attr('x', cx).attr('y', y(r[key]) - 6).attr('text-anchor', 'middle').attr('class', on ? 'strong' : null).text(fmt(r[key]));
      const month = r.period.slice(5), first = i === 0 || month === '01';
      if (roomy || picked || i % 3 === 0 || first) {
        svg.append('text').attr('x', cx).attr('y', H - 22).attr('text-anchor', 'middle').attr('class', picked ? 'strong' : null)
          .text(roomy ? short(r.label) : short(r.label).slice(0, 1));
      }
      if (first) svg.append('text').attr('x', cx).attr('y', H - 6).attr('text-anchor', 'middle').text(r.period.slice(0, 4));
    });
  }

  // Female/male split bars: each row is one 100% bar with counts and shares.
  function splits(selector, rows) {
    const node = document.querySelector(selector); node.replaceChildren();
    rows = rows.filter((r) => (r.a || 0) + (r.b || 0) > 0);
    if (!rows.length) return empty(node, 'No gender breakdown for this month.');
    const W = Math.max(300, node.clientWidth), rowH = 58, H = rows.length * rowH;
    const svg = svgIn(node, W, H, 'Female and male');
    const ca = css('--c1'), cb = css('--c0');
    rows.forEach((r, i) => {
      const y0 = i * rowH, tot = r.a + r.b, xa = (r.a / tot) * W;
      svg.append('text').attr('x', 0).attr('y', y0 + 12).attr('class', 'strong').text(`${r.name} · ${fmt(tot)}`);
      const a = svg.append('rect').attr('x', 0).attr('y', y0 + 20).attr('width', Math.max(0, xa - 1)).attr('height', 14).attr('rx', 3).attr('fill', ca);
      const b = svg.append('rect').attr('x', xa + 1).attr('y', y0 + 20).attr('width', Math.max(0, W - xa - 1)).attr('height', 14).attr('rx', 3).attr('fill', cb);
      hover(a, r.la, `${fmt(r.a)} (${pct(r.a, tot)}%)`); hover(b, r.lb, `${fmt(r.b)} (${pct(r.b, tot)}%)`);
      svg.append('text').attr('x', 0).attr('y', y0 + 50).text(`${r.la} ${fmt(r.a)} (${pct(r.a, tot)}%)`);
      svg.append('text').attr('x', W).attr('y', y0 + 50).attr('text-anchor', 'end').text(`${r.lb} ${fmt(r.b)} (${pct(r.b, tot)}%)`);
    });
  }

  const svgIn = (node, W, H, label) => d3.select(node).append('svg')
    .attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img').attr('aria-label', label);
  const empty = (node, msg) => { const d = document.createElement('div'); d.className = 'empty'; d.textContent = msg; node.replaceChildren(d); };

  // ---------- reach by month, stacked by level ----------
  function drawReach() {
    const node = document.querySelector('#chart-reach'); node.replaceChildren();
    if (!S.monthly.length) return empty(node, 'No data yet.');
    const W = Math.max(300, node.clientWidth), H = 262, m = { l: 40, r: 6, t: 22, b: 38 };
    const x = d3.scaleBand(S.monthly.map((r) => r.period), [m.l, W - m.r]).padding(S.monthly.length > 8 ? 0.2 : 0.36);
    const roomy = x.bandwidth() >= 34; // enough room to print every value and month name
    const y = d3.scaleLinear([0, d3.max(S.monthly, (r) => r.learners) || 1], [H - m.b, m.t]).nice();
    const svg = svgIn(node, W, H, 'Learners reached each month, by level');
    y.ticks(4).forEach((t) => {
      svg.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(t)).attr('y2', y(t)).attr('stroke', css(t === 0 ? '--axis' : '--grid'));
      svg.append('text').attr('x', m.l - 6).attr('y', y(t)).attr('dy', '0.35em').attr('text-anchor', 'end').text(fmt(t));
    });
    const colors = [css('--c0'), css('--c1'), css('--c2'), css('--c3'), css('--c4')];
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
      const cx = x(r.period) + x.bandwidth() / 2, picked = r.period === S.period, i = S.monthly.indexOf(r);
      if (roomy || picked) {
        svg.append('text').attr('x', cx).attr('y', y(r.learners) - 6).attr('text-anchor', 'middle')
          .attr('class', on ? 'strong' : null).text(fmt(r.learners));
      }
      const month = r.period.slice(5), first = i === 0 || month === '01';
      if (roomy || picked || i % 3 === 0 || first) {
        svg.append('text').attr('x', cx).attr('y', H - 22).attr('text-anchor', 'middle')
          .attr('class', picked ? 'strong' : null).text(roomy ? short(r.label) : short(r.label).slice(0, 1));
      }
      if (first) svg.append('text').attr('x', cx).attr('y', H - 6).attr('text-anchor', 'middle').text(r.period.slice(0, 4));
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
    const svg = svgIn(node, W, H, 'Learners demonstrating improved learning outcomes, by month');
    [0, 25, 50, 75, 100].forEach((t) => {
      svg.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(t)).attr('y2', y(t)).attr('stroke', css(t === 0 ? '--axis' : '--grid'));
      svg.append('text').attr('x', m.l - 6).attr('y', y(t)).attr('dy', '0.35em').attr('text-anchor', 'end').text(`${t}%`);
    });
    const line = d3.line().x((r) => x(r.period)).y((r) => y(r.improved_pct));
    for (let i = 1; i < rows.length; i++) {
      svg.append('path').attr('d', line([rows[i - 1], rows[i]])).attr('fill', 'none')
        .attr('stroke', css('--c1')).attr('stroke-width', 2).attr('stroke-linecap', 'round');
    }
    rows.forEach((r) => {
      const on = r.period === S.period, cx = x(r.period), cy = y(r.improved_pct);
      const c = svg.append('circle').attr('cx', cx).attr('cy', cy).attr('r', on ? 5.5 : 3.8)
        .attr('fill', css('--c1')).style('cursor', 'pointer')
        .on('click', () => pick(r.period));
      hover(c, r.label, `${r.improved_pct}% demonstrated improved learning outcomes (${fmt(r.improved)} of ${fmt(r.learners)})`);
      const i = rows.indexOf(r), show = x.step() >= 34 || on || i % 2 === 0; // thin labels on narrow screens
      if (show) svg.append('text').attr('x', cx).attr('y', cy - 11).attr('text-anchor', 'middle').attr('class', on ? 'strong' : null).text(`${r.improved_pct}%`);
      if (show) svg.append('text').attr('x', cx).attr('y', H - 8).attr('text-anchor', 'middle').attr('class', on ? 'strong' : null).text(short(r.label));
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

  // ---------- cumulative beneficiaries against the target ----------
  function drawGrowth() {
    const node = document.querySelector('#chart-growth'); node.replaceChildren();
    if (!S.monthly.length) return empty(node, 'No data yet.');
    let run = 0;
    const rows = S.monthly.map((r) => ({ period: r.period, label: r.label, n: (run += (r.learners || 0) + (r.educators || 0)) }));
    const T = S.target && S.target.beneficiaries;
    const W = Math.max(300, node.clientWidth), H = 240, m = { l: 48, r: 16, t: 24, b: 38 };
    const x = d3.scalePoint(rows.map((r) => r.period), [m.l + 8, W - m.r - 8]);
    const y = d3.scaleLinear([0, Math.max(d3.max(rows, (r) => r.n), T || 0)], [H - m.b, m.t]).nice();
    const svg = svgIn(node, W, H, 'Beneficiaries over time');
    y.ticks(4).forEach((t) => {
      svg.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(t)).attr('y2', y(t)).attr('stroke', css(t === 0 ? '--axis' : '--grid'));
      svg.append('text').attr('x', m.l - 6).attr('y', y(t)).attr('dy', '0.35em').attr('text-anchor', 'end').text(fmt(t));
    });
    const grad = `g${Math.random().toString(36).slice(2, 7)}`;
    const lg = svg.append('defs').append('linearGradient').attr('id', grad).attr('x1', 0).attr('x2', 1);
    lg.append('stop').attr('offset', '0%').attr('stop-color', css('--purple'));
    lg.append('stop').attr('offset', '100%').attr('stop-color', css('--blue'));
    svg.append('path').attr('d', d3.area().x((r) => x(r.period)).y0(y(0)).y1((r) => y(r.n))(rows)).attr('fill', `url(#${grad})`).attr('fill-opacity', 0.15);
    svg.append('path').attr('d', d3.line().x((r) => x(r.period)).y((r) => y(r.n))(rows)).attr('fill', 'none').attr('stroke', `url(#${grad})`).attr('stroke-width', 2.5);
    if (T) {
      svg.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(T)).attr('y2', y(T)).attr('stroke', css('--ink')).attr('stroke-dasharray', '4 4');
      svg.append('text').attr('x', m.l + 4).attr('y', y(T) - 6).attr('class', 'strong').text(`Target ${fmt(T)}`);
    }
    const roomy = x.step() >= 34;
    rows.forEach((r, i) => {
      const picked = r.period === S.period, cx = x(r.period), cy = y(r.n);
      const c = svg.append('circle').attr('cx', cx).attr('cy', cy).attr('r', picked ? 5.5 : 3.5).attr('fill', picked ? css('--ink') : css('--c1'))
        .style('cursor', 'pointer').on('click', () => pick(r.period));
      hover(c, r.label, `${fmt(r.n)} beneficiaries so far`);
      if (picked || i === rows.length - 1) svg.append('text').attr('x', cx).attr('y', cy - 10).attr('text-anchor', i === rows.length - 1 ? 'end' : 'middle').attr('class', 'strong').text(fmt(r.n));
      const month = r.period.slice(5), first = i === 0 || month === '01';
      if (roomy || picked || i % 3 === 0 || first) {
        svg.append('text').attr('x', cx).attr('y', H - 22).attr('text-anchor', 'middle').attr('class', picked ? 'strong' : null)
          .text(roomy ? short(r.label) : short(r.label).slice(0, 1));
      }
      if (first) svg.append('text').attr('x', cx).attr('y', H - 6).attr('text-anchor', 'middle').text(r.period.slice(0, 4));
    });
  }

  // ---------- map: learners by region (Zanzibar's regions shown together) ----------
  const mapGroup = (name) => (/^zanzibar|mjini magharibi|pemba/i.test(name) ? 'Zanzibar' : name);
  function drawMap() {
    const node = document.querySelector('#map'), key = document.querySelector('#map-key');
    node.replaceChildren(); key.replaceChildren();
    if (!S.geo) return;
    const totals = d3.rollup(regionRows(), (v) => d3.sum(v, (d) => d.learners), (d) => mapGroup(d.region));
    const max = d3.max(totals.values()) || 1;
    const color = d3.scaleSqrt([0, max], [css('--grid'), css('--c0')]);
    const W = Math.max(280, node.clientWidth), H = Math.round(W * 0.9);
    const proj = d3.geoMercator().fitSize([W, H], S.geo), path = d3.geoPath(proj);
    const svg = svgIn(node, W, H, 'Map of learners by region');
    svg.selectAll('path').data(S.geo.features).join('path').attr('d', path)
      .attr('fill', (f) => (totals.get(f.properties.group) ? color(totals.get(f.properties.group)) : css('--grid')))
      .each(function (f) {
        const n = totals.get(f.properties.group) || 0, g = f.properties.group;
        hover(d3.select(this), g === 'Zanzibar' ? 'Zanzibar' : f.properties.name, `${fmt(n)} ${n === 1 ? 'learner' : 'learners'}`);
      });
    const sw = document.createElement('i');
    sw.style.background = `linear-gradient(90deg, ${css('--grid')}, ${css('--c0')})`;
    key.append('Fewer', sw, 'More learners');
  }

  // Section menu: highlight the section in view.
  function setupNav() {
    const links = [...document.querySelectorAll('.secnav a')];
    const secs = links.map((a) => document.querySelector(a.getAttribute('href'))).filter(Boolean);
    const io = new IntersectionObserver((es) => {
      es.forEach((e) => {
        if (!e.isIntersecting) return;
        links.forEach((a) => a.classList.toggle('on', a.getAttribute('href') === `#${e.target.id}`));
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    secs.forEach((s) => io.observe(s));
    // Section links scroll without replacing the month in the address bar.
    links.forEach((a) => a.addEventListener('click', (ev) => {
      ev.preventDefault(); document.querySelector(a.getAttribute('href')).scrollIntoView({ behavior: 'smooth' });
    }));
  }

  // ---------- regions for the selected month ----------
  function drawRegions() {
    const node = document.querySelector('#chart-regions'); node.replaceChildren();
    const r = current();
    const rows = regionRows().filter((d) => d.learners > 0 || d.schools > 0).sort((a, b) => d3.descending(a.learners, b.learners));
    if (!rows.length) return empty(node, `Region figures for ${r ? r.label : 'this month'} have not been imported yet.`);
    // Schools are shown for a single month only; across months they would not add up to the institutions figure.
    const noSchools = isAll() || rows.every((d) => !d.schools);
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
      const schools = d.schools == null || noSchools ? '' : ` · ${fmt(d.schools)} ${d.schools === 1 ? 'school' : 'schools'}`;
      hover(bar, d.region, `${fmt(d.learners)} ${d.learners === 1 ? 'learner' : 'learners'}${schools}`);
      const t = svg.append('text').attr('x', Math.max(left + 2, x(d.learners)) + 6).attr('y', y0 + rowH / 2).attr('dy', '0.35em');
      t.append('tspan').attr('class', 'strong').text(fmt(d.learners));
      t.append('tspan').text(` ${d.learners === 1 ? 'learner' : 'learners'}${schools}`);
    });
  }

  // Redraw charts when the colour scheme changes (light/dark).
  if (window.matchMedia) window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (S.monthly.length) renderCharts(); });
})();
