// ไอคอน, toast, modal ยืนยัน, สถานะปุ่มระหว่างรอ

const ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  pen: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  cal: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  left: '<path d="m15 18-6-6 6-6"/>',
  right: '<path d="m9 18 6-6-6-6"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-2.6-6.4L21 8"/><path d="M21 3v5h-5"/>',
  alert: '<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
};

const icon = (n, cls = 'h-4 w-4') =>
  `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n]}</svg>`;

function paintIcons(root = document) {
  root.querySelectorAll('[data-ico]').forEach(el => { el.innerHTML = icon(el.dataset.ico, el.dataset.icoCls || 'h-4 w-4'); });
}

const $ = sel => document.querySelector(sel);
const $$ = sel => [...document.querySelectorAll(sel)];

let toastTimer;
function toast(msg, type = 'ok') {
  const t = $('#toast');
  t.textContent = msg;
  t.className = t.className.replace(/bg-\S+/g, '') + (type === 'error' ? ' bg-rose-600' : ' bg-slate-900');
  t.style.opacity = 1;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.style.opacity = 0, type === 'error' ? 5000 : 2400);
}

let modalResolve;
function confirmBox(title, text, okLabel = 'ยืนยัน') {
  $('#modalTitle').textContent = title;
  $('#modalText').textContent = text;
  $('#modalOk').textContent = okLabel;
  $('#modal').classList.remove('hidden');
  $('#modalOk').focus();
  return new Promise(res => modalResolve = res);
}
function closeModal(v) {
  $('#modal').classList.add('hidden');
  if (modalResolve) { modalResolve(v); modalResolve = null; }
}
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#modal').classList.contains('hidden')) closeModal(false); });

/** ปิดปุ่มระหว่างรอ และแสดง toast เมื่อผิดพลาด คืนค่า true ถ้าสำเร็จ */
async function withBusy(btn, fn) {
  if (btn && btn.disabled) return false;
  const html = btn ? btn.innerHTML : '';
  if (btn) { btn.disabled = true; btn.classList.add('opacity-60', 'cursor-wait'); btn.innerHTML = '<span class="spinner"></span>' + btn.textContent.trim(); }
  try {
    await fn();
    return true;
  } catch (err) {
    console.error(err);
    toast(err.message || String(err), 'error');
    return false;
  } finally {
    if (btn) { btn.disabled = false; btn.classList.remove('opacity-60', 'cursor-wait'); btn.innerHTML = html; }
  }
}

function downloadBlob(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
