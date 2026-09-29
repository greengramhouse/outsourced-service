// ส่งออก Word (.docx) จากโมเดลเอกสาร — ใช้ไลบรารี docx (global: docx)

function buildDocx(sections) {
  const {
    Document, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType,
    BorderStyle, UnderlineType, TableLayoutType, VerticalAlign, ShadingType,
  } = docx;

  const FONT = (window.APP_CONFIG && APP_CONFIG.DOCX_FONT) || 'TH SarabunPSK';
  const tw = pt => Math.round(pt * 20);
  const ALIGN = { left: AlignmentType.LEFT, center: AlignmentType.CENTER, right: AlignmentType.RIGHT, justify: AlignmentType.THAI_DISTRIBUTE };
  const textW = tw(PAGE.textWidth);

  // thaiBreak แทรก U+200B ระหว่างคำ ให้ Word ตัดบรรทัดตรงรอยคำ (Word ไม่แสดงอักขระนี้)
  const runs = (list, size, bold) => list.map(r => {
    const base = { size: size * 2, bold };
    if (typeof r === 'string') return new TextRun({ ...base, text: thaiBreak(r) });
    if (r.b) return new TextRun({ ...base, text: thaiBreak(r.text), bold: true });
    const f = fillText(r);
    if (f.blank) return new TextRun({ ...base, text: f.text });
    return new TextRun({ ...base, text: f.pad + thaiBreak(f.value) + f.pad, underline: { type: UnderlineType.DOTTED } });
  });

  const para = b => new Paragraph({
    alignment: ALIGN[b.align] || AlignmentType.LEFT,
    keepNext: !!b.keepNext,
    keepLines: true,
    indent: { left: tw(b.ml), firstLine: tw(b.fi) },
    spacing: { before: tw(b.before), after: tw(b.after) },
    children: b.runs.length ? runs(b.runs, b.size, b.bold) : [new TextRun({ text: '', size: b.size * 2 })],
  });

  const NONE = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
  const LINE = { style: BorderStyle.SINGLE, size: 6, color: '000000' };
  const borders = x => ({ top: x, bottom: x, left: x, right: x, insideHorizontal: x, insideVertical: x });
  const cellBorders = x => ({ top: x, bottom: x, left: x, right: x });

  const block = b => {
    switch (b.t) {
      case 'p': return [para(b)];

      // keepNext ทุกย่อหน้ายกเว้นย่อหน้าสุดท้าย ให้ Word ย้ายทั้งกลุ่มไปหน้าเดียวกัน
      case 'keep': return b.blocks.map((x, i, arr) => para({ ...x, keepNext: i < arr.length - 1 }));

      case 'rcv': {
        const w = tw(b.width);
        return [new Table({
          alignment: AlignmentType.RIGHT,
          width: { size: w, type: WidthType.DXA },
          columnWidths: [w],
          layout: TableLayoutType.FIXED,
          borders: borders(LINE),
          rows: [new TableRow({ children: [new TableCell({
            width: { size: w, type: WidthType.DXA },
            margins: { left: 100, right: 100, top: 20, bottom: 20 },
            children: b.lines.map(l => para({ runs: l, align: 'left', ml: 0, fi: 0, size: 16, bold: false, before: 0, after: 0 })),
          })] })],
        })];
      }

      case 'cols': {
        const w = Math.floor(textW / b.cols.length);
        return [new Table({
          width: { size: w * b.cols.length, type: WidthType.DXA },
          columnWidths: b.cols.map(() => w),
          layout: TableLayoutType.FIXED,
          borders: borders(NONE),
          rows: [new TableRow({ children: b.cols.map(c => new TableCell({
            width: { size: w, type: WidthType.DXA },
            borders: cellBorders(NONE),
            children: c.flatMap(block),
          })) })],
        })];
      }

      case 'table': {
        const total = b.widths.reduce((a, c) => a + c, 0);
        const cell = (lines, opts = {}) => new TableCell({
          width: { size: b.widths[opts.i], type: WidthType.DXA },
          margins: { left: 80, right: 80, top: 0, bottom: 0 },
          verticalAlign: opts.head ? VerticalAlign.CENTER : VerticalAlign.TOP,
          children: (lines.length ? lines : ['']).map(l => new Paragraph({
            alignment: opts.head ? AlignmentType.CENTER : AlignmentType.LEFT,
            children: [new TextRun({ text: thaiBreak(l), size: b.size * 2, bold: !!opts.head })],
          })),
        });
        const rows = [new TableRow({ tableHeader: true, children: b.head.map((h, i) => cell([h], { head: true, i })) })];
        if (b.rows.length) {
          b.rows.forEach(r => {
            let col = 0;
            const children = r.map(c => {
              if (Array.isArray(c)) return cell(c, { i: col++ });
              // เซลล์รวม (วันหยุด): columnSpan + พื้นแดงโปร่ง + ข้อความกลางเซลล์
              const w = b.widths.slice(col, col + c.span).reduce((a, x) => a + x, 0);
              col += c.span;
              return new TableCell({
                columnSpan: c.span,
                width: { size: w, type: WidthType.DXA },
                margins: { left: 80, right: 80, top: 0, bottom: 0 },
                verticalAlign: VerticalAlign.CENTER,
                shading: c.shade ? { type: ShadingType.CLEAR, color: 'auto', fill: HOLIDAY_SHADE.blended } : undefined,
                children: [new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: thaiBreak(c.text), size: b.size * 2 })],
                })],
              });
            });
            rows.push(new TableRow({ children }));
          });
        } else {
          rows.push(new TableRow({ children: b.head.map((_, i) => cell([''], { i })) }));
        }
        return [new Table({
          width: { size: total, type: WidthType.DXA },
          columnWidths: b.widths,
          layout: TableLayoutType.FIXED,
          borders: borders(LINE),
          rows,
        })];
      }
      default: return [];
    }
  };

  const m = PAGE.margin;
  return new Document({
    creator: 'บันทึกงานธุรการ',
    title: 'รายงานผลการปฏิบัติงาน',
    styles: {
      default: {
        document: {
          // language เหมือน Formdoc.docx ให้ Word ตัดคำไทยด้วยพจนานุกรม
          // noProof: ไม่ตรวจคำสะกด (ชื่อคน/โรงเรียน/จุดไข่ปลา/U+200B ทำให้ขึ้นเส้นหยักแดงทั้งเอกสาร)
          run: { font: { ascii: FONT, hAnsi: FONT, cs: FONT, eastAsia: FONT }, size: 32, noProof: true, language: { value: 'en-US', eastAsia: 'en-US', bidirectional: 'th-TH' } },
          paragraph: { spacing: { before: 0, after: 0, line: 240 } },
        },
      },
    },
    sections: sections.map(s => ({
      properties: {
        page: {
          size: { width: tw(PAGE.width), height: tw(PAGE.height) },
          margin: { top: tw(m.top), right: tw(m.right), bottom: tw(m.bottom), left: tw(m.left), header: 706, footer: 706 },
        },
      },
      children: s.blocks.flatMap(block),
    })),
  });
}

async function exportDocx(sections, name) {
  if (!window.docx) throw new Error('โหลดไลบรารี docx ไม่สำเร็จ — ตรวจอินเทอร์เน็ตแล้วรีเฟรชหน้า');
  const blob = await docx.Packer.toBlob(buildDocx(sections));
  downloadBlob(blob, name + '.docx');
}
