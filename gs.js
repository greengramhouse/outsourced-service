/**
 * ระบบบันทึกการทำงานประจำวัน — เจ้าหน้าที่ธุรการ โรงเรียนชุมชนวัดไทยงาม
 * Backend: Google Apps Script + Google Sheets
 *
 * วิธีติดตั้ง
 *  1. สร้าง Google Sheet ใหม่ > ส่วนขยาย > Apps Script
 *  2. ลบโค้ดเดิมใน Code.gs แล้ววางไฟล์นี้ทั้งหมด > บันทึก
 *  3. เลือกฟังก์ชัน setup แล้วกด "เรียกใช้" (ครั้งแรกจะขอสิทธิ์ ให้กดอนุญาต)
 *  4. ทำให้ใช้งานได้ > การทำให้ใช้งานได้รายการใหม่ > ประเภท: เว็บแอป
 *       - เรียกใช้ในฐานะ: ฉัน
 *       - ผู้ที่มีสิทธิ์เข้าถึง: ทุกคน (Anyone)
 *  5. คัดลอก URL ที่ลงท้ายด้วย /exec ไปใส่ใน assets/js/config.js ของเว็บ
 *
 * เมื่อแก้โค้ดนี้ภายหลัง ต้อง "จัดการการทำให้ใช้งานได้ > แก้ไข > เวอร์ชันใหม่"
 * URL เดิมจึงจะใช้โค้ดใหม่
 *
 * รูปแบบการเรียก API
 *  GET  ?action=ping
 *  GET  ?action=init                         -> { settings, presets }
 *  GET  ?action=getRange&from=YYYY-MM-DD&to=YYYY-MM-DD -> { days: [...] }
 *  GET  ?action=getDay&date=YYYY-MM-DD       -> { day }
 *  POST (Content-Type: text/plain) body = JSON.stringify({ action, ... })
 *       saveDay      { date, status, note, items:[{task,qty,unit}] }
 *       deleteDay    { date }
 *       saveSettings { settings:{key:value} }
 *       savePresets  { presets:[{task,unit}] }
 */

const SHEET = {
  DAYS: 'Days',
  ITEMS: 'Items',
  SETTINGS: 'Settings',
  PRESETS: 'Presets',
};

const TZ = 'Asia/Bangkok';

const HEADERS = {
  Days: ['date', 'status', 'note', 'updatedAt'],
  Items: ['date', 'seq', 'task', 'qty', 'unit'],
  Settings: ['key', 'value', 'label'],
  Presets: ['task', 'unit'],
};

// สถานะที่ยอมรับ: work=ปฏิบัติงาน, personal=ลากิจ, sick=ลาป่วย, holiday=วันหยุด
const STATUSES = ['work', 'personal', 'sick', 'holiday'];

const DEFAULT_SETTINGS = [
  ['schoolName', 'ชุมชนวัดไทยงาม', 'ชื่อโรงเรียน (ไม่ต้องมีคำว่าโรงเรียน)'],
  ['fullName', '', 'ชื่อ-สกุลผู้รับจ้าง (รวมคำนำหน้า)'],
  ['position', 'เจ้าหน้าที่ธุรการ', 'ตำแหน่ง'],
  ['wage', '9000', 'ค่าจ้างรายเดือน (บาท)'],
  ['contractNo', '', 'เลขที่บันทึกข้อตกลงจ้าง เช่น 1/2570'],
  ['contractDate', '', 'ลงวันที่ (บันทึกข้อตกลงจ้าง) เช่น 1 ตุลาคม 2569'],
  ['directorName', '', 'ชื่อผู้อำนวยการโรงเรียน'],
  ['committeeChair', '', 'ประธานกรรมการตรวจรับพัสดุ'],
  ['committee1', '', 'กรรมการตรวจรับพัสดุ คนที่ 1'],
  ['committee2', '', 'กรรมการตรวจรับพัสดุ คนที่ 2'],
  ['officerName', '', 'เจ้าหน้าที่ (พัสดุ)'],
  ['headOfficerName', '', 'หัวหน้าเจ้าหน้าที่ (พัสดุ)'],
  ['supervisorName', '', 'ผู้ควบคุมการปฏิบัติงาน'],
];

