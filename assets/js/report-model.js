// โมเดลเอกสารกลาง: สร้างครั้งเดียว แล้ว preview / Word นำไปแสดงผลเหมือนกัน
//
// Section = { blocks: Block[] }                       (1 section = เริ่มหน้าใหม่)
// Block   = { t:'p', runs, align, ml, fi, size, bold, before, after }   หน่วย pt
//         | { t:'rcv', width, lines: Run[][] }         กล่องรับเลขที่ชิดขวา
//         | { t:'table', widths(twip), head: string[], rows: Cell[][], size }
//             Cell = string[] (บรรทัดในเซลล์) | { span, text, shade } (เซลล์รวม span คอลัมน์ พื้นแดงโปร่ง)
//         | { t:'cols', cols: Block[][] }              สองคอลัมน์ ไม่มีเส้น
//         | { t:'keep', blocks: Block[] }              กลุ่มย่อหน้าที่ต้องอยู่หน้าเดียวกัน
// Run     = string | { text, b:true } | { fill, w }    fill = ค่าที่เติม (ว่าง = จุดไข่ปลา), w = ความกว้างขั้นต่ำ (em)

const PAGE = {
  width: 595.28, height: 841.89,
  margin: { top: 36, right: 36, bottom: 28.1, left: 49.65 }, // ตาม Formdoc.docx (720/720/562/993 twip)
};
PAGE.textWidth = PAGE.width - PAGE.margin.left - PAGE.margin.right;

const TABLE_COLS = [1555, 3402, 1417, 1772, 2037]; // gridCol ของตารางในต้นฉบับ (twip)

// สีพื้นแถววันหยุด: แดง #DC2626 ความทึบ 20% (Word ไม่รองรับความโปร่งใส จึงใช้สีที่ผสมกับพื้นขาวแล้ว)
const HOLIDAY_SHADE = { color: '#DC2626', opacity: 0.2, blended: 'F8D4D4' };

