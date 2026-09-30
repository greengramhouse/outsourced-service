// หน้าปฏิทิน

const Cal = {
  month: null,      // Date วันที่ 1 ของเดือนที่แสดง
  selected: null,   // yyyy-MM-dd

  async render() {
    bindCommon();
    const TODAY = todayStr();
    if (!this.month) { const n = new Date(); this.month = new Date(n.getFullYear(), n.getMonth(), 1); }
    if (!this.selected) this.selected = TODAY;
    const y = this.month.getFullYear(), m = this.month.getMonth();
    const from = monthStart(y, m), to = monthEnd(y, m);
    $('#calTitle').textContent = `${TH_MONTHS[m]} ${y + 543}`;
    $('#calHead').innerHTML = TH_DAYS_S.map((d, i) => `<div class="${i === 0 ? 'text-rose-500' : ''}">${d}</div>`).join('');
    $('#calGrid').classList.add('opacity-50');

    await Store.ensureRange(from, to);
    if (currentPage !== 'calendar' || this.month.getMonth() !== m || this.month.getFullYear() !== y) return;
    $('#calGrid').classList.remove('opacity-50');

    const first = new Date(y, m, 1).getDay(), last = new Date(y, m + 1, 0).getDate();
    let html = '';
    for (let i = 0; i < first; i++) html += '<div></div>';
    for (let day = 1; day <= last; day++) {
      const key = `${y}-${pad(m + 1)}-${pad(day)}`, d = Store.days[key], st = d && STATUS[d.status];
      const isToday = key === TODAY, sel = key === this.selected;
      const missing = !d && isWeekday(key) && key < TODAY;
      html += `
        <button type="button" onclick="Cal.select('${key}')" class="relative h-14 sm:h-24 rounded-xl border p-1 sm:p-2 text-left transition hover:shadow-sm
          ${st ? st.cell : missing ? 'border-dashed border-rose-200 bg-white' : 'bg-white border-slate-100'}
          ${sel ? 'ring-2 ring-emerald-500' : ''}" aria-label="${fmtLong(key)}">
          <div class="text-xs sm:text-sm font-medium ${isToday ? 'inline-grid place-items-center h-6 w-6 rounded-full bg-emerald-600 text-white' : parseYmd(key).getDay() === 0 ? 'text-rose-500' : ''}">${day}</div>
          ${st ? `<div class="hidden sm:block mt-1 text-[11px] leading-tight rounded-md px-1.5 py-0.5 w-fit ${st.chip}">${st.label}${d.items.length ? ' · ' + d.items.length : ''}</div>
                  <span class="sm:hidden absolute bottom-1.5 left-1/2 -translate-x-1/2 h-1.5 w-1.5 rounded-full ${st.dot}"></span>` : ''}
          ${missing ? '<div class="hidden sm:block mt-1 text-[11px] text-rose-400">ยังไม่บันทึก</div>' : ''}
        </button>`;
    }
    $('#calGrid').innerHTML = html;
    $('#calLegend').innerHTML = Object.values(STATUS).map(s => `<span class="flex items-center gap-1.5"><span class="h-2 w-2 rounded-full ${s.dot}"></span>${s.label}</span>`).join('') +
      '<span class="flex items-center gap-1.5"><span class="h-3 w-3 rounded border border-dashed border-rose-300"></span>ยังไม่บันทึก</span>';

    const list = Store.daysIn(from, to);
    const count = k => list.filter(d => d.status === k).length;
    const missEnd = to < TODAY ? to : addDays(TODAY, -1);
    const miss = missEnd >= from ? Store.missingWeekdays(from, missEnd).length : 0;
    $('#calSummary').innerHTML = Object.entries(STATUS).map(([k, v]) =>
      `<div class="flex justify-between"><span class="flex items-center gap-2"><span class="h-2 w-2 rounded-full ${v.dot}"></span>${v.label}</span><b>${count(k)} วัน</b></div>`).join('') +
      `<div class="flex justify-between pt-2 border-t border-slate-100"><span>รายการงานทั้งหมด</span><b>${list.reduce((n, d) => n + d.items.length, 0)} รายการ</b></div>` +
      `<div class="flex justify-between text-rose-600"><span>วันทำการที่ยังไม่บันทึก</span><b>${miss} วัน</b></div>`;
    this.renderDetail();
  },

  shift(n) {
    this.month = new Date(this.month.getFullYear(), this.month.getMonth() + n, 1);
    this.render();
  },

  thisMonth() {
    const n = new Date();
    this.month = new Date(n.getFullYear(), n.getMonth(), 1);
    this.selected = todayStr();
    this.render();
  },

  select(key) {
    this.selected = key;
    $$('#calGrid button').forEach(b => b.classList.remove('ring-2', 'ring-emerald-500'));
    const btn = $$('#calGrid button').find(b => b.getAttribute('onclick') === `Cal.select('${key}')`);
    btn && btn.classList.add('ring-2', 'ring-emerald-500');
    this.renderDetail();
    if (innerWidth < 1024) $('#calDetail').scrollIntoView({ behavior: 'smooth', block: 'start' });
  },

  renderDetail() {
    const key = this.selected, d = Store.days[key];
    $('#calDetail').innerHTML = `
      <div class="text-xs text-slate-500">รายละเอียด</div>
      <div class="font-semibold">${fmtLong(key)}</div>
      ${d ? `
        <span class="inline-block mt-2 text-xs rounded-full px-2.5 py-0.5 ${STATUS[d.status].chip}">${STATUS[d.status].label}</span>
        <ul class="mt-3 space-y-2">${d.items.map(i => `<li class="flex justify-between gap-3 text-sm"><span>• ${esc(i.task)}</span><span class="text-slate-500 shrink-0">${esc(i.qty)} ${esc(i.unit)}</span></li>`).join('')}</ul>
        ${d.note ? `<div class="mt-3 text-sm text-slate-500">${d.status === 'holiday' ? 'หยุดเนื่องจาก' : 'หมายเหตุ'}: ${esc(d.note)}</div>` : ''}
        <div class="flex gap-2 mt-4">
          <button type="button" class="btn btn-soft flex-1" onclick="Record.open('${key}')">${icon('pen')}แก้ไข</button>
          <button type="button" class="btn btn-danger" onclick="Cal.remove('${key}', this)" aria-label="ลบ">${icon('trash')}</button>
        </div>` : `
        <p class="text-sm text-slate-400 mt-3">ยังไม่มีบันทึกในวันนี้</p>
        <button type="button" class="btn btn-primary w-full mt-4" onclick="Record.open('${key}')">${icon('plus')}บันทึกวันนี้</button>`}`;
  },

  async remove(key, btn) {
    if (!(await confirmBox('ลบบันทึก?', `ลบบันทึกของ${fmtLong(key)} ทั้งหมด`, 'ลบ'))) return;
    const ok = await withBusy(btn, () => Store.deleteDay(key));
    if (ok) { toast('ลบบันทึกแล้ว'); this.render(); }
  },
};

RENDER.calendar = () => Cal.render();
