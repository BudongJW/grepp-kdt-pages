/* ══════════════════════════════════════════════════════════════════════
   그렙 KDT 대시보드 – 프론트엔드
   ══════════════════════════════════════════════════════════════════════ */

const WORKER_URL = 'https://grepp-kdt-worker.dlawodnjs.workers.dev';

// ─── 유틸 ────────────────────────────────────────────────────────────
function fmtDate(s) {
  if (!s || s.length < 8) return '-';
  return `${s.slice(0, 4)}.${s.slice(4, 6)}.${s.slice(6, 8)}`;
}
function fmtNum(v, d = 1) {
  return v != null ? Number(v).toFixed(d) : null;
}
function cls(v, good = 80, warn = 60) {
  if (v == null) return 'na';
  return v >= good ? 'good' : v >= warn ? 'warn' : 'bad';
}
function mt(v, unit = '') {
  return v != null ? `${fmtNum(v)}${unit}` : '-';
}
function fmtStatus(s) {
  switch (s) {
    case 'in_progress': return '진행중';
    case 'pending_stats': return '집계대기';
    case 'no_stats': return '통계없음';
    default: return '완료';
  }
}

// ─── 과정명 정규화 ───────────────────────────────────────────────────
function normName(name) {
  if (!name) return '기타';
  const m1 = name.match(/데브코스[:\s]+(.+)/);
  if (m1) return m1[1].trim().replace(/\s*(모집.*|마감.*)$/, '');
  const m2 = name.match(/K-Digital Training[:\s]+(.+)/i);
  if (m2) return m2[1].trim();
  return name.replace(/\s*\d+기\s*$/, '').trim();
}

// ─── 그룹화 ──────────────────────────────────────────────────────────
function groupBy(courses) {
  const map = new Map();
  for (const c of courses) {
    const key = normName(c.courseName);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(c);
  }
  for (const [, arr] of map) arr.sort((a, b) => (b.cohort || 0) - (a.cohort || 0));
  return new Map([...map.entries()].sort((a, b) => b[1].length - a[1].length));
}

function avg(arr, key) {
  const vals = arr.map(c => c[key]).filter(v => v != null);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

// ─── 상태 ────────────────────────────────────────────────────────────
let allCourses = [];

// ─── 데이터 로드 ─────────────────────────────────────────────────────
async function loadData() {
  const loadEl = document.getElementById('loading');
  const errEl = document.getElementById('error');
  const mainEl = document.getElementById('main');

  try {
    const res = await fetch(`${WORKER_URL}/api/courses`);
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      throw new Error(e.error || `HTTP ${res.status}`);
    }
    const data = await res.json();
    allCourses = data.courses || [];

    const badge = document.getElementById('badge');
    badge.textContent = data.source === 'openapi' ? '고용24 Open API' : '고용24 크롤링';
    badge.classList.remove('loading');

    if (data.updatedAt) {
      const d = new Date(data.updatedAt);
      document.getElementById('updated').textContent =
        `갱신: ${d.toLocaleDateString('ko-KR')} ${d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`;
    }

    render();
    loadEl.style.display = 'none';
    mainEl.style.display = 'flex';
  } catch (e) {
    loadEl.style.display = 'none';
    errEl.textContent = `데이터를 불러오지 못했습니다: ${e.message}`;
    errEl.style.display = 'block';
  }
}

// ─── 렌더 ────────────────────────────────────────────────────────────
function render() {
  renderKPI();
  renderCourseList();
}

// ─── KPI ─────────────────────────────────────────────────────────────
function renderKPI() {
  const groups = groupBy(allCourses);
  document.getElementById('kpiCourses').textContent = groups.size;
  document.getElementById('kpiCohorts').textContent = allCourses.length;

  const totalTrainees = allCourses.reduce((s, c) => s + (c.totalTrainees || 0), 0);
  document.getElementById('kpiTrainees').textContent = totalTrainees ? totalTrainees.toLocaleString() + '명' : '-';

  const sat = avg(allCourses, 'satisfaction');
  document.getElementById('kpiSat').textContent = sat != null ? fmtNum(sat) + '점' : '-';

  const comp = avg(allCourses, 'completionRate');
  document.getElementById('kpiComp').textContent = comp != null ? fmtNum(comp) + '%' : '-';
}

