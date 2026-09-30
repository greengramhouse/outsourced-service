// หน้าตั้งค่า

const SETTING_FIELDS = {
  setPerson: [
    ['schoolName', 'ชื่อโรงเรียน (ไม่ต้องมีคำว่าโรงเรียน)', 'sm:col-span-2'],
    ['fullName', 'ชื่อ-สกุลผู้รับจ้าง (รวมคำนำหน้า เช่น นางสาวสมใจ ใจดี)', 'sm:col-span-2'],
    ['position', 'ตำแหน่ง'],
    ['wage', 'ค่าจ้างรายเดือน (บาท)', '', 'number'],
    ['contractNo', 'เลขที่บันทึกข้อตกลงจ้าง (เช่น 1/2570)'],
    ['contractDate', 'ลงวันที่ (เช่น 1 ตุลาคม 2569)'],
  ],
  setSigners: [
    ['directorName', 'ผู้อำนวยการโรงเรียน', 'sm:col-span-2'],
    ['committeeChair', 'ประธานกรรมการตรวจรับ'],
    ['committee1', 'กรรมการ คนที่ 1'],
    ['committee2', 'กรรมการ คนที่ 2'],
    ['supervisorName', 'ผู้ควบคุมการปฏิบัติงาน'],
    ['officerName', 'เจ้าหน้าที่ (พัสดุ)'],
    ['headOfficerName', 'หัวหน้าเจ้าหน้าที่ (พัสดุ)'],
  ],
};

const Settings = {
  render() {
    bindCommon();
    Object.entries(SETTING_FIELDS).forEach(([box, fields]) => {
      $('#' + box).innerHTML = fields.map(([k, label, cls = '', type = 'text']) =>
        `<div class="${cls}"><label class="lbl" for="set-${k}">${label}</label><input id="set-${k}" type="${type}" class="inp" data-set="${k}" value="${esc(Store.settings[k])}"></div>`).join('');
    });
    $('#setPresets').innerHTML = '';
    Store.presets.forEach(p => this.addPresetRow(p, false));
    $('#setApi').value = API.url();
    this.renderMode();
  },

  renderMode() {
    $('#setMode').innerHTML = API.isLocal()
      ? '<span class="rounded-full px-2.5 py-0.5 bg-amber-50 text-amber-700">โหมดทดลอง — เก็บในเบราว์เซอร์นี้</span>'
      : '<span class="rounded-full px-2.5 py-0.5 bg-emerald-50 text-emerald-700">เชื่อมต่อ Google Sheet</span>';
  },

  addPresetRow(p = { task: '', unit: '' }, focus = true) {
    const row = document.createElement('div');
    row.className = 'preset-row grid grid-cols-[1fr_6rem_2.5rem] gap-2';
    row.innerHTML = `<input class="inp" data-k="task" value="${esc(p.task)}" placeholder="ชื่องาน" aria-label="ชื่องาน">
      <input class="inp" data-k="unit" value="${esc(p.unit)}" placeholder="หน่วย" aria-label="หน่วย">
      <button type="button" class="h-10 w-10 grid place-items-center rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50" aria-label="ลบ">${icon('x')}</button>`;
    row.querySelector('button').onclick = () => row.remove();
    $('#setPresets').appendChild(row);
    if (focus) row.querySelector('input').focus();
  },

  async save(btn) {
    const data = {};
    $$('[data-set]').forEach(el => data[el.dataset.set] = el.value.trim());
    const ok = await withBusy(btn, () => Store.saveSettings(data));
    if (ok) { bindCommon(); toast('บันทึกการตั้งค่าแล้ว'); }
  },

  async savePresets(btn) {
    const presets = $$('.preset-row').map(r => ({
      task: r.querySelector('[data-k=task]').value.trim(),
      unit: r.querySelector('[data-k=unit]').value.trim(),
    })).filter(p => p.task);
    const ok = await withBusy(btn, () => Store.savePresets(presets));
    if (ok) toast('บันทึกงานที่ใช้บ่อยแล้ว');
  },

  async testApi(btn) {
    const url = $('#setApi').value.trim();
    if (!url) return toast('ยังไม่ได้กรอก URL — ตอนนี้ใช้โหมดทดลอง');
    if (!/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/.test(url)) {
      return toast('URL ควรขึ้นต้นด้วย https://script.google.com/macros/s/ และลงท้ายด้วย /exec', 'error');
    }
    const ok = await withBusy(btn, () => API.ping(url));
    if (ok) toast('เชื่อมต่อสำเร็จ');
  },

  async saveApi(btn) {
    const url = $('#setApi').value.trim();
    if (url === API.url()) return toast('URL ไม่ได้เปลี่ยน');
    if (url && !(await withBusy(btn, () => API.ping(url)))) return;
    API.setUrl(url);
    Store.reset();
    const ok = await withBusy(btn, () => Store.init());
    if (ok) {
      this.render();
      toast(url ? 'เชื่อมต่อ Google Sheet แล้ว' : 'กลับไปใช้โหมดทดลอง');
    }
  },
};

RENDER.settings = () => Settings.render();