function buildDocModel(D) {
  const s = D.settings;
  const T = x => D.thaiDigits ? toThaiDigits(x ?? '') : String(x ?? '');
  // F(ค่า, ความกว้าง, เส้นประเพิ่มด้านหลัง, เส้นประเพิ่มด้านหน้า) หน่วย em
  const F = (val, w = 6, tail = 0, lead = 0) => ({ fill: T(val), w, tail, lead });
  const P = (runs, o = {}) => ({ t: 'p', runs: [].concat(runs), align: 'left', ml: 0, fi: 0, size: 16, bold: false, before: 0, after: 0, ...o });
  const BL = (size = 16) => P([], { size });
  const J = (runs, o = {}) => P(runs, { align: 'justify', fi: 72, ...o });

  const school = s.schoolName, name = s.fullName, pos = s.position;
  const amt = money(D.amount), amtText = bahtText(D.amount);
  const sections = [];

  // ---------------- ส่วนที่ 1: ใบส่งมอบงานจ้าง ----------------
  if (D.pages.includes('1')) {
    sections.push({ key: '1', title: 'ใบส่งมอบงานจ้าง', blocks: [
      { t: 'rcv', width: 176, lines: [
        ['รับเลขที่ ', F(D.rcv.no, 6.8)],
        ['ว.ด.ป. ', F(D.rcv.date, 7.4)],
        ['โรงเรียน ', F(D.rcv.school, 6.6)],
      ] },
      BL(),
      P('ใบส่งมอบงานจ้าง', { align: 'center', bold: true, size: 17 }),
      BL(),
      P(['เขียนที่โรงเรียน', F(school, 8)], { ml: 252 }),
      BL(),
      P(['วันที่ ', F('', 12)], { ml: 180, after: 12 }),
      P(['เรื่อง   ส่งมอบงานจ้างเหมาบริการ ตำแหน่ง', F(pos, 2, 3, 1)], { before: 12 }),
      P(['เรียน   ผู้อำนวยการโรงเรียน', F(school, 6)], { before: 6 }),
      P('สิ่งที่ส่งมาด้วย  สำเนาบัญชีลงเวลาการปฏิบัติงานของเจ้าหน้าที่จ้างเหมาบริการจำนวน ' + T(1) + ' ฉบับ', { before: 6, after: 6 }),
      J(['ตามที่ข้าพเจ้า ', F(name, 10), ' รับจ้างปฏิบัติงานตำแหน่ง ', F(pos, 7), ' ให้กับโรงเรียน', F(school, 7),
        ' โดยได้รับค่าจ้างเหมาบริการ เดือนละ', F(money(s.wage), 4), 'บาท (', F(bahtText(s.wage), 6), ') นั้น'], { after: 6 }),
      J(['ข้าพเจ้าขอส่งมอบงานที่ได้รับมอบหมาย สำหรับเดือน', F(D.monthName, 5), 'พ.ศ. ', F(D.yearBE, 3.5),
        'ตามแบบรายงานผลการปฏิบัติงานของเจ้าหน้าที่จ้างเหมาบริการ (ที่ส่งมาด้วย) และขอเบิกเงินค่าจ้างเหมาบริการ เป็นเงิน',
        F(amt, 5), 'บาท (', F(amtText, 8), ')'], { after: 6 }),
      P('จึงเรียนมาเพื่อโปรดดำเนินการ', { fi: 72, after: 12 }),
      BL(), BL(),
      P(['(ลงชื่อ)', F('', 11)], { ml: 200, align: 'center' }),
      P(['(', F(name, 11), ')'], { ml: 200, align: 'center' }),
      P(['ตำแหน่ง', F(pos, 8)], { ml: 200, align: 'center' }),
    ] });
  }

  // ---------------- ส่วนที่ 2: ใบตรวจรับงานจ้าง ----------------
  if (D.pages.includes('2')) {
    const sig = (role, who) => [
      P(['ลงชื่อ', F('', 11), role], { ml: 180 }),
      P(['     (', F(who, 11), ')'], { ml: 180 }),
    ];
    sections.push({ key: '2', title: 'ใบตรวจรับงานจ้าง', blocks: [
      P('ใบตรวจรับงานจ้าง', { align: 'center', bold: true, size: 17 }),
      J('ตามระเบียบกระทรวงการคลังว่าด้วยการจัดซื้อจัดจ้างและการบริหารพัสดุภาครัฐ พ.ศ. ๒๕๖๐ ข้อ 175'),
      P(['เขียนที่ โรงเรียน', F(school, 8)], { ml: 288 }),
      P(['วันที่', F('', 11)], { ml: 252 }),
      J(['ตามที่ โรงเรียน', F(school, 7), ' ได้จ้างเหมาบริการ ', F(name, 10), ' ตำแหน่ง ', F(pos, 7),
        ' ตามบันทึกข้อตกลงจ้าง เลขที่', F(s.contractNo, 5), ' ลงวันที่', F(s.contractDate, 8)]),
      J(['บัดนี้ คณะกรรมการตรวจรับพัสดุ ได้ตรวจรับงานจ้าง ประจำงวดเดือน', F(D.monthName, 5), ' พ.ศ. ', F(D.yearBE, 3.5),
        ' ณ โรงเรียน', F(school, 7), ' ซึ่ง ', F(name, 9),
        'ได้ส่งมอบงาน ตามแบบรายงานผลการปฏิบัติงาน เห็นว่าได้ทำงานเรียบร้อยถูกต้องครบถ้วนตามที่ตกลงกันไว้ และเบิกจ่ายเงินเป็นจำนวน',
        F(amt, 5), 'บาท (', F(amtText, 8), ')']),
      J(['ซึ่งผู้ตรวจรับพัสดุได้ตรวจรับถูกต้องครบถ้วนตามระเบียบฯ ข้อ 175 และคณะกรรมการตรวจรับพัสดุจึงลงลายมือชื่อไว้เป็นหลักฐาน และรายงานผลต่อผู้อำนวยการโรงเรียน',
        F(school, 7), ' เพื่อโปรดทราบ']),
      BL(),
      ...sig('ประธานกรรมการ', s.committeeChair), BL(),
      ...sig('กรรมการ', s.committee1), BL(),
      ...sig('กรรมการ', s.committee2),
      BL(),
      P([{ text: 'เรียน  ผู้อำนวยการโรงเรียน', b: true }, F(school, 7)]),
      J(['คณะกรรมการตรวจรับพัสดุได้ตรวจรับงานตามรายละเอียดดังกล่าวไว้ครบถ้วนถูกต้องแล้วซึ่งจะต้องจ่ายเงินให้แก่  (    ) ผู้ขาย   ( / ) ผู้รับจ้าง เป็นเงิน ',
        F(amt, 4), ' บาท บวก ภาษีมูลค่าเพิ่ม  -  บาท  หัก ภาษี ณ ที่จ่าย ', F(D.tax ? money(D.tax) : '-', 3),
        ' บาท  คงจ่ายจริง ', F(money(D.net), 4), ' บาท']),
      BL(),
      { t: 'cols', cols: [
        [P(['(ลงชื่อ)', F('', 8), 'เจ้าหน้าที่'], { align: 'center' }), P(['(', F(s.officerName, 9), ')'], { align: 'center' })],
        [P(['(ลงชื่อ)', F('', 8), 'หัวหน้าเจ้าหน้าที่'], { align: 'center' }), P(['(', F(s.headOfficerName, 9), ')'], { align: 'center' })],
      ] },
      BL(),
      P('( / )  ทราบ', { ml: 324 }),
      P('( / )  อนุมัติ', { ml: 324 }),
      BL(),
      P(['(ลงชื่อ)', F('', 11)], { ml: 200, align: 'center' }),
      P(['(', F(s.directorName, 11), ')'], { ml: 200, align: 'center' }),
      P(['ผู้อำนวยการโรงเรียน', F(school, 7)], { ml: 200, align: 'center' }),
    ] });
  }

  // ---------------- ส่วนที่ 3: แบบรายงานผลการปฏิบัติงาน ----------------
  if (D.pages.includes('3')) {
    const H = runs => P(runs, { align: 'center', bold: true, size: 17 });
    // หมายเหตุ: ลา = ลากิจ/ลาป่วย (+note), วันหยุดหรือวันที่ไม่ได้บันทึก = วันเสาร์/วันอาทิตย์ ถ้าเป็นวันธรรมดา = วันหยุด
    const remarkOf = d => {
      const withNote = label => label + (d.note ? ` (${d.note})` : '');
      if (d.status === 'work') return d.note;
      if (d.status === 'holiday') {
        const wd = parseYmd(d.date).getDay();
        return withNote(wd === 0 || wd === 6 ? 'วัน' + TH_DAYS[wd] : 'วันหยุด');
      }
      return withNote(STATUS[d.status].label);
    };
    const rows = D.rows.map(d => {
      const remark = remarkOf(d);
      // วันหยุด: รวม 4 เซลล์หลังวันที่ พื้นแดงโปร่ง ข้อความอยู่กลาง
      if (d.status === 'holiday') return [[T(fmtShort(d.date))], { span: 4, text: remark, shade: true }];
      return [
        [T(fmtShort(d.date))],
        d.items.map(i => '- ' + i.task),
        d.items.map(i => T([i.qty, i.unit].filter(x => x !== '' && x != null).join(' '))),
        [],
        remark ? [remark] : [],
      ];
    });
    sections.push({ key: '3', title: 'แบบรายงานผลการปฏิบัติงาน', blocks: [
      H(['แบบรายงานผลการปฏิบัติงานจ้างเหมาบริการ ตำแหน่ง', F(pos, 8)]),
      H(['ประจำเดือน', F(D.monthName, 6), ' พ.ศ. ', F(D.yearBE, 4)]),
      H(['ชื่อ', F(name, 12)]),
      H(['โรงเรียน', F(school, 10)]),
      BL(8),
      { t: 'table', widths: TABLE_COLS, size: 16,
        head: ['วัน/เดือน/ปี', 'รายละเอียดของงานที่ปฏิบัติ', 'ปริมาณงาน', 'ลงลายมือชื่อ', 'หมายเหตุ'],
        rows },
      // สรุป + ลายเซ็นอยู่หน้าเดียวกันเสมอ (ไม่ให้ลายเซ็นหลุดไปหน้าใหม่คนเดียว)
      { t: 'keep', blocks: [
        BL(),
        P(['สรุป ส่งมอบงานจ้าง จำนวน', F(D.workDays, 5), 'วัน']),
        P(['หมายเหตุ ', F(D.remark, 30)]),
        BL(), BL(),
        P(['ลงชื่อ', F('', 10), 'ผู้ควบคุมการปฏิบัติงาน'], { ml: 150 }),
        P(['       (', F(s.supervisorName, 10), ')'], { ml: 150 }),
      ] },
    ] });
  }

  return sections;
}

