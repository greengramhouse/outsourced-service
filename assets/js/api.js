// การเชื่อมต่อ Apps Script + โหมดทดลอง (เก็บใน localStorage) + ที่เก็บข้อมูลฝั่งเว็บ (Store)

const DEFAULT_SETTINGS = {
  schoolName: 'ชุมชนวัดไทยงาม', fullName: '', position: 'เจ้าหน้าที่ธุรการ', wage: '9000',
  contractNo: '', contractDate: '', directorName: '', committeeChair: '', committee1: '', committee2: '',
  officerName: '', headOfficerName: '', supervisorName: '',
};
const DEFAULT_PRESETS = [
  ['ลงทะเบียนรับหนังสือราชการ', 'เรื่อง'], ['ลงทะเบียนส่งหนังสือราชการ', 'เรื่อง'],
  ['พิมพ์หนังสือภายนอก', 'เรื่อง'], ['พิมพ์หนังสือภายใน / บันทึกข้อความ', 'เรื่อง'],
  ['เสนอหนังสือต่อผู้บริหาร', 'เรื่อง'], ['ทำวาระการประชุม', 'ครั้ง'], ['จดบันทึกรายงานการประชุม', 'ครั้ง'],
  ['จัดเก็บเอกสารเข้าแฟ้ม', 'เรื่อง'], ['ถ่ายเอกสาร', 'ชุด'], ['ประสานงานหน่วยงานภายนอก', 'ครั้ง'],
  ['บันทึกข้อมูลในระบบ', 'รายการ'],
].map(([task, unit]) => ({ task, unit }));

const JANITOR_PRESETS = [
  ['ทำความสะอาดห้องเรียนและอาคาร', 'ห้อง'], ['ทำความสะอาดห้องน้ำ', 'ห้อง'],
  ['กวาดลานและบริเวณโรงเรียน', 'ครั้ง'], ['เก็บและทิ้งขยะ', 'ครั้ง'], ['ตัดหญ้า / ดูแลสนาม', 'ครั้ง'],
  ['รดน้ำต้นไม้', 'ครั้ง'], ['เปิด-ปิดอาคารเรียน', 'ครั้ง'], ['ซ่อมแซมวัสดุครุภัณฑ์', 'รายการ'],
  ['จัดสถานที่ / ขนย้ายโต๊ะเก้าอี้', 'ครั้ง'], ['ดูแลความปลอดภัยอาคารสถานที่', 'ครั้ง'], ['ช่วยงานกิจกรรมโรงเรียน', 'ครั้ง'],
].map(([task, unit]) => ({ task, unit }));

// ค่าเริ่มต้นตามตำแหน่ง (ใช้ในโหมดทดลอง ส่วน Sheet จริงใช้ค่าจาก setup()/setupJanitor() ใน gs.js)
const ROLE_DEFAULTS = {
  admin: { position: 'เจ้าหน้าที่ธุรการ', presets: DEFAULT_PRESETS },
  janitor: { position: 'นักการภารโรง', presets: JANITOR_PRESETS },
};

const LS = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { v == null || v === '' ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* private mode */ } },
};

/* ---------------- ตำแหน่ง (โปรไฟล์) ที่กำลังบันทึก ---------------- */
const Profile = {
  currentId: null,

  list() {
    const c = window.APP_CONFIG || {};
    return c.PROFILES && c.PROFILES.length ? c.PROFILES : [{ id: 'admin', label: 'ธุรการ', API_URL: c.API_URL || '' }];
  },

  /** เลือกจาก ?staff=... ในลิงก์ > ที่เลือกไว้ครั้งก่อน > ตำแหน่งแรก */
  init() {
    const ids = this.list().map(p => p.id);
    const fromUrl = new URLSearchParams(location.search).get('staff');
    this.currentId = [fromUrl, LS.get('memo.profile')].find(x => ids.includes(x)) || ids[0];
    LS.set('memo.profile', this.currentId);
  },

  get() { return this.list().find(p => p.id === this.currentId) || this.list()[0]; },
  set(id) { this.currentId = id; LS.set('memo.profile', id); },

  /** key ของ localStorage แยกตามตำแหน่ง (ธุรการใช้ key เดิม เพื่อไม่ให้ข้อมูลที่เคยเก็บไว้หาย) */
  lsKey(name) {
    const legacy = { apiUrl: 'memo.apiUrl', local: 'memo.local.v1' };
    return this.get().id === 'admin' ? legacy[name] : `memo.${this.get().id}.${name}`;
  },

  defaults() {
    const r = ROLE_DEFAULTS[this.get().id] || ROLE_DEFAULTS.admin;
    return { settings: { ...DEFAULT_SETTINGS, position: r.position }, presets: r.presets };
  },
};