const DEFAULT_PRESETS = [
  ['ลงทะเบียนรับหนังสือราชการ', 'เรื่อง'],
  ['ลงทะเบียนส่งหนังสือราชการ', 'เรื่อง'],
  ['พิมพ์หนังสือภายนอก', 'เรื่อง'],
  ['พิมพ์หนังสือภายใน / บันทึกข้อความ', 'เรื่อง'],
  ['เสนอหนังสือต่อผู้บริหาร', 'เรื่อง'],
  ['ทำวาระการประชุม', 'ครั้ง'],
  ['จดบันทึกรายงานการประชุม', 'ครั้ง'],
  ['จัดเก็บเอกสารเข้าแฟ้ม', 'เรื่อง'],
  ['ถ่ายเอกสาร', 'ชุด'],
  ['ประสานงานหน่วยงานภายนอก', 'ครั้ง'],
  ['บันทึกข้อมูลในระบบ', 'รายการ'],
];

/* ------------------------------------------------------------------ */
/* Setup                                                              */
/* ------------------------------------------------------------------ */

/** รันครั้งแรกครั้งเดียวจากหน้า Apps Script เพื่อสร้างชีตทั้งหมด (รันซ้ำได้ ไม่ลบข้อมูลเดิม) */
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(HEADERS).forEach(function (name) {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    if (sh.getLastRow() === 0) {
      sh.getRange(1, 1, 1, HEADERS[name].length).setValues([HEADERS[name]]).setFontWeight('bold');
      sh.setFrozenRows(1);
    }
  });

  // คอลัมน์วันที่เก็บเป็นข้อความ ป้องกัน Sheets แปลงเป็น Date เอง
  ss.getSheetByName(SHEET.DAYS).getRange('A:A').setNumberFormat('@');
  ss.getSheetByName(SHEET.ITEMS).getRange('A:A').setNumberFormat('@');
  ss.getSheetByName(SHEET.SETTINGS).getRange('B:B').setNumberFormat('@');

  const setSh = ss.getSheetByName(SHEET.SETTINGS);
  const existingKeys = readRows_(setSh).map(function (r) { return r[0]; });
  const missing = DEFAULT_SETTINGS.filter(function (r) { return existingKeys.indexOf(r[0]) === -1; });
  if (missing.length) {
    setSh.getRange(setSh.getLastRow() + 1, 1, missing.length, 3).setValues(missing);
  }

  const preSh = ss.getSheetByName(SHEET.PRESETS);
  if (preSh.getLastRow() <= 1) {
    preSh.getRange(2, 1, DEFAULT_PRESETS.length, 2).setValues(DEFAULT_PRESETS);
  }

  const blank = ss.getSheetByName('Sheet1') || ss.getSheetByName('ชีต1');
  if (blank && ss.getSheets().length > 1 && blank.getLastRow() === 0) ss.deleteSheet(blank);

  Logger.log('setup เสร็จแล้ว');
}

const JANITOR_PRESETS = [
  ['ทำความสะอาดห้องเรียนและอาคาร', 'ห้อง'],
  ['ทำความสะอาดห้องน้ำ', 'ห้อง'],
  ['กวาดลานและบริเวณโรงเรียน', 'ครั้ง'],
  ['เก็บและทิ้งขยะ', 'ครั้ง'],
  ['ตัดหญ้า / ดูแลสนาม', 'ครั้ง'],
  ['รดน้ำต้นไม้', 'ครั้ง'],
  ['เปิด-ปิดอาคารเรียน', 'ครั้ง'],
  ['ซ่อมแซมวัสดุครุภัณฑ์', 'รายการ'],
  ['จัดสถานที่ / ขนย้ายโต๊ะเก้าอี้', 'ครั้ง'],
  ['ดูแลความปลอดภัยอาคารสถานที่', 'ครั้ง'],
  ['ช่วยงานกิจกรรมโรงเรียน', 'ครั้ง'],
];

/**
 * ใช้แทน setup() สำหรับ Sheet ของ "นักการภารโรง" (รันครั้งแรกครั้งเดียว)
 * สร้างชีตเหมือน setup() แล้วตั้งตำแหน่งและงานที่ใช้บ่อยของนักการภารโรง
 * ถ้าแก้ไขตั้งค่าหรือรายการงานไปแล้ว รันซ้ำก็ไม่ทับ
 */
function setupJanitor() {
  setup();
  if (getSettings_().position === 'เจ้าหน้าที่ธุรการ') saveSettings_({ position: 'นักการภารโรง' });
  const presets = getPresets_();
  if (!presets.length || presets[0].task === DEFAULT_PRESETS[0][0]) {
    savePresets_(JANITOR_PRESETS.map(function (r) { return { task: r[0], unit: r[1] }; }));
  }
  Logger.log('setupJanitor เสร็จแล้ว');
}

