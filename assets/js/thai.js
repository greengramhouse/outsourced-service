// วันที่ไทย ตัวเลขไทย และคำอ่านจำนวนเงิน
const TH_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const TH_MON_S = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const TH_DAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
const TH_DAYS_S = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseYmd = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); };
const monthKey = s => s.slice(0, 7);
const monthStart = (y, m) => ymd(new Date(y, m, 1));
const monthEnd = (y, m) => ymd(new Date(y, m + 1, 0));
const todayStr = () => ymd(new Date());
const isWeekday = s => { const w = parseYmd(s).getDay(); return w !== 0 && w !== 6; };

const fmtShort = s => { const d = parseYmd(s); return `${d.getDate()} ${TH_MON_S[d.getMonth()]} ${d.getFullYear() + 543}`; };
const fmtLong = s => { const d = parseYmd(s); return `วัน${TH_DAYS[d.getDay()]}ที่ ${d.getDate()} ${TH_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`; };

const toThaiDigits = s => String(s).replace(/[0-9]/g, c => '๐๑๒๓๔๕๖๗๘๙'[c]);
const money = n => {
  n = Number(n || 0);
  return n.toLocaleString('en-US', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
};

function bahtText(num) {
  num = Math.round(Number(num || 0) * 100) / 100;
  if (num < 0) return 'ลบ' + bahtText(-num);
  const [b, s] = num.toFixed(2).split('.');
  const txt = readThaiNumber(b) + 'บาท';
  return Number(s) ? txt + readThaiNumber(s) + 'สตางค์' : txt + 'ถ้วน';
}

function readThaiNumber(str) {
  str = String(parseInt(str, 10) || 0);
  if (str === '0') return 'ศูนย์';
  if (str.length > 6) {
    const hi = str.slice(0, -6), lo = Number(str.slice(-6));
    return readThaiNumber(hi) + 'ล้าน' + (lo === 1 ? 'เอ็ด' : lo ? readThaiNumber(lo) : '');
  }
  const N = ['', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
  const P = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน'];
  let out = '';
  for (let i = 0; i < str.length; i++) {
    const d = +str[i], p = str.length - i - 1;
    if (!d) continue;
    if (p === 0 && d === 1 && str.length > 1) out += 'เอ็ด';
    else if (p === 1 && d === 2) out += 'ยี่';
    else if (!(p === 1 && d === 1)) out += N[d];
    out += P[p];
  }
  return out;
}

/**
 * แทรก zero-width space (U+200B) ระหว่างคำไทย เพื่อให้ Word/pdfmake ตัดบรรทัดตรงรอยคำ
 * ไม่ตัดใน พ.ศ. / ต.ค. / 1/2570 / ตัวเลข และเครื่องหมายวรรคตอนติดคำก่อนหน้า
 */
const ZWSP = '​';
const thaiSegmenter = (typeof Intl !== 'undefined' && Intl.Segmenter) ? new Intl.Segmenter('th', { granularity: 'word' }) : null;
function thaiBreak(text) {
  text = String(text ?? '');
  if (!thaiSegmenter || !/[฀-๿]/.test(text)) return text;
  let out = '', prev = '';
  for (const { segment, isWordLike } of thaiSegmenter.segment(text)) {
    const glue = !prev ||
      /\s$/.test(prev) || /^\s/.test(segment) ||
      !isWordLike ||
      /[.(/\-]$/.test(prev) ||
      (/[0-9๐-๙,]$/.test(prev) && /^[0-9๐-๙,]/.test(segment));
    out += (glue ? '' : ZWSP) + segment;
    prev = segment;
  }
  return out;
}

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
