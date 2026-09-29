// ตำแหน่งที่บันทึกงาน — แต่ละตำแหน่งใช้ Google Sheet + Apps Script ของตัวเอง (ข้อมูลแยกกันเด็ดขาด)
// API_URL = URL ของ Apps Script Web App (ลงท้ายด้วย /exec)
// ถ้าเว้นว่าง ตำแหน่งนั้นจะใช้โหมดทดลองที่เก็บข้อมูลในเบราว์เซอร์ หรือกรอก URL ในหน้าตั้งค่าแทนก็ได้
window.APP_CONFIG = {
  PROFILES: [
    {
      id: 'admin',
      label: 'ธุรการ',
      API_URL: 'https://script.google.com/macros/s/AKfycbyNKYCaeGDUFBz7N_8cnkoqrg9PIy13_0XXakIbgC_PzChTv8-lp6QmoJTIb-ML4JIr/exec',
    },
    {
      id: 'janitor',
      label: 'นักการภารโรง',
      API_URL: 'https://script.google.com/macros/s/AKfycbwvUVHwPv3kvdO4xxBKqjBwhQ47Cy09GLCiF4nv6J-ZOxhKrITK2ydmyakpJKoPEJL7Sg/exec', // ใส่ URL ของ Apps Script ตัวที่ 2 (Sheet ของนักการภารโรง)
    },
    {
      id: 'nanny',
      label: 'เลี้ยงเด็กพิการ',
      API_URL: 'https://script.google.com/macros/s/AKfycbxHZzmLQuZn8ZyEOBqOdOIdslIcfdnesmqRo-4WWDcodGG8vijflQOK2mCebc8DkRDW8Q/exec', // ใส่ URL ของ Apps Script ตัวที่ 3 (Sheet ของพี่เลี้ยงเด็กพิการ) ห้ามใช้ URL ซ้ำกับตำแหน่งอื่น
    },
  ],

  // ฟอนต์สำหรับ PDF (pdfmake โหลดจาก URL) — เก็บไฟล์ไว้ใน fonts/ ของ repo เอง
  // (https://guykorat.github.io/font/... ตอบ 404 แล้ว จึงไม่ใช้)
  PDF_FONTS: {
    THSarabunNew: {
      normal: new URL('fonts/THSarabunNew.ttf', document.baseURI).href,
      bold: new URL('fonts/THSarabunNew-Bold.ttf', document.baseURI).href,
    },
  },

  // ฟอนต์ที่ไฟล์ Word อ้างถึง (ต้องติดตั้งในเครื่องที่เปิดไฟล์)
  DOCX_FONT: 'TH SarabunPSK',
};