/* ------------------------------------------------------------------ */
/* Entry points                                                       */
/* ------------------------------------------------------------------ */

function doGet(e) {
  const p = (e && e.parameter) || {};
  return handle_(p.action, p);
}

function doPost(e) {
  let body = {};
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return json_({ ok: false, error: 'รูปแบบข้อมูลไม่ถูกต้อง (JSON)' });
  }
  return handle_(body.action, body);
}

function handle_(action, p) {
  try {
    switch (action) {
      case 'ping':         return json_({ ok: true, time: new Date().toISOString() });
      case 'init':         return json_({ ok: true, settings: getSettings_(), presets: getPresets_() });
      case 'getRange':     return json_({ ok: true, days: getRange_(p.from, p.to) });
      case 'getDay':       return json_({ ok: true, day: getRange_(p.date, p.date)[0] || null });
      case 'saveDay':      return withLock_(function () { return json_({ ok: true, day: saveDay_(p) }); });
      case 'deleteDay':    return withLock_(function () { deleteDay_(p.date); return json_({ ok: true }); });
      case 'saveSettings': return withLock_(function () { return json_({ ok: true, settings: saveSettings_(p.settings) }); });
      case 'savePresets':  return withLock_(function () { return json_({ ok: true, presets: savePresets_(p.presets) }); });
      default:             return json_({ ok: false, error: 'ไม่รู้จัก action: ' + action });
    }
  } catch (err) {
    return json_({ ok: false, error: String((err && err.message) || err) });
  }
}

/* ------------------------------------------------------------------ */
/* Days + Items                                                       */
/* ------------------------------------------------------------------ */

function getRange_(from, to) {
  assertDate_(from);
  assertDate_(to);

  const days = {};
  readRows_(sheet_(SHEET.DAYS)).forEach(function (r) {
    const d = toDateStr_(r[0]);
    if (d >= from && d <= to) {
      days[d] = { date: d, status: r[1] || 'work', note: r[2] || '', updatedAt: r[3] || '', items: [] };
    }
  });

  readRows_(sheet_(SHEET.ITEMS)).forEach(function (r) {
    const d = toDateStr_(r[0]);
    if (days[d]) {
      days[d].items.push({ seq: Number(r[1]) || 0, task: String(r[2] || ''), qty: r[3] === '' ? '' : r[3], unit: String(r[4] || '') });
    }
  });

  return Object.keys(days).sort().map(function (d) {
    const day = days[d];
    day.items.sort(function (a, b) { return a.seq - b.seq; });
    day.items = day.items.map(function (it) { return { task: it.task, qty: it.qty, unit: it.unit }; });
    return day;
  });
}

function saveDay_(p) {
  assertDate_(p.date);
  const status = STATUSES.indexOf(p.status) >= 0 ? p.status : 'work';
  const items = (p.items || [])
    .filter(function (it) { return it && String(it.task || '').trim(); })
    .map(function (it, i) {
      return [p.date, i + 1, String(it.task).trim(), it.qty === '' || it.qty == null ? '' : Number(it.qty), String(it.unit || '').trim()];
    });
  const note = String(p.note || '').trim();
  const now = Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd'T'HH:mm:ss");

  // Days: upsert
  const daySh = sheet_(SHEET.DAYS);
  const rowIdx = findRowIndex_(daySh, p.date);
  const rowVals = [[p.date, status, note, now]];
  if (rowIdx > 0) {
    daySh.getRange(rowIdx, 1, 1, 4).setValues(rowVals);
  } else {
    daySh.getRange(daySh.getLastRow() + 1, 1, 1, 4).setValues(rowVals);
  }

  // Items: ลบของเดิมของวันนั้นแล้วเขียนใหม่
  deleteItemsOf_(p.date);
  if (items.length) {
    const itSh = sheet_(SHEET.ITEMS);
    itSh.getRange(itSh.getLastRow() + 1, 1, items.length, 5).setValues(items);
  }

  return getRange_(p.date, p.date)[0];
}

function deleteDay_(date) {
  assertDate_(date);
  const daySh = sheet_(SHEET.DAYS);
  const rowIdx = findRowIndex_(daySh, date);
  if (rowIdx > 0) daySh.deleteRow(rowIdx);
  deleteItemsOf_(date);
}

