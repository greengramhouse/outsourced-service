// หน้าออกรายงาน: ฟอร์ม, รวบรวมข้อมูล (reportData), และ preview A4

const Report = {
  inited: false,
  digits: 'arabic',
  timer: null,

  init() {
    if (this.inited) return;
    this.inited = true;
    const now = new Date();
    $('#rpMonth').innerHTML = TH_MONTHS.map((m, i) => `<option value="${i}">${m}</option>`).join('');
    const ys = [];
    for (let y = now.getFullYear() - 3; y <= now.getFullYear() + 1; y++) ys.push(y);
    $('#rpYear').innerHTML = ys.map(y => `<option value="${y}">${y + 543}</option>`).join('');
    $('#rpMonth').value = now.getMonth();
    $('#rpYear').value = now.getFullYear();
    this.setRangeFromMonth();

    this.digits = LS.get('memo.digits') || 'arabic';
    this.renderDigits();
    try {
      const pages = JSON.parse(LS.get('memo.pages') || 'null');
      if (Array.isArray(pages)) $$('.rp-page').forEach(c => c.checked = pages.includes(c.value));
    } catch { /* ignore */ }

    ['#rpMonth', '#rpYear'].forEach(id => $(id).addEventListener('change', () => { this.setRangeFromMonth(); this.update(); }));
    ['#rpFrom', '#rpTo'].forEach(id => $(id).addEventListener('change', () => { this.syncMonthFromRange(); this.update(); }));
    $$('.rp-in').forEach(el => el.addEventListener('input', () => this.updateSoon()));
    $$('.rp-page').forEach(el => el.addEventListener('change', () => {
      LS.set('memo.pages', JSON.stringify($$('.rp-page:checked').map(c => c.value)));
      this.update();
    }));
  },

  renderDigits() {
    $$('#rpDigits button').forEach(b => {
      b.classList.toggle('active', b.dataset.v === this.digits);
      b.onclick = () => { this.digits = b.dataset.v; LS.set('memo.digits', this.digits); this.renderDigits(); this.update(); };
    });
  },

  setRangeFromMonth() {
    const y = +$('#rpYear').value, m = +$('#rpMonth').value;
    $('#rpFrom').value = monthStart(y, m);
    $('#rpTo').value = monthEnd(y, m);
  },

  /** แก้ช่วงวันที่เองแล้ว ให้ช่องเดือน/ปีตามเดือนของวันเริ่มต้น (ไม่แตะช่วงวันที่) */
  syncMonthFromRange() {
    const f = $('#rpFrom').value, t = $('#rpTo').value;
    if (!f) return;
    const d = parseYmd(t && t < f ? t : f);
    $('#rpMonth').value = d.getMonth();
    if ([...$('#rpYear').options].some(o => +o.value === d.getFullYear())) $('#rpYear').value = d.getFullYear();
  },

  async render() {
    bindCommon();
    this.init();
    // ค่าเริ่มต้นจากหน้าตั้งค่า (เติมเฉพาะช่องที่ยังว่าง)
    if (!$('#rpAmount').value) $('#rpAmount').value = Store.settings.wage || '';
    if (!$('#rpRcvSchool').dataset.touched) $('#rpRcvSchool').value = Store.settings.schoolName || '';
    $('#rpRcvSchool').oninput = () => $('#rpRcvSchool').dataset.touched = '1';
    this.renderSettingsWarn();
    await this.update();
  },

  renderSettingsWarn() {
    const need = { fullName: 'ชื่อผู้รับจ้าง', position: 'ตำแหน่ง', wage: 'ค่าจ้าง', directorName: 'ผู้อำนวยการ', committeeChair: 'ประธานกรรมการ', supervisorName: 'ผู้ควบคุมงาน' };
    const miss = Object.entries(need).filter(([k]) => !String(Store.settings[k] || '').trim()).map(([, v]) => v);
    $('#rpSetWarn').classList.toggle('hidden', !miss.length);
    $('#rpSetWarn').innerHTML = `ยังไม่ได้กรอกในหน้าตั้งค่า: ${miss.join(', ')} — <a href="#settings" class="underline font-medium">ไปตั้งค่า</a>`;
  },

  updateSoon() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.update(), 250);
  },

  /** รวบรวมข้อมูลทั้งหมดที่เอกสารต้องใช้ (preview / Word / PDF ใช้ object เดียวกัน) */
  async data() {
    const v = id => $(id).value.trim();
    let from = v('#rpFrom'), to = v('#rpTo');
    if (!from || !to) throw new Error('กรุณาเลือกช่วงวันที่');
    if (from > to) [from, to] = [to, from];
    await Store.ensureRange(from, to);
    const TODAY = todayStr();
    const days = Store.daysIn(from, to);
    // ราชการต้องแสดงทุกวันในช่วง รวมเสาร์-อาทิตย์ วันที่ไม่มีบันทึกถือเป็นวันหยุด
    const allRows = [];
    for (let s = from; s <= to; s = addDays(s, 1)) {
      allRows.push(Store.days[s] || { date: s, status: 'holiday', note: '', items: [], unrecorded: true });
    }
    const amount = Number(v('#rpAmount') || 0), tax = Number(v('#rpTax') || 0);
    const missEnd = to < TODAY ? to : addDays(TODAY, -1);
    return {
      settings: Store.settings,
      from, to,
      rows: allRows,
      workDays: days.filter(d => d.status === 'work').length,
      leaveDays: days.filter(d => d.status === 'personal' || d.status === 'sick').length,
      tasks: days.reduce((n, d) => n + d.items.length, 0),
      missing: missEnd >= from ? Store.missingWeekdays(from, missEnd) : [],
      // ชื่อเดือนในเอกสารยึดตามวันเริ่มต้นของช่วงที่ใช้ดึงข้อมูลจริง
      monthName: TH_MONTHS[parseYmd(from).getMonth()],
      yearBE: parseYmd(from).getFullYear() + 543,
      amount, tax, net: Math.round((amount - tax) * 100) / 100,
      rcv: { no: v('#rpRcvNo'), date: v('#rpRcvDate'), school: v('#rpRcvSchool') },
      remark: v('#rpRemark'),
      pages: $$('.rp-page:checked').map(c => c.value),
      thaiDigits: this.digits === 'thai',
    };
  },

  async update() {
    let D;
    try { D = await this.data(); } catch (err) { toast(err.message, 'error'); return; }
    if (currentPage !== 'report') return;
    $('#rpNet').value = money(D.net);
    $('#rpAmountText').textContent = `(${bahtText(D.amount)})`;
    const chip = (n, l) => `<div class="rounded-xl bg-emerald-50 py-2"><div class="text-xl font-semibold text-emerald-700">${n}</div><div class="text-[11px] text-emerald-800/70">${l}</div></div>`;
    $('#rpSummary').innerHTML = chip(D.workDays, 'วันปฏิบัติงาน') + chip(D.leaveDays, 'วันลา') + chip(D.tasks, 'รายการงาน');
    $('#rpWarn').classList.toggle('hidden', !D.missing.length);
    $('#rpWarn').textContent = `มี ${D.missing.length} วันทำการที่ยังไม่บันทึก (ในรายงานจะแสดงเป็น "วันหยุด"): ${D.missing.map(fmtShort).join(', ')}`;
    $('#preview').innerHTML = D.pages.length
      ? renderPreviewHTML(buildDocModel(D))
      : '<p class="text-sm text-slate-500 text-center py-10">เลือกอย่างน้อย 1 ส่วนเพื่อแสดงตัวอย่าง</p>';
    this.fit();
  },

  fit() {
    const wrap = $('#preview');
    const pagePx = 210 * 96 / 25.4;
    const z = Math.min(1, (wrap.clientWidth - 2) / pagePx);
    wrap.querySelectorAll('.paper').forEach(p => p.style.zoom = z);
  },

  async exportAs(type, btn) {
    await withBusy(btn, async () => {
      const D = await this.data();
      if (!D.pages.length) throw new Error('กรุณาเลือกอย่างน้อย 1 ส่วน');
      if (!D.rows.length && D.pages.includes('3') &&
          !(await confirmBox('ไม่มีบันทึกในช่วงนี้', 'ตารางแบบรายงานจะว่างเปล่า ต้องการส่งออกต่อหรือไม่?', 'ส่งออก'))) return;
      const sections = buildDocModel(D);
      const name = reportFileName(D);
      if (type === 'docx') await exportDocx(sections, name);
      else await exportPdf(sections, name, type === 'pdf-open');
      toast(type === 'pdf-open' ? 'เปิด PDF ในแท็บใหม่แล้ว' : 'ดาวน์โหลดแล้ว');
    });
  },
};

