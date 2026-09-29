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

const NANNY_PRESETS = [
  ['ดูแลช่วยเหลือเด็กพิการในกิจวัตรประจำวัน', 'คน'], ['ช่วยเหลือการเคลื่อนย้าย / การเดิน', 'ครั้ง'],
  ['ดูแลการรับประทานอาหาร', 'ครั้ง'], ['ดูแลความสะอาดร่างกาย / การขับถ่าย', 'ครั้ง'], ['ฝึกทักษะการช่วยเหลือตนเอง', 'ครั้ง'],
  ['ช่วยครูจัดกิจกรรมตามแผน IEP', 'กิจกรรม'], ['ช่วยครูในห้องเรียนรวม', 'คาบ'], ['เตรียมสื่อและอุปกรณ์การสอน', 'ชุด'],
  ['ประสานงานกับผู้ปกครอง', 'ครั้ง'], ['บันทึกพัฒนาการเด็ก', 'คน'],
].map(([task, unit]) => ({ task, unit }));

// ค่าเริ่มต้นตามตำแหน่ง (ใช้ในโหมดทดลอง ส่วน Sheet จริงใช้ค่าจาก setup()/setupJanitor()/setupNanny() ใน gs.js)
const ROLE_DEFAULTS = {
  admin: { position: 'เจ้าหน้าที่ธุรการ', presets: DEFAULT_PRESETS },
  janitor: { position: 'นักการภารโรง', presets: JANITOR_PRESETS },
  nanny: { position: 'พี่เลี้ยงเด็กพิการ', presets: NANNY_PRESETS },
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
  lsKey(name, id = this.get().id) {
    const legacy = { apiUrl: 'memo.apiUrl', local: 'memo.local.v1' };
    return id === 'admin' ? legacy[name] : `memo.${id}.${name}`;
  },

  defaults(id = this.get().id) {
    const r = ROLE_DEFAULTS[id] || ROLE_DEFAULTS.admin;
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
  url(id = Profile.get().id) {
    const p = Profile.list().find(x => x.id === id) || {};
    return (LS.get(Profile.lsKey('apiUrl', id)) || p.API_URL || '').trim();
  },
  setUrl(u) { LS.set(Profile.lsKey('apiUrl'), (u || '').trim()); },
  isLocal(id) { return !this.url(id); },

  busy(delta) {
    this.pending += delta;
    document.getElementById('topLoader')?.classList.toggle('hidden', this.pending <= 0);
  },

  // Apps Script บางครั้งค้างนานเป็นนาที (cold start) — GET ที่เกินเวลานี้ให้ยกเลิกแล้วลองใหม่ ซึ่งมักได้คำตอบใน 1–3 วินาที
  // POST ไม่ตั้งเวลา เพราะถ้ายกเลิกกลางทาง ฝั่ง Sheet อาจบันทึกไปแล้ว
  GET_TIMEOUT: 12000,

  async request(url, action, params = {}, method = 'GET') {
    const ctl = new AbortController();
    const timer = method === 'GET' ? setTimeout(() => ctl.abort(), this.GET_TIMEOUT) : null;
    let text;
    try {
      const res = method === 'GET'
        ? await fetch(`${url}?${new URLSearchParams({ action, ...params, _: Date.now() })}`, { method: 'GET', redirect: 'follow', signal: ctl.signal })
        : await fetch(url, {
          method: 'POST', redirect: 'follow',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action, ...params }),
        });
      if (!res.ok) throw new Error(`เซิร์ฟเวอร์ตอบกลับผิดพลาด (${res.status})`);
      text = await res.text();
    } catch (err) {
      if (err.name === 'AbortError') throw new Error('Google Apps Script ตอบช้าเกินไป — ลองใหม่อีกครั้ง');
      throw err;
    } finally {
      clearTimeout(timer);
    }
    let data;
    try { data = JSON.parse(text); } catch {
      throw new Error('ข้อมูลตอบกลับไม่ใช่ JSON — ตรวจว่า Deploy เป็น Web app และตั้งสิทธิ์เป็น "ทุกคน"');
    }
    if (!data.ok) throw new Error(data.error || 'เกิดข้อผิดพลาด');
    return data;
  },

  /** opt.profile = ยิงไปที่ Sheet ของตำแหน่งนั้น (ค่าเริ่มต้น = ตำแหน่งปัจจุบัน), opt.silent = ไม่แสดงแถบโหลดด้านบน */
  async call(action, params = {}, method = 'GET', opt = {}) {
    const id = opt.profile || Profile.get().id;
    const busy = opt.silent ? 0 : 1;
    this.busy(busy);
    try {
      if (this.isLocal(id)) {
        if (id !== Profile.get().id) throw new Error('โหมดทดลองอ่านได้เฉพาะตำแหน่งปัจจุบัน');
        await new Promise(r => setTimeout(r, 120));
        const data = LocalBackend.handle(action, JSON.parse(JSON.stringify(params)));
        if (!data.ok) throw new Error(data.error);
        return data;
      }
      if (!navigator.onLine) throw new Error('ไม่มีการเชื่อมต่ออินเทอร์เน็ต');
      const url = this.url(id);
      try {
        return await this.request(url, action, params, method);
      } catch (err) {
        if (method !== 'GET' || err instanceof SyntaxError) throw err;
        return await this.request(url, action, params, method); // GET ลองใหม่ 1 ครั้ง
      }
    } catch (err) {
      if (err instanceof TypeError) throw new Error('เชื่อมต่อ Google Apps Script ไม่ได้ — ตรวจ URL และอินเทอร์เน็ต');
      throw err;
    } finally {
      this.busy(-busy);
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
// เก็บแยกตามตำแหน่ง และจำไว้ใน localStorage ด้วย: เปิดเว็บหรือสลับตำแหน่งแล้วแสดงข้อมูลชุดล่าสุดทันที
// จากนั้นค่อยโหลดของใหม่จาก Sheet เบื้องหลัง (Apps Script ตอบช้า 1–3 วินาที และบางครั้งนานหลายสิบวินาที)
const cacheKey = id => `memo.cache.${id}`;

function newProfileState(id) {
  const st = {
    settings: { ...Profile.defaults(id).settings }, presets: [], days: {},
    loadedMonths: new Set(),
    staleMonths: new Set(), // เดือนที่มาจาก cache ยังไม่ได้โหลดใหม่จาก Sheet
    inflight: new Map(),    // เดือน -> Promise ที่กำลังโหลด (กันยิงซ้ำ)
    ready: null,            // Promise ของ init
    loaded: false,
  };
  if (API.isLocal(id)) return st;
  try {
    const c = JSON.parse(LS.get(cacheKey(id)));
    if (c && c.url === API.url(id)) {
      Object.assign(st, { settings: { ...st.settings, ...c.settings }, presets: c.presets || [], days: c.days || {}, loaded: true });
      st.loadedMonths = new Set(c.months);
      st.staleMonths = new Set(c.months);
    }
  } catch { /* cache เสีย ใช้ค่าว่าง */ }
  return st;
}

const Store = {
  cache: {},
  onChange: null, // app.js ตั้งไว้ ให้วาดหน้าใหม่เมื่อข้อมูลจาก Sheet มาถึงทีหลัง

  /** state ของตำแหน่ง id (ค่าเริ่มต้น = ตำแหน่งปัจจุบัน) */
  st(id = Profile.get().id) { return this.cache[id] || (this.cache[id] = newProfileState(id)); },
  get settings() { return this.st().settings; },
  get presets() { return this.st().presets; },
  get days() { return this.st().days; },
  get loadedMonths() { return this.st().loadedMonths; },
  isReady(id) { return this.st(id).loaded; },

  persist(id = Profile.get().id) {
    if (API.isLocal(id)) return;
    const st = this.st(id);
    LS.set(cacheKey(id), JSON.stringify({ url: API.url(id), settings: st.settings, presets: st.presets, days: st.days, months: [...st.loadedMonths] }));
  },

  changed(id) {
    this.persist(id);
    if (id === Profile.get().id && this.onChange) this.onChange();
  },

  /** โหลดตั้งค่า ถ้ามีข้อมูลเดิมอยู่แล้วจะคืนทันทีแล้วโหลดใหม่เบื้องหลัง */
  init(id = Profile.get().id, opt = {}) {
    const st = this.st(id);
    if (!st.ready) {
      st.ready = API.call('init', {}, 'GET', { ...opt, profile: id }).then(r => {
        st.settings = { ...Profile.defaults(id).settings, ...r.settings };
        st.presets = r.presets || [];
        st.loaded = true;
        this.changed(id);
      }).catch(err => { st.ready = null; throw err; });
    }
    if (st.loaded) { st.ready.catch(err => console.warn('init', id, err)); return Promise.resolve(); }
    return st.ready;
  },

  /** โหลดตั้งค่า + เดือนก่อนหน้าและเดือนนี้ (ที่หน้าหลักใช้) พร้อมกัน */
  warm(id = Profile.get().id, opt = {}) {
    const now = new Date();
    return Promise.all([
      this.init(id, opt),
      this.ensureRange(monthStart(now.getFullYear(), now.getMonth() - 1), monthEnd(now.getFullYear(), now.getMonth()), false, id, opt),
    ]);
  },

  /** โหลดตำแหน่งอื่นที่ต่อ Google Sheet ไว้ล่วงหน้าแบบเงียบ ๆ (ปลุก Apps Script ด้วย) ให้สลับแล้วขึ้นทันที */
  prefetchOthers() {
    Profile.list().forEach(p => {
      if (p.id === Profile.get().id || API.isLocal(p.id)) return;
      this.warm(p.id, { silent: true }).catch(err => console.warn('prefetch', p.id, err));
    });
  },

  monthsBetween(from, to) {
    const out = [];
    let d = parseYmd(from.slice(0, 7) + '-01');
    const end = parseYmd(to.slice(0, 7) + '-01');
    while (d <= end) { out.push(ymd(d).slice(0, 7)); d = new Date(d.getFullYear(), d.getMonth() + 1, 1); }
    return out;
  },

  /** เรียก getRange ครั้งเดียวครอบเดือนแรกถึงเดือนสุดท้ายของ months */
  fetchMonths(id, months, opt) {
    const st = this.st(id);
    const f = months[0] + '-01';
    const last = months[months.length - 1];
    const span = this.monthsBetween(f, monthEnd(+last.slice(0, 4), +last.slice(5, 7) - 1));
    const job = API.call('getRange', { from: f, to: monthEnd(+last.slice(0, 4), +last.slice(5, 7) - 1) }, 'GET', { ...opt, profile: id }).then(r => {
      const inSpan = new Set(span);
      Object.keys(st.days).forEach(k => inSpan.has(monthKey(k)) && delete st.days[k]);
      r.days.forEach(d => st.days[d.date] = d);
      span.forEach(m => { st.loadedMonths.add(m); st.staleMonths.delete(m); });
      this.changed(id);
    }).finally(() => span.forEach(m => st.inflight.get(m) === job && st.inflight.delete(m)));
    span.forEach(m => st.inflight.set(m, job));
    return job;
  },

  /** โหลดเดือนที่ยังไม่มีในช่วง from..to — เดือนที่มีจาก cache ใช้ได้ทันทีแล้วโหลดใหม่เบื้องหลัง */
  async ensureRange(from, to, force = false, id = Profile.get().id, opt = {}) {
    const st = this.st(id);
    const months = this.monthsBetween(from, to);
    if (force) return this.fetchMonths(id, months, opt);

    const stale = months.filter(m => st.staleMonths.has(m) && !st.inflight.has(m));
    if (stale.length) this.fetchMonths(id, stale, opt).catch(err => console.warn('refresh', id, err));

    const waiting = months.filter(m => st.inflight.has(m) && !st.loadedMonths.has(m)).map(m => st.inflight.get(m));
    const missing = months.filter(m => !st.loadedMonths.has(m) && !st.inflight.has(m));
    if (missing.length) waiting.push(this.fetchMonths(id, missing, opt));
    await Promise.all(waiting);
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
    const id = Profile.get().id, days = this.days;
    const r = await API.call('saveDay', day, 'POST');
    days[r.day.date] = r.day;
    this.persist(id);
    return r.day;
  },

  async deleteDay(date) {
    const id = Profile.get().id, days = this.days;
    await API.call('deleteDay', { date }, 'POST');
    delete days[date];
    this.persist(id);
  },

  async saveSettings(settings) {
    const id = Profile.get().id, st = this.st();
    const r = await API.call('saveSettings', { settings }, 'POST');
    st.settings = { ...Profile.defaults().settings, ...r.settings };
    this.persist(id);
  },

  async savePresets(presets) {
    const id = Profile.get().id, st = this.st();
    const r = await API.call('savePresets', { presets }, 'POST');
    st.presets = r.presets;
    this.persist(id);
  },

  /** ล้างข้อมูลของตำแหน่งปัจจุบัน (ใช้ตอนเปลี่ยน URL) */
  reset() { delete this.cache[Profile.get().id]; LS.set(cacheKey(Profile.get().id), ''); },
};
