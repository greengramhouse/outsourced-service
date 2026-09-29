// สถานะหลัก, เมนู/เราเตอร์, หน้าหลัก, และการเริ่มระบบ

const STATUS = {
  work:     { label: 'ปฏิบัติงาน', dot: 'bg-emerald-500', chip: 'bg-emerald-50 text-emerald-700', cell: 'bg-emerald-50/70 border-emerald-200' },
  personal: { label: 'ลากิจ',     dot: 'bg-amber-500',   chip: 'bg-amber-50 text-amber-700',     cell: 'bg-amber-50 border-amber-200' },
  sick:     { label: 'ลาป่วย',    dot: 'bg-rose-500',    chip: 'bg-rose-50 text-rose-700',       cell: 'bg-rose-50 border-rose-200' },
  holiday:  { label: 'วันหยุด',   dot: 'bg-slate-400',   chip: 'bg-slate-100 text-slate-600',    cell: 'bg-slate-50 border-slate-200' },
};

const PAGES = [
  { id: 'dashboard', label: 'หน้าหลัก', ico: 'home' },
  { id: 'record', label: 'บันทึกงาน', ico: 'pen' },
  { id: 'calendar', label: 'ปฏิทิน', ico: 'cal' },
  { id: 'report', label: 'รายงาน', ico: 'file' },
  { id: 'settings', label: 'ตั้งค่า', ico: 'gear' },
];

const RENDER = {}; // id -> async function ที่แต่ละไฟล์หน้าลงทะเบียนไว้
let currentPage = null;

function buildNav() {
  $('#sideNav').innerHTML = PAGES.map(p =>
    `<a href="#${p.id}" class="nav-btn w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-slate-600 hover:bg-slate-50 font-medium" data-page="${p.id}">${icon(p.ico, 'h-5 w-5 text-slate-400')}${p.label}</a>`).join('');
  $('#mobileNav').innerHTML = PAGES.map(p =>
    `<a href="#${p.id}" class="mnav-btn flex flex-col items-center gap-0.5 py-2 text-[11px] text-slate-500" data-page="${p.id}"><span class="mnav-ico rounded-full px-4 py-1">${icon(p.ico, 'h-5 w-5')}</span>${p.label}</a>`).join('');
}

function go(id) {
  if (location.hash === '#' + id) route(); else location.hash = id;
}

async function route() {
  const id = (location.hash || '#dashboard').slice(1).split('?')[0];
  const page = PAGES.find(p => p.id === id) ? id : 'dashboard';
  currentPage = page;
  $$('.page').forEach(s => s.classList.toggle('active', s.id === 'page-' + page));
  $$('[data-page]').forEach(b => b.classList.toggle('active', b.dataset.page === page));
  $('#mobileTitle').textContent = PAGES.find(p => p.id === page).label;
  window.scrollTo({ top: 0 });
  try {
    await RENDER[page]();
  } catch (err) {
    console.error(err);
    toast(err.message || String(err), 'error');
  }
}

function bindCommon() {
  const s = Store.settings;
  const set = (k, v) => $$(`[data-bind="${k}"]`).forEach(el => el.textContent = v);
  set('schoolFull', 'โรงเรียน' + (s.schoolName || ''));
  set('fullName', s.fullName || 'ยังไม่ได้ตั้งชื่อ');
  set('position', s.position || '');
  const first = (s.fullName || '').replace(/^(นางสาว|นาง|นาย|น\.ส\.)\s*/, '').split(/\s+/)[0];
  set('firstName', first || '');
  set('profileLabel', Profile.get().label);
  $('#modeBanner').classList.toggle('hidden', !API.isLocal());
  document.documentElement.dataset.profile = Profile.get().id;
}

/* ---------------- สลับตำแหน่ง (ธุรการ / นักการภารโรง) ---------------- */
function renderProfileSwitch() {
  const list = Profile.list();
  $$('.profile-switch').forEach(box => {
    box.classList.toggle('hidden', list.length < 2);
    box.style.gridTemplateColumns = `repeat(${list.length}, minmax(0, 1fr))`;
    box.innerHTML = list.map(p =>
      `<button type="button" class="rounded-lg px-2 py-1.5 text-sm font-medium truncate ${p.id === Profile.currentId ? 'active' : 'text-slate-500'}" onclick="switchProfile('${p.id}')">${esc(p.label)}</button>`).join('');
  });
}

async function switchProfile(id) {
  if (id === Profile.currentId) return;
  const appVisible = !$('#app').classList.contains('hidden');
  if (appVisible && currentPage === 'record' && Record.dirty &&
      !(await confirmBox('ยังไม่ได้บันทึก', 'มีการแก้ไขที่ยังไม่ได้บันทึก ต้องการสลับตำแหน่งโดยไม่บันทึกหรือไม่?', 'สลับ'))) return;
  Profile.set(id);
  Store.reset();
  Record.dirty = false;
  // ค่าในฟอร์มรายงานเป็นของอีกคน ล้างให้เติมค่าเริ่มต้นของตำแหน่งใหม่
  ['#rpAmount', '#rpRemark', '#rpRcvNo', '#rpRcvDate'].forEach(s => $(s).value = '');
  delete $('#rpRcvSchool').dataset.touched;
  if (new URLSearchParams(location.search).has('staff')) history.replaceState(null, '', location.pathname + location.hash);
  if (!appVisible) return boot();
  renderProfileSwitch();
  $('#app').classList.add('opacity-60', 'pointer-events-none');
  try {
    await Store.init();
    bindCommon();
    await route();
    toast('กำลังบันทึกของ: ' + Profile.get().label);
  } catch (err) {
    console.error(err);
    showBootError(err);
  } finally {
    $('#app').classList.remove('opacity-60', 'pointer-events-none');
  }
}