/* ---------------- โหมดทดลอง: ทำงานเหมือน gs.js แต่เก็บในเบราว์เซอร์ ---------------- */
const LocalBackend = {
  get KEY() { return Profile.lsKey('local'); },
  load() {
    let db = null;
    try { db = JSON.parse(LS.get(this.KEY)); } catch { /* ignore */ }
    const def = Profile.defaults();
    return db || { settings: { ...def.settings }, presets: def.presets.slice(), days: {} };
  },
  save(db) { LS.set(this.KEY, JSON.stringify(db)); },
  handle(action, p) {
    const db = this.load();
    const cleanItems = items => (items || []).filter(i => String(i.task || '').trim())
      .map(i => ({ task: String(i.task).trim(), qty: i.qty === '' || i.qty == null ? '' : Number(i.qty), unit: String(i.unit || '').trim() }));
    switch (action) {
      case 'ping': return { ok: true, time: new Date().toISOString(), local: true };
      case 'init': return { ok: true, settings: { ...Profile.defaults().settings, ...db.settings }, presets: db.presets };
      case 'getRange': return { ok: true, days: Object.values(db.days).filter(d => d.date >= p.from && d.date <= p.to).sort((a, b) => a.date.localeCompare(b.date)) };
      case 'saveDay': {
        const day = { date: p.date, status: p.status || 'work', note: String(p.note || '').trim(), updatedAt: new Date().toISOString(), items: cleanItems(p.items) };
        db.days[p.date] = day; this.save(db); return { ok: true, day };
      }
      case 'deleteDay': delete db.days[p.date]; this.save(db); return { ok: true };
      case 'saveSettings': db.settings = { ...db.settings, ...p.settings }; this.save(db); return { ok: true, settings: { ...Profile.defaults().settings, ...db.settings } };
      case 'savePresets': db.presets = p.presets.filter(x => String(x.task || '').trim()); this.save(db); return { ok: true, presets: db.presets };
      default: return { ok: false, error: 'ไม่รู้จัก action: ' + action };
    }
  },
};

