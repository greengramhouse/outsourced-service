// หน้าบันทึก / แก้ไขงานรายวัน

const Record = {
  date: null,
  status: 'work',
  dirty: false,

  open(date) {
    this.date = date;
    go('record');
  },

  async load(date) {
    bindCommon();
    this.date = date;
    $('#recDate').value = date;
    $('#recDateLabel').textContent = fmtLong(date);
    $('#recForm').classList.add('opacity-50', 'pointer-events-none');
    try {
      await Store.ensureRange(date, date);
    } finally {
      $('#recForm').classList.remove('opacity-50', 'pointer-events-none');
    }
    if (this.date !== date) return; // ผู้ใช้เปลี่ยนวันระหว่างโหลด

    const d = Store.days[date];
    this.status = d ? d.status : (isWeekday(date) ? 'work' : 'holiday');
    $('#recMode').classList.toggle('hidden', !d);
    $('#recDelete').classList.toggle('hidden', !d);
    // วันหยุดเก็บเหตุผลไว้ในช่อง note เดียวกัน (ไม่ต้องแก้ฐานข้อมูล)
    const isHoliday = d && d.status === 'holiday';
    $('#recNote').value = d && !isHoliday ? d.note : '';
    $('#recHolidayReason').value = isHoliday ? d.note : '';
    $('#recItems').innerHTML = '';
    (d ? d.items : []).forEach(it => this.addItem(it, false));
    this.refreshEmpty();
    this.setStatus(this.status);
    this.renderPresets();
    this.dirty = false;
  },

  renderPresets() {
    $('#presetChips').innerHTML = Store.presets.map((p, i) =>
      `<button type="button" class="text-sm rounded-full px-3 py-1.5 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 ring-1 ring-emerald-100 text-left" onclick="Record.addPreset(${i})">+ ${esc(p.task)}</button>`).join('')
      || '<p class="text-sm text-slate-400">ยังไม่มี — เพิ่มได้ที่หน้าตั้งค่า</p>';
    $('#dl-tasks').innerHTML = Store.presets.map(p => `<option value="${esc(p.task)}">`).join('');
    const units = [...new Set(Store.presets.map(p => p.unit).filter(Boolean).concat(['เรื่อง', 'ครั้ง', 'ชุด', 'ฉบับ', 'รายการ']))];
    $('#dl-units').innerHTML = units.map(u => `<option value="${esc(u)}">`).join('');
  },

  setStatus(k) {
    this.status = k;
    $('#recStatus').innerHTML = Object.entries(STATUS).map(([key, v]) =>
      `<button type="button" class="rounded-lg py-2 text-sm flex items-center justify-center gap-2 ${k === key ? 'active' : 'text-slate-600'}" onclick="Record.setStatus('${key}');Record.dirty=true"><span class="h-2 w-2 rounded-full ${v.dot}"></span>${v.label}</button>`).join('');
    $('#recItemsCard').classList.toggle('opacity-60', k !== 'work');
    $('#recItemsCard').classList.toggle('hidden', k === 'holiday');
    $('#recHolidayCard').classList.toggle('hidden', k !== 'holiday');
  },

  renderHolidayChips() {
    const reasons = ['วันหยุดนักขัตฤกษ์', 'วันหยุดราชการ', 'วันหยุดชดเชย', 'ปิดภาคเรียน', 'หยุดตามประกาศโรงเรียน'];
    $('#recHolidayChips').innerHTML = reasons.map(r =>
      `<button type="button" class="text-sm rounded-full px-3 py-1.5 bg-white text-rose-700 hover:bg-rose-100 ring-1 ring-rose-200" onclick="$('#recHolidayReason').value='${r}';Record.dirty=true">${r}</button>`).join('');
  },

  addItem(it = { task: '', qty: 1, unit: '' }, focus = true) {
    const row = document.createElement('div');
    row.className = 'item-row grid grid-cols-[1fr_1fr_2.5rem] sm:grid-cols-[1fr_5rem_6rem_2.5rem] gap-2 items-center rounded-xl sm:rounded-none bg-slate-50 sm:bg-transparent p-2 sm:p-0';
    row.innerHTML = `
      <input list="dl-tasks" class="inp col-span-3 sm:col-span-1" data-k="task" placeholder="รายละเอียดงาน" value="${esc(it.task)}">
      <input type="number" min="0" step="any" inputmode="decimal" class="inp text-center" data-k="qty" placeholder="จำนวน" value="${esc(it.qty)}">
      <input list="dl-units" class="inp" data-k="unit" placeholder="หน่วย" value="${esc(it.unit)}">
      <button type="button" class="h-10 w-10 grid place-items-center rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50" aria-label="ลบรายการ">${icon('x')}</button>`;
    row.querySelector('button').onclick = () => { row.remove(); this.refreshEmpty(); this.dirty = true; };
    row.querySelector('[data-k=task]').addEventListener('change', e => {
      const p = Store.presets.find(p => p.task === e.target.value);
      const u = row.querySelector('[data-k=unit]');
      if (p && !u.value) u.value = p.unit;
    });
    row.addEventListener('input', () => this.dirty = true);
    $('#recItems').appendChild(row);
    this.refreshEmpty();
    if (focus) { this.dirty = true; if (!it.task) row.querySelector('[data-k=task]').focus(); }
  },

  addPreset(i) {
    const p = Store.presets[i];
    this.addItem({ task: p.task, qty: 1, unit: p.unit });
    if (this.status !== 'work') this.setStatus('work');
  },

  refreshEmpty() {
    $('#recEmpty').classList.toggle('hidden', $$('#recItems .item-row').length > 0);
  },

  collect() {
    return $$('#recItems .item-row').map(r => ({
      task: r.querySelector('[data-k=task]').value.trim(),
      qty: r.querySelector('[data-k=qty]').value.trim(),
      unit: r.querySelector('[data-k=unit]').value.trim(),
    })).filter(i => i.task);
  },

  async save(btn) {
    const date = $('#recDate').value;
    if (!date) return toast('กรุณาเลือกวันที่', 'error');
    const holiday = this.status === 'holiday';
    const items = holiday ? [] : this.collect();
    const note = holiday ? $('#recHolidayReason').value.trim() : $('#recNote').value.trim();
    if (this.status === 'work' && !items.length) return toast('สถานะปฏิบัติงานต้องมีรายละเอียดงานอย่างน้อย 1 รายการ', 'error');
    const bad = items.find(i => i.qty !== '' && (isNaN(Number(i.qty)) || Number(i.qty) < 0));
    if (bad) return toast(`จำนวนของ "${bad.task}" ไม่ถูกต้อง`, 'error');
    const ok = await withBusy(btn, () => Store.saveDay({ date, status: this.status, note, items }));
    if (ok) {
      toast('บันทึก ' + fmtShort(date) + ' เรียบร้อย');
      await this.load(date);
    }
  },

  async remove(btn) {
    const date = $('#recDate').value;
    if (!(await confirmBox('ลบบันทึก?', `ลบบันทึกของ${fmtLong(date)} ทั้งหมด`, 'ลบ'))) return;
    const ok = await withBusy(btn, () => Store.deleteDay(date));
    if (ok) { toast('ลบบันทึกแล้ว'); await this.load(date); }
  },

  async changeDate(date) {
    if (!date || date === this.date) return;
    if (this.dirty && !(await confirmBox('ยังไม่ได้บันทึก', 'มีการแก้ไขที่ยังไม่ได้บันทึก ต้องการเปลี่ยนวันโดยไม่บันทึกหรือไม่?', 'เปลี่ยนวัน'))) {
      $('#recDate').value = this.date;
      return;
    }
    await this.load(date);
  },
};

RENDER.record = () => Record.load(Record.date || todayStr());

// ปิดแท็บ / รีเฟรช / ออกจากเว็บ ขณะยังไม่ได้บันทึก ให้เบราว์เซอร์ถามก่อน
addEventListener('beforeunload', e => {
  if (currentPage === 'record' && Record.dirty) { e.preventDefault(); e.returnValue = ''; }
});

document.addEventListener('DOMContentLoaded', () => {
  $('#recDate').addEventListener('change', e => Record.changeDate(e.target.value));
  $('#recNote').addEventListener('input', () => Record.dirty = true);
  $('#recHolidayReason').addEventListener('input', () => Record.dirty = true);
  Record.renderHolidayChips();
});
