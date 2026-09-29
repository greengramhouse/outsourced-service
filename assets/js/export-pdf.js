// ส่งออก PDF จากโมเดลเอกสาร — ใช้ pdfmake 0.2.7 + ฟอนต์ TH Sarabun New (โหลดจาก URL ใน config.js)
//
// ปัญหาการตัดบรรทัดภาษาไทย: pdfmake ตัดบรรทัดได้เฉพาะที่ช่องว่าง/zero-width space (U+200B)
// จึงใช้ thaiBreak() (thai.js) แทรก U+200B ระหว่างคำ
// แต่ฟอนต์ TH Sarabun New ไม่มี U+200B (จะขึ้นเป็นกล่อง □) จึงแก้ตาราง cmap ของฟอนต์ในหน่วยความจำ
// ให้ U+200B ชี้ไปที่ glyph ว่างความกว้าง 0 (ไฟล์ฟอนต์ต้นฉบับไม่ถูกแก้)

/**
 * แก้ cmap (format 4) ให้ U+200B ใช้ glyph เดียวกับ U+200C (zero width non-joiner, กว้าง 0)
 * ใช้ได้เมื่อ segment ที่เริ่มที่ U+200C ใช้ idDelta และ U+200B ยังว่างอยู่ (ตรงกับ TH Sarabun New)
 */
function patchFontZwsp(buffer) {
  const dv = new DataView(buffer);
  const numTables = dv.getUint16(4);
  let cmap = -1;
  for (let i = 0; i < numTables; i++) {
    const o = 12 + i * 16;
    const tag = String.fromCharCode(dv.getUint8(o), dv.getUint8(o + 1), dv.getUint8(o + 2), dv.getUint8(o + 3));
    if (tag === 'cmap') cmap = dv.getUint32(o + 8);
  }
  if (cmap < 0) return false;
  let ok = false;
  const nSub = dv.getUint16(cmap + 2);
  for (let i = 0; i < nSub; i++) {
    const b = cmap + dv.getUint32(cmap + 4 + i * 8 + 4);
    if (dv.getUint16(b) !== 4) continue;
    const segX2 = dv.getUint16(b + 6);
    const endO = b + 14, startO = endO + segX2 + 2, deltaO = startO + segX2, roO = deltaO + segX2;
    for (let s = 0; s < segX2 / 2; s++) {
      const start = dv.getUint16(startO + 2 * s), end = dv.getUint16(endO + 2 * s);
      if (start <= 0x200B && end >= 0x200B) { ok = true; break; }   // มีอยู่แล้ว
      if (start === 0x200C && dv.getUint16(roO + 2 * s) === 0 && (s === 0 || dv.getUint16(endO + 2 * s - 2) < 0x200B)) {
        dv.setUint16(startO + 2 * s, 0x200B);
        dv.setInt16(deltaO + 2 * s, dv.getInt16(deltaO + 2 * s) + 1);
        ok = true;
        break;
      }
    }
  }
  return ok;
}

function arrayBufferToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

/** โหลดฟอนต์จาก URL ครั้งเดียว แก้ U+200B แล้วเก็บใน vfs ของ pdfmake */
let pdfFontsReady = null;
function loadPdfFonts() {
  if (pdfFontsReady) return pdfFontsReady;
  pdfFontsReady = (async () => {
    const src = (window.APP_CONFIG && APP_CONFIG.PDF_FONTS) || {};
    const vfs = {}, fonts = {};
    for (const [family, styles] of Object.entries(src)) {
      fonts[family] = {};
      for (const [style, url] of Object.entries(styles)) {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`โหลดฟอนต์ไม่สำเร็จ (${res.status}): ${url}`);
        const buf = await res.arrayBuffer();
        if (!patchFontZwsp(buf)) console.warn('ฟอนต์นี้แก้ U+200B ไม่ได้ การตัดคำไทยอาจไม่สวย:', url);
        const name = `${family}-${style}.ttf`;
        vfs[name] = arrayBufferToBase64(buf);
        fonts[family][style] = name;
      }
      // pdfmake ต้องมีครบ 4 แบบ ใช้ normal/bold แทนตัวเอียง
      fonts[family].italics = fonts[family].italics || fonts[family].normal;
      fonts[family].bolditalics = fonts[family].bolditalics || fonts[family].bold || fonts[family].normal;
      fonts[family].bold = fonts[family].bold || fonts[family].normal;
    }
    return { vfs, fonts };
  })();
  pdfFontsReady.catch(() => { pdfFontsReady = null; }); // ให้ลองใหม่ได้ถ้าโหลดพลาด
  return pdfFontsReady;
}