/* ---------------- API ---------------- */
const API = {
  pending: 0,
  url() { return (LS.get(Profile.lsKey('apiUrl')) || Profile.get().API_URL || '').trim(); },
  setUrl(u) { LS.set(Profile.lsKey('apiUrl'), (u || '').trim()); },
  isLocal() { return !this.url(); },

  busy(delta) {
    this.pending += delta;
    document.getElementById('topLoader')?.classList.toggle('hidden', this.pending <= 0);
  },

  async request(url, action, params = {}, method = 'GET') {
    let res;
    if (method === 'GET') {
      const qs = new URLSearchParams({ action, ...params, _: Date.now() });
      res = await fetch(`${url}?${qs}`, { method: 'GET', redirect: 'follow' });
    } else {
      res = await fetch(url, {
        method: 'POST', redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action, ...params }),
      });
    }
    if (!res.ok) throw new Error(`เซิร์ฟเวอร์ตอบกลับผิดพลาด (${res.status})`);
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch {
      throw new Error('ข้อมูลตอบกลับไม่ใช่ JSON — ตรวจว่า Deploy เป็น Web app และตั้งสิทธิ์เป็น "ทุกคน"');
    }
    if (!data.ok) throw new Error(data.error || 'เกิดข้อผิดพลาด');
    return data;
  },

  async call(action, params = {}, method = 'GET') {
    this.busy(1);
    try {
      if (this.isLocal()) {
        await new Promise(r => setTimeout(r, 120));
        const data = LocalBackend.handle(action, JSON.parse(JSON.stringify(params)));
        if (!data.ok) throw new Error(data.error);
        return data;
      }
      if (!navigator.onLine) throw new Error('ไม่มีการเชื่อมต่ออินเทอร์เน็ต');
      try {
        return await this.request(this.url(), action, params, method);
      } catch (err) {
        if (method !== 'GET' || err instanceof SyntaxError) throw err;
        return await this.request(this.url(), action, params, method); // GET ลองใหม่ 1 ครั้ง
      }
    } catch (err) {
      if (err instanceof TypeError) throw new Error('เชื่อมต่อ Google Apps Script ไม่ได้ — ตรวจ URL และอินเทอร์เน็ต');
      throw err;
    } finally {
      this.busy(-1);
    }
  },

  async ping(url) {
    this.busy(1);
    try { return await this.request(url, 'ping'); }
    catch (err) { if (err instanceof TypeError) throw new Error('เชื่อมต่อ URL นี้ไม่ได้'); throw err; }
    finally { this.busy(-1); }
  },
};

/* ---------------- Store: ข้อมูลที่โหลดแล้วฝั่งเว็บ ---------------- */
const Store = {
  settings: { ...DEFAULT_SETTINGS },
  presets: [],
  days: {},
  loadedMonths: new Set(),

  async init() {
    const r = await API.call('init');
    this.settings = { ...Profile.defaults().settings, ...r.settings };
    this.presets = r.presets || [];
  },

  monthsBetween(from, to) {
    const out = [];
    let d = parseYmd(from.slice(0, 7) + '-01');
    const end = parseYmd(to.slice(0, 7) + '-01');
    while (d <= end) { out.push(ymd(d).slice(0, 7)); d = new Date(d.getFullYear(), d.getMonth() + 1, 1); }
    return out;
  },

  /** โหลดเดือนที่ยังไม่เคยโหลดในช่วง from..to (เรียก API ครั้งเดียว) */
  async ensureRange(from, to, force = false) {
    const months = this.monthsBetween(from, to);
    const missing = force ? months : months.filter(m => !this.loadedMonths.has(m));
    if (!missing.length) return;
    const f = missing[0] + '-01';
    const last = missing[missing.length - 1];
    const t = monthEnd(+last.slice(0, 4), +last.slice(5, 7) - 1);
    const r = await API.call('getRange', { from: f, to: t });
    const span = new Set(this.monthsBetween(f, t));
    Object.keys(this.days).forEach(k => span.has(monthKey(k)) && delete this.days[k]);
    r.days.forEach(d => this.days[d.date] = d);
    span.forEach(m => this.loadedMonths.add(m));
  },

  daysIn(from, to) {
    return Object.values(this.days).filter(d => d.date >= from && d.date <= to).sort((a, b) => a.date.localeCompare(b.date));
  },

  missingWeekdays(from, to) {
    const out = [];
    for (let s = from; s <= to; s = addDays(s, 1)) if (isWeekday(s) && !this.days[s]) out.push(s);
    return out;
  },

  async saveDay(day) {
    const r = await API.call('saveDay', day, 'POST');
    this.days[r.day.date] = r.day;
    return r.day;
  },

  async deleteDay(date) {
    await API.call('deleteDay', { date }, 'POST');
    delete this.days[date];
  },

  async saveSettings(settings) {
    const r = await API.call('saveSettings', { settings }, 'POST');
    this.settings = { ...Profile.defaults().settings, ...r.settings };
  },

  async savePresets(presets) {
    const r = await API.call('savePresets', { presets }, 'POST');
    this.presets = r.presets;
  },

  reset() { this.days = {}; this.loadedMonths.clear(); this.presets = []; this.settings = { ...Profile.defaults().settings }; },
};