/**
 * จุดไข่ปลาสำหรับช่องว่าง และช่องว่างรอบค่าเพื่อให้เส้นใต้ยาวใกล้เคียง preview (ใช้ใน Word)
 * ใช้ช่องว่างปกติ (ไม่ใช่ non-breaking) เพื่อให้ตัดบรรทัดได้ ไม่เช่นนั้น Word จะกระจายตัวอักษรห่าง
 */
function fillText(run) {
  const w = run.w ?? 6, lead = run.lead || 0, tail = run.tail || 0;
  if (!run.fill) return { blank: true, text: '.'.repeat(Math.round((w + lead + tail) * 4)), pre: '', post: '', value: '' };
  const est = [...run.fill].filter(c => !/[ัิ-ฺ็-๎]/.test(c)).length * 0.45; // ไม่นับสระบน/ล่าง/วรรณยุกต์
  const pad = ' '.repeat(Math.max(1, Math.round((w - est) / 0.25 / 2)));
  const pre = pad + ' '.repeat(Math.round(lead / 0.25));
  // ปิดท้ายด้วย non-breaking space: Word ไม่ขีดเส้นใต้ช่องว่างท้ายย่อหน้า ช่องว่างหลังค่าจึงต้องไม่ใช่ตัวสุดท้าย
  const post = pad.slice(1) + ' '.repeat(Math.round(tail / 0.25)) + ' ';
  return { blank: false, text: pre + run.fill + post, pre, post, value: run.fill };
}

/** ชื่อไฟล์ เช่น รายงาน-ตุลาคม2569-นางสาวสมใจ_ใจดี */
function reportFileName(D) {
  const who = (D.settings.fullName || 'ไม่ระบุชื่อ').replace(/\s+/g, '_').replace(/[\\/:*?"<>|]/g, '');
  return `รายงาน-${D.monthName}${D.yearBE}-${who}`;
}