function buildPdfDefinition(sections) {
  const FONT = 'THSarabunNew';

  const runs = (list, bold) => list.map(r => {
    if (typeof r === 'string') return { text: thaiBreak(r), bold };
    if (r.b) return { text: thaiBreak(r.text), bold: true };
    const f = fillText(r);
    return f.blank
      ? { text: f.text, bold }
      : { text: f.pad + thaiBreak(f.value) + f.pad, bold, decoration: 'underline', decorationStyle: 'dotted' };
  });

  // justify ของ pdfmake กระจายช่องว่างระหว่างคำไทยจนห่างผิดธรรมชาติ จึงใช้ชิดซ้ายแทนใน PDF
  const align = a => a === 'justify' ? 'left' : a;

  const para = b => ({
    text: b.runs.length ? runs(b.runs, b.bold) : ' ',
    fontSize: b.size,
    bold: b.bold,
    alignment: align(b.align),
    leadingIndent: b.fi || 0,
    margin: [b.ml, b.before, 0, b.after],
  });

  const block = b => {
    switch (b.t) {
      case 'p': return para(b);
      case 'rcv': return {
        columns: [
          { width: '*', text: '' },
          { width: b.width, table: { widths: ['*'], body: [[{ stack: b.lines.map(l => para({ runs: l, align: 'left', ml: 0, fi: 0, size: 16, bold: false, before: 0, after: 0 })), margin: [2, 0, 2, 0] }]] } },
        ],
      };
      case 'keep': return { stack: b.blocks.map(block).filter(Boolean), unbreakable: true };
      case 'cols': return { columns: b.cols.map(c => ({ width: '*', stack: c.map(block) })) };
      case 'table': {
        const total = b.widths.reduce((a, c) => a + c, 0);
        const widths = b.widths.map(w => w / total * PAGE.textWidth - 8); // หักระยะ padding ซ้าย-ขวา
        const cell = lines => ({ stack: (lines.length ? lines : [' ']).map(l => ({ text: thaiBreak(l) })), fontSize: b.size });
        const body = [b.head.map(h => ({ text: h, bold: true, alignment: 'center', fontSize: b.size }))];
        // เซลล์รวม (วันหยุด): colSpan + พื้นแดงโปร่ง + ข้อความกลาง (pdfmake ต้องมีเซลล์ว่างแทนที่คอลัมน์ที่ถูกรวม)
        const spanCell = c => [
          { text: thaiBreak(c.text), colSpan: c.span, alignment: 'center', fontSize: b.size,
            ...(c.shade ? { fillColor: HOLIDAY_SHADE.color, fillOpacity: HOLIDAY_SHADE.opacity } : {}) },
          ...Array(c.span - 1).fill({}),
        ];
        if (b.rows.length) b.rows.forEach(r => body.push(r.flatMap(c => Array.isArray(c) ? [cell(c)] : spanCell(c))));
        else body.push(b.head.map(() => ({ text: ' ' })));
        return {
          table: { headerRows: 1, widths, body },
          layout: { hLineWidth: () => 0.6, vLineWidth: () => 0.6, paddingLeft: () => 4, paddingRight: () => 4, paddingTop: () => 0, paddingBottom: () => 1 },
        };
      }
      default: return null;
    }
  };

  const content = [];
  sections.forEach((s, i) => {
    const blocks = s.blocks.map(block).filter(Boolean);
    if (i > 0 && blocks.length) blocks[0].pageBreak = 'before';
    content.push(...blocks);
  });

  const m = PAGE.margin;
  return {
    pageSize: 'A4',
    pageMargins: [m.left, m.top, m.right, m.bottom],
    info: { title: 'รายงานผลการปฏิบัติงาน', creator: 'บันทึกงานธุรการ' },
    defaultStyle: { font: FONT, fontSize: 16, lineHeight: 0.85 },
    content,
  };
}

async function exportPdf(sections, name, openInTab = false) {
  if (!window.pdfMake) throw new Error('โหลดไลบรารี pdfmake ไม่สำเร็จ — ตรวจอินเทอร์เน็ตแล้วรีเฟรชหน้า');
  const win = openInTab ? window.open('', '_blank') : null; // เปิดแท็บก่อน await เพื่อไม่ให้ถูก popup blocker
  try {
    const { vfs, fonts } = await loadPdfFonts();
    const pdf = pdfMake.createPdf(buildPdfDefinition(sections), null, fonts, vfs);
    if (openInTab) {
      const blob = await new Promise(res => pdf.getBlob(res));
      if (win) win.location.href = URL.createObjectURL(blob);
      else downloadBlob(blob, name + '.pdf');
    } else {
      await new Promise(res => pdf.download(name + '.pdf', res));
    }
  } catch (err) {
    if (win) win.close();
    throw err;
  }
}