/** ลบแถวใน Items ของวันที่ระบุ โดยลบเป็นก้อนต่อเนื่องจากล่างขึ้นบน */
function deleteItemsOf_(date) {
  const sh = sheet_(SHEET.ITEMS);
  const last = sh.getLastRow();
  if (last < 2) return;
  const col = sh.getRange(2, 1, last - 1, 1).getValues();

  const runs = []; // [startRow, count]
  for (let i = 0; i < col.length; i++) {
    if (toDateStr_(col[i][0]) !== date) continue;
    const row = i + 2;
    const lastRun = runs[runs.length - 1];
    if (lastRun && lastRun[0] + lastRun[1] === row) lastRun[1]++;
    else runs.push([row, 1]);
  }
  for (let j = runs.length - 1; j >= 0; j--) sh.deleteRows(runs[j][0], runs[j][1]);
}

/* ------------------------------------------------------------------ */
/* Settings + Presets                                                 */
/* ------------------------------------------------------------------ */

function getSettings_() {
  const out = {};
  readRows_(sheet_(SHEET.SETTINGS)).forEach(function (r) {
    if (r[0]) out[r[0]] = r[1] === null || r[1] === undefined ? '' : String(r[1]);
  });
  return out;
}

function saveSettings_(settings) {
  if (!settings || typeof settings !== 'object') throw new Error('ไม่มีข้อมูลตั้งค่า');
  const sh = sheet_(SHEET.SETTINGS);
  const rows = readRows_(sh);
  Object.keys(settings).forEach(function (key) {
    const val = String(settings[key] == null ? '' : settings[key]);
    const idx = rows.findIndex(function (r) { return r[0] === key; });
    if (idx >= 0) {
      sh.getRange(idx + 2, 2).setValue(val);
    } else {
      sh.appendRow([key, val, '']);
      rows.push([key, val, '']);
    }
  });
  return getSettings_();
}

function getPresets_() {
  return readRows_(sheet_(SHEET.PRESETS))
    .filter(function (r) { return String(r[0] || '').trim(); })
    .map(function (r) { return { task: String(r[0]), unit: String(r[1] || '') }; });
}

function savePresets_(presets) {
  if (!Array.isArray(presets)) throw new Error('presets ต้องเป็น array');
  const sh = sheet_(SHEET.PRESETS);
  const last = sh.getLastRow();
  if (last > 1) sh.getRange(2, 1, last - 1, 2).clearContent();
  const rows = presets
    .filter(function (p) { return p && String(p.task || '').trim(); })
    .map(function (p) { return [String(p.task).trim(), String(p.unit || '').trim()]; });
  if (rows.length) sh.getRange(2, 1, rows.length, 2).setValues(rows);
  return getPresets_();
}

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

function sheet_(name) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sh) throw new Error('ไม่พบชีต "' + name + '" กรุณารันฟังก์ชัน setup ก่อน');
  return sh;
}

/** อ่านข้อมูลทั้งชีต ไม่รวมแถวหัวตาราง */
function readRows_(sh) {
  const last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, sh.getLastColumn()).getValues();
}

/** หาแถว (1-based) ที่คอลัมน์ A ตรงกับวันที่ คืน -1 ถ้าไม่พบ */
function findRowIndex_(sh, date) {
  const last = sh.getLastRow();
  if (last < 2) return -1;
  const col = sh.getRange(2, 1, last - 1, 1).getValues();
  for (let i = 0; i < col.length; i++) {
    if (toDateStr_(col[i][0]) === date) return i + 2;
  }
  return -1;
}

function toDateStr_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, TZ, 'yyyy-MM-dd');
  return String(v || '').trim();
}

function assertDate_(d) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(d || ''))) throw new Error('วันที่ไม่ถูกต้อง: ' + d);
}

function withLock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ------------------------------------------------------------------ */
/* ทดสอบใน editor (ไม่จำเป็นต่อการใช้งาน)                              */
/* ------------------------------------------------------------------ */

function testSaveAndRead() {
  saveDay_({
    date: '2026-10-01',
    status: 'work',
    note: '',
    items: [
      { task: 'ลงทะเบียนรับหนังสือราชการ', qty: 3, unit: 'เรื่อง' },
      { task: 'พิมพ์หนังสือภายนอก', qty: 1, unit: 'เรื่อง' },
      { task: 'ทำวาระประชุม', qty: 1, unit: 'ครั้ง' },
    ],
  });
  Logger.log(JSON.stringify(getRange_('2026-10-01', '2026-10-31'), null, 2));
}