// ─── 과정별 드롭다운 리스트 ──────────────────────────────────────────
function renderCourseList() {
  const container = document.getElementById('courseList');
  const groups = groupBy(allCourses);
  container.innerHTML = '';

  document.getElementById('listCnt').textContent = `${groups.size}개 과정 · ${allCourses.length}개 기수`;

  for (const [name, cohorts] of groups) {
    const avgSat = avg(cohorts, 'satisfaction');
    const avgComp = avg(cohorts, 'completionRate');
    const totalTrainees = cohorts.reduce((s, c) => s + (c.totalTrainees || 0), 0);
    const inProg = cohorts.some(c => c.status === 'in_progress');

    const group = document.createElement('div');
    group.className = 'cg';

    group.innerHTML = `
      <div class="cg-header">
        <span class="cg-arrow">&#9654;</span>
        <span class="cg-name">${name}${inProg ? ' <span class="status-badge prog">진행중</span>' : ''}</span>
        <div class="cg-tags">
          <span class="cg-tag"><b>${cohorts.length}</b> 기수</span>
          <span class="cg-tag">수강 <b>${totalTrainees.toLocaleString()}</b>명</span>
          <span class="cg-tag">만족도 <b>${avgSat != null ? fmtNum(avgSat) : '-'}</b></span>
          <span class="cg-tag">수료율 <b>${avgComp != null ? fmtNum(avgComp) + '%' : '-'}</b></span>
        </div>
      </div>
      <div class="cg-body">
        <div style="overflow-x:auto">
          <table>
            <thead><tr>
              <th>기수</th>
              <th>상태</th>
              <th>훈련기간</th>
              <th>수강</th>
              <th>수료</th>
              <th>수료율</th>
              <th>만족도</th>
              <th>취업률</th>
              <th>평균임금</th>
              <th>상세</th>
            </tr></thead>
            <tbody>
              ${cohorts.map(c => {
                const period = c.startDate && c.endDate ? `${fmtDate(c.startDate)} ~ ${fmtDate(c.endDate)}` : '-';
                const stClass = c.status === 'in_progress' ? 'prog'
                  : c.status === 'pending_stats' ? 'wait'
                  : c.status === 'no_stats' ? 'nostats' : '';
                const stBadge = stClass
                  ? `<span class="status-badge ${stClass}">${fmtStatus(c.status)}</span>`
                  : `<span style="color:var(--text3);font-size:11px">${fmtStatus(c.status)}</span>`;
                return `<tr class="${c.status === 'in_progress' ? 'row-prog' : ''}">
                  <td><span class="cohort-badge">${c.cohort || '-'}기</span></td>
                  <td>${stBadge}</td>
                  <td>${period}</td>
                  <td>${c.totalTrainees != null ? c.totalTrainees.toLocaleString() + '명' : '<span class="metric na">-</span>'}</td>
                  <td>${c.completedTrainees != null ? c.completedTrainees.toLocaleString() + '명' : '<span class="metric na">-</span>'}</td>
                  <td class="metric ${cls(c.completionRate, 80, 60)}">${mt(c.completionRate, '%')}</td>
                  <td class="metric ${cls(c.satisfaction, 85, 70)}">${mt(c.satisfaction, '점')}</td>
                  <td class="metric ${cls(c.employmentRate, 70, 50)}">${mt(c.employmentRate, '%')}</td>
                  <td>${c.avgWage != null ? Math.round(c.avgWage / 10000).toLocaleString() + '만원' : '<span class="metric na">-</span>'}</td>
                  <td>${c.detailUrl ? `<a href="${c.detailUrl}" target="_blank" rel="noopener" style="color:var(--primary);font-size:12px">보기 &nearr;</a>` : '-'}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>`;

    group.querySelector('.cg-header').addEventListener('click', () => group.classList.toggle('open'));
    container.appendChild(group);
  }
}

// ─── CSV 내보내기 ────────────────────────────────────────────────────
function exportCsv() {
  const headers = ['과정명','기수','상태','시작일','종료일','수강인원','수료인원','수료율','만족도','취업률','평균임금(만원)'];
  const rows = allCourses.map(c => [
    c.courseName || '', c.cohort || '',
    fmtStatus(c.status),
    fmtDate(c.startDate), fmtDate(c.endDate),
    c.totalTrainees ?? '', c.completedTrainees ?? '',
    fmtNum(c.completionRate) ?? '', fmtNum(c.satisfaction) ?? '',
    fmtNum(c.employmentRate) ?? '',
    c.avgWage != null ? Math.round(c.avgWage / 10000) : '',
  ]);
  const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `grepp_kdt_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── 이벤트 ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadData();
  document.getElementById('csvBtn').addEventListener('click', exportCsv);
});