/* ---------------- หน้าหลัก ---------------- */
RENDER.dashboard = async function () {
  bindCommon();
  const TODAY = todayStr(), now = new Date();
  const from = monthStart(now.getFullYear(), now.getMonth()), to = monthEnd(now.getFullYear(), now.getMonth());
  const prevFrom = monthStart(now.getFullYear(), now.getMonth() - 1);
  $('#dashToday').textContent = fmtLong(TODAY);
  $('#dashMonth').textContent = `${TH_MONTHS[now.getMonth()]} ${now.getFullYear() + 543}`;

  await Store.ensureRange(prevFrom, to);
  if (currentPage !== 'dashboard') return;

  const list = Store.daysIn(from, to);
  const work = list.filter(d => d.status === 'work');
  const leave = list.filter(d => d.status === 'personal' || d.status === 'sick');
  const tasks = work.reduce((n, d) => n + d.items.length, 0);
  const missing = TODAY > from ? Store.missingWeekdays(from, addDays(TODAY, -1)) : [];

  const td = Store.days[TODAY];
  $('#dashTodayStatus').textContent = td
    ? `วันนี้บันทึกแล้ว: ${STATUS[td.status].label}${td.items.length ? ` · ${td.items.length} รายการ` : ''}`
    : 'วันนี้ยังไม่ได้บันทึกการทำงาน';

  const stat = (label, val, sub, color) => `
    <div class="card p-4">
      <div class="flex items-center gap-2 text-xs text-slate-500"><span class="h-2 w-2 rounded-full ${color}"></span>${label}</div>
      <div class="text-3xl font-semibold mt-2">${val}</div>
      <div class="text-xs text-slate-400 mt-0.5">${sub}</div>
    </div>`;
  $('#dashStats').innerHTML =
    stat('วันปฏิบัติงาน', work.length, 'วัน (ใช้ในรายงาน)', 'bg-emerald-500') +
    stat('วันลา', leave.length, 'ลากิจ + ลาป่วย', 'bg-amber-500') +
    stat('รายการงาน', tasks, 'รายการในเดือนนี้', 'bg-teal-500') +
    stat('ยังไม่บันทึก', missing.length, 'วันทำการที่ผ่านมา', 'bg-rose-500');

  const recent = Store.daysIn(prevFrom, to).slice(-5).reverse();
  $('#dashRecent').innerHTML = recent.map(d => {
    const dt = parseYmd(d.date);
    return `
    <button type="button" onclick="Record.open('${d.date}')" class="w-full text-left py-3 flex gap-3 items-start hover:bg-slate-50 rounded-lg px-2 -mx-2">
      <div class="w-12 shrink-0 text-center rounded-lg bg-emerald-50 py-1">
        <div class="text-lg font-semibold text-emerald-700 leading-none">${dt.getDate()}</div>
        <div class="text-[10px] text-emerald-600">${TH_MON_S[dt.getMonth()]}</div>
      </div>
      <div class="min-w-0 flex-1">
        <span class="text-[11px] rounded-full px-2 py-0.5 ${STATUS[d.status].chip}">${STATUS[d.status].label}</span>
        <div class="text-sm text-slate-600 truncate mt-1">${d.items.length ? d.items.map(i => esc(i.task)).join(' · ') : esc(d.note) || '-'}</div>
      </div>
    </button>`;
  }).join('') || '<p class="text-sm text-slate-400 py-4">ยังไม่มีบันทึก เริ่มบันทึกวันแรกได้เลย</p>';

  $('#dashMissing').innerHTML = missing.length
    ? missing.map(s => `<button type="button" onclick="Record.open('${s}')" class="text-sm rounded-lg px-3 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100">${fmtShort(s)}</button>`).join('')
    : '<p class="text-sm text-emerald-700">บันทึกครบทุกวันทำการแล้ว</p>';
};

/* ---------------- เริ่มระบบ ---------------- */
async function boot() {
  if (!Profile.currentId) Profile.init();
  paintIcons();
  buildNav();
  renderProfileSwitch();
  $('#app').classList.add('hidden');
  $('#bootError').classList.add('hidden');
  $('#bootLoading').classList.remove('hidden');
  try {
    await Store.init();
    $('#bootLoading').classList.add('hidden');
    $('#app').classList.remove('hidden');
    bindCommon();
    if (!window.__routeBound) { window.addEventListener('hashchange', route); window.__routeBound = true; }
    if (!Store.settings.fullName && !location.hash) location.hash = 'settings';
    route();
  } catch (err) {
    console.error(err);
    showBootError(err);
  }
}

function showBootError(err) {
  $('#bootLoading').classList.add('hidden');
  $('#app').classList.add('hidden');
  $('#bootError').classList.remove('hidden');
  $('#bootErrorText').textContent = `[${Profile.get().label}] ` + (err.message || String(err));
  $('#bootApiUrl').value = API.url();
  renderProfileSwitch();
}

async function bootFixUrl(btn) {
  const url = $('#bootApiUrl').value.trim();
  await withBusy(btn, async () => {
    if (url) await API.ping(url);
    API.setUrl(url);
    Store.reset();
    await boot();
  });
}

document.addEventListener('DOMContentLoaded', boot);