/** แปลงโมเดลเอกสารเป็น HTML สำหรับ preview */
function renderPreviewHTML(sections) {
  const run = r => {
    if (typeof r === 'string') return esc(r);
    if (r.b) return `<b>${esc(r.text)}</b>`;
    return `<span class="f" style="min-width:${r.w}em">${r.fill ? esc(r.fill) : '&nbsp;'}</span>`;
  };
  // justify ในเบราว์เซอร์ขยายเฉพาะช่องว่าง ทำให้ภาษาไทยห่างผิดธรรมชาติ จึงแสดงชิดซ้ายเหมือน PDF
  const para = b => `<p style="text-align:${b.align === 'justify' ? 'left' : b.align};margin:${b.before}pt 0 ${b.after}pt ${b.ml}pt;text-indent:${b.fi}pt;font-size:${b.size}pt;font-weight:${b.bold ? 700 : 400}">${b.runs.length ? b.runs.map(run).join('') : '&nbsp;'}</p>`;
  const block = b => {
    switch (b.t) {
      case 'p': return para(b);
      case 'rcv': return `<div class="rcv" style="width:${b.width}pt">${b.lines.map(l => para({ t: 'p', runs: l, align: 'left', ml: 0, fi: 0, size: 16, bold: false, before: 0, after: 0 })).join('')}</div>`;
      case 'keep': return b.blocks.map(block).join('');
      case 'cols': return `<div style="display:grid;grid-template-columns:repeat(${b.cols.length},1fr)">${b.cols.map(c => `<div>${c.map(block).join('')}</div>`).join('')}</div>`;
      case 'table': {
        const total = b.widths.reduce((a, c) => a + c, 0);
        const lines = arr => arr.map(l => `<div>${esc(l)}</div>`).join('') || '&nbsp;';
        return `<table style="font-size:${b.size}pt"><colgroup>${b.widths.map(w => `<col style="width:${(w / total * 100).toFixed(2)}%">`).join('')}</colgroup>
          <thead><tr>${b.head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead>
          <tbody>${b.rows.map(r => `<tr>${r.map(c => Array.isArray(c)
            ? `<td>${lines(c)}</td>`
            : `<td colspan="${c.span}" style="text-align:center;vertical-align:middle;background:${HOLIDAY_SHADE.color}${Math.round(HOLIDAY_SHADE.opacity * 255).toString(16).padStart(2, '0')}">${esc(c.text)}</td>`).join('')}</tr>`).join('') ||
            `<tr><td colspan="${b.head.length}" style="text-align:center;color:#888">— ไม่มีบันทึกในช่วงวันที่เลือก —</td></tr>`}</tbody></table>`;
      }
      default: return '';
    }
  };
  return sections.map(s => `<div class="paper" title="${esc(s.title)}">${s.blocks.map(block).join('')}</div>`).join('');
}

RENDER.report = () => Report.render();
addEventListener('resize', () => currentPage === 'report' && Report.fit());
