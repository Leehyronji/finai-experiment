/* ============================================================
   상황 적응형 금융 AI 실험 — 실행 엔진
   · 조건 무작위 배정 (Study 1: 1~4 / Study 2: 1~5)
   · 클릭·선택시간·선택변경 전수 기록
   · 종료 시 CSV / JSON 내보내기 + Prolific 리다이렉트
   ============================================================ */

import {
  PROFILE, PRODUCTS, S1_CONDITIONS, S1_QUIZ, S1_SCALES, S1_AI_TRUST,
  S2_CONDITIONS, S2_SCENARIO, S2_SCALES, S2_AI_ACCEPT, S2_REACTANCE, S2_MC,
  STIGMA, LITERACY, FK_QUIZ, DEMOS,
} from './data.js';

/* ---------- URL 파라미터 (Prolific / Qualtrics 연동) ---------- */
const qs = new URLSearchParams(location.search);
const PID = qs.get('PROLIFIC_PID') || qs.get('pid') || '';
const STUDY_ID = qs.get('STUDY_ID') || '';
const SESSION_ID = qs.get('SESSION_ID') || '';
const REDIRECT = qs.get('redirect') || '';
// 조건 강제 지정(파일럿·검수용): ?s1=3&s2=5
const FORCE_S1 = parseInt(qs.get('s1'), 10);
const FORCE_S2 = parseInt(qs.get('s2'), 10);
const ADMIN = qs.get('admin') === '1';

/* ---------- 무작위 배정 ---------- */
const randInt = (n) => Math.floor(Math.random() * n) + 1;
const S1_COND = (FORCE_S1 >= 1 && FORCE_S1 <= 4) ? FORCE_S1 : randInt(4);
const S2_COND = (FORCE_S2 >= 1 && FORCE_S2 <= 5) ? FORCE_S2 : randInt(5);

const RESP_ID = 'R' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
const COMPLETION_CODE = 'CAFAI-' + Math.random().toString(36).slice(2, 8).toUpperCase();

/* ---------- 데이터 저장소 ---------- */
const D = {
  meta: {
    response_id: RESP_ID,
    prolific_pid: PID,
    study_id: STUDY_ID,
    session_id: SESSION_ID,
    s1_condition: S1_COND,
    s1_condition_label: S1_CONDITIONS[S1_COND].label,
    s1_condition_key: S1_CONDITIONS[S1_COND].key,
    s2_condition: S2_COND,
    s2_condition_label: S2_CONDITIONS[S2_COND].label,
    s2_condition_key: S2_CONDITIONS[S2_COND].key,
    started_at: new Date().toISOString(),
    completion_code: COMPLETION_CODE,
    user_agent: navigator.userAgent,
    screen_w: window.screen.width,
    screen_h: window.screen.height,
  },
  responses: {},   // 문항 id → 값
  behavior: {},    // 행동 지표
  events: [],      // 전체 이벤트 로그
  dwell: {},       // 화면별 체류시간(ms)
};

let screenEnteredAt = 0;
let currentScreenId = '';

function logEvent(type, payload) {
  D.events.push({ t: Date.now(), ms_from_start: Date.now() - startTime, screen: currentScreenId, type, ...payload });
}
const startTime = Date.now();

/* ---------- DOM 헬퍼 ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const el = (tag, attrs = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') n.className = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v !== null && v !== undefined && v !== false) n.setAttribute(k, v);
  }
  for (const kid of kids.flat()) {
    if (kid === null || kid === undefined || kid === false) continue;
    n.append(typeof kid === 'string' || typeof kid === 'number' ? document.createTextNode(String(kid)) : kid);
  }
  return n;
};

const ICON = {
  shield: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
  spark: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v3M12 18v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M3 12h3M18 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/><circle cx="12" cy="12" r="3.2"/></svg>',
  warn: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.7 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.7a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/></svg>',
  phone: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/></svg>',
  bank: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18M3 10h18M5 6l7-3 7 3M5 10v11M19 10v11M9 14v3M15 14v3"/></svg>',
  sun: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>',
  moon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
};

/* ---------- 리커트 렌더러 ---------- */
function renderLikert(block) {
  const { scale } = block;
  const wrap = el('div', { class: 'stack-4' });
  wrap.append(el('h2', { class: 'sect' }, block.title));
  const group = el('div', { class: 'likert-group' });

  for (const item of block.items) {
    const key = item.id;
    const itemEl = el('div', { class: 'likert-item', 'data-item': key });
    itemEl.append(el('p', { class: 'likert-q' }, item.t));
    const row = el('div', { class: 'likert-scale' });
    row.append(el('span', { class: 'likert-anchor' }, scale.minLabel));
    const opts = el('div', { class: 'likert-opts' });
    for (let v = scale.min; v <= scale.max; v++) {
      const b = el('button', {
        type: 'button', class: 'likert-opt', 'aria-pressed': 'false',
        'aria-label': `${item.t} — ${v}점`,
        'data-testid': `likert-${key}-${v}`,
        onClick: () => {
          const prev = D.responses[key];
          D.responses[key] = v;
          if (item.rev) D.responses[key + '_r'] = scale.max + scale.min - v;
          [...opts.children].forEach((c) => c.setAttribute('aria-pressed', 'false'));
          b.setAttribute('aria-pressed', 'true');
          itemEl.classList.remove('unanswered');
          logEvent('likert', { item: key, value: v, changed_from: prev ?? null });
        },
      }, v);
      opts.append(b);
    }
    row.append(opts);
    row.append(el('span', { class: 'likert-anchor right' }, scale.maxLabel));
    itemEl.append(row);
    group.append(itemEl);
  }
  wrap.append(group);
  return { node: wrap, ids: block.items.map((i) => i.id) };
}

/* ---------- 객관식 렌더러 ---------- */
function renderMC(items, { scored = false, prefix = '' } = {}) {
  const wrap = el('div', { class: 'stack-4' });
  for (const item of items) {
    const key = prefix + item.id;
    const itemEl = el('div', { class: 'mc-item', 'data-item': key });
    itemEl.append(el('p', { class: 'mc-q' }, item.q));
    const opts = el('div', { class: 'mc-opts' });
    item.opts.forEach((label, idx) => {
      const b = el('button', {
        type: 'button', class: 'mc-opt', 'aria-pressed': 'false',
        'data-testid': `mc-${key}-${idx}`,
        onClick: () => {
          const prev = D.responses[key];
          D.responses[key] = idx;
          D.responses[key + '_label'] = label;
          if (scored) D.responses[key + '_correct'] = idx === item.ans ? 1 : 0;
          [...opts.children].forEach((c) => c.setAttribute('aria-pressed', 'false'));
          b.setAttribute('aria-pressed', 'true');
          itemEl.classList.remove('unanswered');
          logEvent('mc', { item: key, value: idx, correct: scored ? (idx === item.ans ? 1 : 0) : null, changed_from: prev ?? null });
        },
      }, el('span', { class: 'mark' }, String.fromCharCode(9312 + idx)), el('span', {}, label));
      opts.append(b);
    });
    itemEl.append(opts);
    wrap.append(itemEl);
  }
  return { node: wrap, ids: items.map((i) => prefix + i.id) };
}

/* ---------- 검증 ---------- */
function validate(ids) {
  let firstMissing = null;
  let ok = true;
  for (const id of ids) {
    const node = document.querySelector(`[data-item="${id}"]`);
    if (D.responses[id] === undefined || D.responses[id] === null || D.responses[id] === '') {
      ok = false;
      if (node) node.classList.add('unanswered');
      if (!firstMissing && node) firstMissing = node;
    } else if (node) node.classList.remove('unanswered');
  }
  if (!ok && firstMissing) firstMissing.scrollIntoView({ behavior: 'smooth', block: 'center' });
  return ok;
}

/* ---------- 화면 셸 ---------- */
const root = $('#app');
const progressFill = $('#progress-fill');

function show(screenId, buildFn, { wide = false, progress = 0 } = {}) {
  if (currentScreenId) D.dwell[currentScreenId] = (D.dwell[currentScreenId] || 0) + (Date.now() - screenEnteredAt);
  currentScreenId = screenId;
  screenEnteredAt = Date.now();
  logEvent('screen_enter', {});
  progressFill.style.width = progress + '%';
  root.innerHTML = '';
  root.className = wide ? 'wide' : '';
  const node = buildFn();
  node.classList.add('fade-in');
  root.append(node);
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function pageHead(eyebrow, title, lede) {
  return el('div', {},
    eyebrow && el('p', { class: 'eyebrow' }, eyebrow),
    el('h1', { class: 'page-title' }, title),
    lede && el('p', { class: 'lede' }, lede),
  );
}

function nextBtn(label, onClick, { testid = 'button-next' } = {}) {
  return el('div', { class: 'actions' },
    el('button', { type: 'button', class: 'btn btn-lg', 'data-testid': testid, onClick }, label),
  );
}

/* ============================================================
   화면 1 — 동의
   ============================================================ */
function scrConsent() {
  show('consent', () => {
    const v = el('div', { class: 'stack-6' });
    v.append(pageHead('연구 참여 안내', '금융 의사결정 상황에 대한 연구',
      '본 조사는 금융 관련 정보를 접했을 때의 판단과 대응을 알아보기 위한 학술 연구입니다. 소요 시간은 약 15~20분입니다.'));

    v.append(el('div', { class: 'card stack-4' },
      el('h2', { class: 'sect' }, '참여 시 유의사항'),
      el('ul', { class: 'profile', style: 'background:transparent;border:none;padding:0' },
        el('li', {}, '본 조사에는 실제 금전 거래가 포함되지 않습니다. 모든 화면은 연구용 모의 화면입니다.'),
        el('li', {}, '정답을 맞히는 시험이 아니며, 평소 본인의 판단대로 응답해 주시면 됩니다.'),
        el('li', {}, '응답은 익명으로 수집되어 통계 분석 목적으로만 사용됩니다.'),
        el('li', {}, '언제든 중단할 수 있으며, 중단 시 불이익은 없습니다.'),
        el('li', {}, '일부 화면은 실제 금융 상황을 모사하므로 몰입해서 응답해 주시기 바랍니다. 조사 종료 후 연구의 전체 목적을 안내드립니다.'),
      ),
    ));

    v.append(el('div', { class: 'notice' },
      '본 조사는 응답 성실성 점검 문항을 포함합니다. 화면을 충분히 읽고 응답해 주세요.'));

    v.append(nextBtn('위 내용을 이해했으며 참여에 동의합니다', () => {
      D.responses.consent = 1;
      logEvent('consent', {});
      scrDemo();
    }, { testid: 'button-consent' }));
    return v;
  }, { progress: 4 });
}

/* ============================================================
   화면 2 — 인구통계 + 금융역량 + 금융지식
   ============================================================ */
function scrDemo() {
  show('prescreen_demo', () => {
    const v = el('div', { class: 'stack-8' });
    v.append(pageHead('1/6 · 사전 조사', '기본 정보', '통계 분석을 위한 기본 문항입니다.'));

    const demo = renderMC(DEMOS.map((d) => ({ id: d.id, q: d.q, opts: d.opts })), { prefix: 'DM_' });
    v.append(demo.node);

    const lit = renderLikert(LITERACY);
    v.append(el('div', { class: 'divider-line' }));
    v.append(lit.node);

    const allIds = [...demo.ids, ...lit.ids];
    v.append(nextBtn('다음', () => {
      if (!validate(allIds)) return;
      scrFK();
    }));
    return v;
  }, { progress: 12 });
}

function scrFK() {
  show('prescreen_fk', () => {
    const v = el('div', { class: 'stack-8' });
    v.append(pageHead('2/6 · 사전 조사', '금융 상식', '아는 범위에서 응답해 주세요. 모르는 경우 "모르겠다"를 선택하셔도 됩니다.'));
    const q = renderMC(FK_QUIZ, { scored: true, prefix: 'FK_' });
    v.append(q.node);

    v.append(el('div', { class: 'divider-line' }));
    const sb = renderLikert(STIGMA);
    v.append(sb.node);

    const allIds = [...q.ids, ...sb.ids];
    v.append(nextBtn('다음', () => {
      if (!validate(allIds)) return;
      // 금융지식 총점
      D.responses.FK_total = FK_QUIZ.reduce((s, it) => s + (D.responses['FK_' + it.id + '_correct'] || 0), 0);
      scrS1Intro();
    }));
    return v;
  }, { progress: 22 });
}

/* ============================================================
   Study 1 — 과제 안내
   ============================================================ */
function scrS1Intro() {
  show('s1_intro', () => {
    const v = el('div', { class: 'stack-6' });
    v.append(pageHead('3/6 · 금융상품 선택', '예금·적금 상품을 선택해 주세요',
      '아래 프로필을 본인의 상황이라고 가정하고, 다음 화면에서 두 개의 적금 상품 중 본인 조건에 더 적합한 상품을 선택해 주세요.'));

    v.append(profilePanel());
    v.append(el('div', { class: 'notice' },
      '다음 화면에서 상품 정보를 확인한 뒤 선택 버튼을 누르시면 됩니다. 시간 제한은 없으나, 평소 금융상품을 고를 때처럼 판단해 주세요.'));

    v.append(nextBtn('상품 정보 보기', () => scrS1Task(), { testid: 'button-s1-start' }));
    return v;
  }, { progress: 30 });
}

function profilePanel() {
  return el('div', { class: 'profile' },
    el('h3', {}, '나의 금융 프로필'),
    el('ul', {},
      el('li', {}, PROFILE.salary),
      el('li', {}, PROFILE.card),
      el('li', {}, PROFILE.term),
      el('li', {}, PROFILE.marketing),
      el('li', {}, PROFILE.auto),
    ),
  );
}

/* ============================================================
   Study 1 — 상품 화면 (조건별) + 실제 클릭·시간 기록
   ============================================================ */
function scrS1Task() {
  show('s1_task', () => {
    const v = el('div', { class: 'stack-6' });
    const cond = S1_CONDITIONS[S1_COND];

    v.append(pageHead(null, '상품 비교', null));
    v.append(profilePanel());

    if (S1_COND === 4) {
      v.append(el('div', { class: 'ai-banner' }, el('span', { html: ICON.spark }),
        'AI가 회원님의 프로필을 적용해 적용금리를 계산하고 정리했습니다.'));
    }

    const grid = el('div', { class: 'products' });
    for (const p of PRODUCTS) grid.append(productCard(p, S1_COND));
    v.append(grid);

    if (S1_COND === 3) {
      v.append(el('div', { class: 'self-calc' },
        el('strong', {}, '본인의 프로필 조건을 각 우대조건과 직접 대조하여 적용금리를 계산해 주세요.'),
        '위 표에는 상품의 모든 조건이 그대로 제시되어 있습니다. 어떤 우대조건이 본인에게 해당되는지 직접 확인하셔야 합니다.'));
    }

    // 선택 버튼
    const state = { choice: null, changes: 0, firstAt: null };
    const taskStart = Date.now();
    D.behavior.s1_task_shown_at = taskStart;

    const mkChoice = (pid, sub) => el('button', {
      type: 'button', class: 'choice-btn', 'aria-pressed': 'false',
      'data-testid': `button-choose-${pid}`,
      onClick: (e) => {
        const now = Date.now();
        if (state.choice === null) state.firstAt = now;
        else if (state.choice !== pid) state.changes++;
        state.choice = pid;
        [...row.children].forEach((c) => c.setAttribute('aria-pressed', 'false'));
        e.currentTarget.setAttribute('aria-pressed', 'true');
        submit.disabled = false;
        logEvent('s1_choice_click', { product: pid, rt_ms: now - taskStart, changes: state.changes });
      },
    }, el('span', {}, `상품 ${pid} 선택`), el('span', { class: 'sub' }, sub));

    const row = el('div', { class: 'choice-row' },
      mkChoice('A', '이 상품이 내 조건에 더 적합하다'),
      mkChoice('B', '이 상품이 내 조건에 더 적합하다'));
    v.append(row);

    const submit = el('button', {
      type: 'button', class: 'btn btn-lg', disabled: true, 'data-testid': 'button-s1-submit',
      onClick: () => {
        const now = Date.now();
        D.behavior.s1_choice = state.choice;
        D.behavior.s1_first_choice_rt_ms = state.firstAt ? state.firstAt - taskStart : null;
        D.behavior.s1_final_rt_ms = now - taskStart;
        D.behavior.s1_choice_changes = state.changes;
        D.responses.s1_choice = state.choice;
        logEvent('s1_submit', { product: state.choice, total_rt_ms: now - taskStart, changes: state.changes });
        scrS1Reason();
      },
    }, '선택 확정');
    v.append(el('div', { class: 'actions' }, submit,
      el('span', { class: 'timer-note' }, '선택 후 확정 버튼을 눌러 주세요. 확정 전에는 변경할 수 있습니다.')));

    if (ADMIN) v.append(el('div', { class: 'notice xs' }, `[검수] Study 1 조건 ${cond.label} — ${cond.note}`));
    return v;
  }, { wide: true, progress: 38 });
}

function productCard(p, cond) {
  const c = el('div', { class: 'pcard' });
  c.append(el('div', { class: 'pcard-head' },
    el('span', { class: 'pcard-name' }, p.name),
    el('span', { class: 'pcard-tag' }, p.term)));

  /* ① 광고형 — 최고금리만 */
  if (cond === 1) {
    c.append(el('div', { class: 'rate-hero' },
      el('span', { class: 'rate-num' }, p.max.toFixed(1)),
      el('span', { class: 'rate-unit' }, '%')));
    c.append(el('p', { class: 'rate-cap' }, '최고 연 금리 · 우대조건 충족 시'));
    return c;
  }

  /* ② 기본 정보 */
  if (cond === 2) {
    c.append(el('div', { class: 'rate-hero' },
      el('span', { class: 'rate-num' }, p.max.toFixed(1)),
      el('span', { class: 'rate-unit' }, '% 최고')));
    c.append(el('dl', { class: 'kv' },
      kvRow('기본금리', `연 ${p.base.toFixed(1)}%`),
      kvRow('최고금리', `연 ${p.max.toFixed(1)}%`),
      kvRow('가입기간', p.term),
      kvRow('중도해지', p.early)));
    return c;
  }

  /* ③ 조건 나열형 — 원자료 전체, 계산 없음 */
  if (cond === 3) {
    c.append(el('dl', { class: 'kv' },
      kvRow('기본금리', `연 ${p.base.toFixed(1)}%`),
      kvRow('최고금리', `연 ${p.max.toFixed(1)}%`)));

    c.append(el('p', { class: 'block-label' }, '우대조건'));
    const list = el('div', { class: 'blist' });
    for (const b of p.benefits) {
      list.append(el('div', { class: 'brow' },
        el('span', { class: 'brow-label' }, b.label),
        el('span', { class: 'brow-rate' }, `+${b.rate.toFixed(1)}%p`)));
    }
    c.append(list);

    c.append(el('p', { class: 'block-label' }, '기타 조건'));
    c.append(el('dl', { class: 'kv' },
      kvRow('가입기간', p.term),
      kvRow('중도해지', p.early),
      kvRow('유동성', p.liquidity)));

    c.append(el('p', { class: 'block-label' }, '주요 판단요인'));
    c.append(el('ul', { class: 'factors' }, p.factors.map((f) => el('li', {}, f))));
    return c;
  }

  /* ④ AI 개인화·구조화 — ③과 동일 정보 + 참가자 조건 적용 계산/구조화 */
  c.append(el('dl', { class: 'kv' },
    kvRow('기본금리', `연 ${p.base.toFixed(1)}%`),
    kvRow('최고금리', `연 ${p.max.toFixed(1)}%`)));

  c.append(el('p', { class: 'block-label' }, '우대조건 — 회원님 조건 적용 결과'));
  const list = el('div', { class: 'blist' });
  for (const b of p.benefits) {
    list.append(el('div', { class: 'brow ' + (b.met ? 'met' : 'unmet') },
      el('span', { class: 'brow-label' }, b.label,
        el('span', { class: 'brow-why' }, b.why)),
      el('span', { class: 'brow-rate' }, `${b.met ? '+' : ''}${b.rate.toFixed(1)}%p`)));
  }
  c.append(list);

  const metSum = p.benefits.filter((b) => b.met).reduce((s, b) => s + b.rate, 0);
  c.append(el('div', { class: 'applied-box' },
    el('div', { class: 'lbl' }, '회원님 조건 기준 예상 적용금리'),
    el('div', { class: 'val' }, `연 ${p.applied.toFixed(1)}%`),
    el('div', { class: 'calc-note' }, `${p.base.toFixed(1)} + ${metSum.toFixed(1)} = ${p.applied.toFixed(1)}`)));

  c.append(el('p', { class: 'block-label' }, '기타 조건'));
  c.append(el('dl', { class: 'kv' },
    kvRow('가입기간', p.term),
    kvRow('중도해지', p.early),
    kvRow('유동성', p.liquidity)));

  c.append(el('p', { class: 'block-label' }, '주요 판단요인'));
  c.append(el('ul', { class: 'factors' }, p.factors.map((f) => el('li', {}, f))));
  c.append(el('p', { class: 'xs muted', style: 'margin-top:var(--space-3)' },
    'AI는 특정 상품을 추천하지 않습니다. 위 정리를 참고하여 직접 판단해 주세요.'));
  return c;
}

function kvRow(k, v) {
  return el('div', { class: 'kv-row' }, el('dt', {}, k), el('dd', {}, v));
}

/* ============================================================
   Study 1 — 선택 이유 (개방형)
   ============================================================ */
function scrS1Reason() {
  show('s1_reason', () => {
    const v = el('div', { class: 'stack-6' });
    v.append(pageHead(null, '선택 이유',
      `방금 상품 ${D.behavior.s1_choice}을(를) 선택하셨습니다. 어떤 점을 고려해 선택하셨는지 구체적으로 적어 주세요.`));

    const ta = el('textarea', {
      class: 'textarea', 'data-testid': 'input-reason', 'data-item': 'OR1',
      placeholder: '예: 제 조건에서 실제로 받을 수 있는 금리를 비교해 보니…',
      onInput: (e) => {
        D.responses.OR1 = e.target.value.trim();
        count.textContent = `${e.target.value.trim().length}자`;
        if (e.target.value.trim().length >= 20) e.target.closest('[data-item]').classList.remove('unanswered');
      },
    });
    const count = el('div', { class: 'char-count' }, '0자');
    v.append(el('div', {}, ta, count));
    v.append(el('p', { class: 'xs muted' }, '최소 20자 이상 작성해 주세요.'));

    v.append(el('div', { class: 'divider-line' }));
    const prio = renderMC([{
      id: 'PRIO', q: '이번 선택에서 가장 중요하게 고려한 기준은 무엇입니까? (하나만)',
      opts: [
        '내 조건에서 실제로 적용되는 금리가 높은 것',
        '중도에 해지하거나 일부 출금할 수 있는 유연성',
        '광고에 표시된 최고금리가 높은 것',
        '특별한 기준 없이 직관적으로 선택했다',
      ],
    }], { prefix: 'S1_' });
    v.append(prio.node);

    v.append(nextBtn('다음', () => {
      const val = (D.responses.OR1 || '');
      if (val.length < 20) {
        ta.classList.add('unanswered');
        ta.style.borderColor = 'var(--danger)';
        ta.focus();
        return;
      }
      if (!validate(prio.ids)) return;
      logEvent('s1_reason_submit', { length: val.length });
      scrS1Quiz();
    }));
    return v;
  }, { progress: 45 });
}

/* ============================================================
   Study 1 — 이해도 객관식 (채점형) · 프로필 재제시
   ============================================================ */
function scrS1Quiz() {
  show('s1_quiz', () => {
    const v = el('div', { class: 'stack-6' });
    v.append(pageHead(null, '상품 정보 확인 문항',
      '앞서 본 상품 정보에 대한 문항입니다. 기억하는 범위에서 응답해 주세요. 상품 화면으로 돌아갈 수 없습니다.'));
    v.append(profilePanel());
    const q = renderMC(S1_QUIZ, { scored: true, prefix: 'S1_' });
    v.append(q.node);
    v.append(nextBtn('다음', () => {
      if (!validate(q.ids)) return;
      D.responses.S1_comprehension_total = S1_QUIZ.filter((i) => !i.attention)
        .reduce((s, it) => s + (D.responses['S1_' + it.id + '_correct'] || 0), 0);
      D.responses.S1_attention_pass = D.responses['S1_ATT1_correct'] || 0;
      scrS1Scales();
    }));
    return v;
  }, { progress: 52 });
}

/* ============================================================
   Study 1 — 리커트 블록
   ============================================================ */
function scrS1Scales() {
  show('s1_scales', () => {
    const v = el('div', { class: 'stack-8' });
    v.append(pageHead(null, '방금 본 화면에 대한 평가', '정답은 없습니다. 느끼신 대로 응답해 주세요.'));
    const ids = [];
    const blocks = [...S1_SCALES];
    if (S1_COND === 4) blocks.push(S1_AI_TRUST);
    blocks.forEach((b, i) => {
      const r = renderLikert(b);
      if (i > 0) v.append(el('div', { class: 'divider-line' }));
      v.append(r.node);
      ids.push(...r.ids);
    });
    v.append(nextBtn('Study 1 완료 · 다음 과제로', () => {
      if (!validate(ids)) return;
      scrS2Intro();
    }));
    return v;
  }, { progress: 60 });
}

/* ============================================================
   Study 2 — 시나리오
   ============================================================ */
function scrS2Intro() {
  show('s2_intro', () => {
    const v = el('div', { class: 'stack-6' });
    v.append(pageHead('4/6 · 두 번째 과제', '다음 상황을 읽어 주세요',
      '아래는 실제로 발생할 수 있는 금융 상황을 모사한 화면입니다. 본인이 직접 겪고 있다고 가정하고 판단해 주세요.'));

    v.append(el('div', { class: 'phone' },
      el('div', { class: 'phone-status' }, el('span', {}, '9:41'), el('span', {}, 'LTE · 78%')),
      el('div', { class: 'phone-nav' }, el('span', { html: ICON.phone }), '통화 중'),
      el('div', { class: 'phone-body' },
        el('div', { class: 'call-card' },
          el('div', { class: 'call-meta' },
            el('div', { class: 'call-avatar', html: ICON.phone }),
            el('div', { class: 'call-name' }, S2_SCENARIO.caller),
            el('div', { class: 'call-num' }, S2_SCENARIO.callerNum)),
          el('div', { class: 'call-lines' },
            S2_SCENARIO.lines.map((l) => el('div', { class: 'call-line' }, `“${l}”`)))))));

    v.append(el('div', { class: 'notice' },
      '통화 안내에 따라 모바일 뱅킹 송금 화면이 열렸습니다. 다음 화면에서 실제로 진행하실 행동을 선택해 주세요.'));

    v.append(nextBtn('송금 화면으로 이동', () => scrS2Task(), { testid: 'button-s2-start' }));
    return v;
  }, { progress: 66 });
}

/* ============================================================
   Study 2 — 송금 화면 + 조건별 AI 개입 + 실제 행동 클릭
   ============================================================ */
function scrS2Task() {
  show('s2_task', () => {
    const v = el('div', { class: 'stack-6' });
    const cond = S2_CONDITIONS[S2_COND];
    const t = S2_SCENARIO.transfer;

    const phone = el('div', { class: 'phone' },
      el('div', { class: 'phone-status' }, el('span', {}, '9:44'), el('span', {}, 'LTE · 77%')),
      el('div', { class: 'phone-nav' }, el('span', { html: ICON.bank }), '모바일 뱅킹 · 이체 확인'));

    const body = el('div', { class: 'phone-body' });
    body.append(el('dl', { class: 'tinfo' },
      el('div', { class: 'tinfo-row' }, el('dt', {}, '받는 분'), el('dd', {}, t.payee)),
      el('div', { class: 'tinfo-row' }, el('dt', {}, '은행'), el('dd', {}, t.bank)),
      el('div', { class: 'tinfo-row' }, el('dt', {}, '계좌번호'), el('dd', {}, t.account))));
    body.append(el('div', { class: 'tdivider' }));
    body.append(el('dl', { class: 'tinfo' },
      el('div', { class: 'tinfo-row' },
        el('dt', {}, '이체 금액'),
        el('dd', { class: 'tamount' }, t.amount + '원'))));

    /* 조건별 AI 개입 */
    if (cond.alert !== null && S2_COND !== 1) {
      const a = el('div', { class: 'alert ' + cond.level });
      a.append(el('div', { class: 'alert-head' },
        el('span', { html: ICON.warn }), 'AI 금융보호 알림'));
      a.append(el('p', { class: 'alert-title' }, cond.title));
      if (cond.body && cond.body.length) {
        a.append(el('ul', {}, cond.body.map((b) => el('li', {}, b))));
      }
      if (cond.ease) a.append(el('p', { class: 'alert-ease' }, cond.ease));
      body.append(a);
      logEvent('s2_alert_shown', { condition: S2_COND });
    }

    /* 실제 행동 선택 — 4지 행동 */
    const taskStart = Date.now();
    D.behavior.s2_task_shown_at = taskStart;
    const state = { action: null, changes: 0, firstAt: null };

    const ACTIONS = [
      { id: 'proceed', label: '송금 진행', cls: 'pbtn pbtn-primary', kind: '위험 행동' },
      { id: 'hold_verify', label: '송금 보류하고 공식 대표번호로 확인', cls: 'pbtn pbtn-outline', kind: '안전 행동' },
      { id: 'stop', label: '송금 중단 (확인 없이 종료)', cls: 'pbtn pbtn-outline', kind: '중단 행동' },
      { id: 'search', label: '추가 정보를 검색해 본다', cls: 'pbtn pbtn-outline', kind: '탐색 행동' },
    ];

    const acts = el('div', { class: 'phone-actions' });
    for (const a of ACTIONS) {
      const b = el('button', {
        type: 'button', class: a.cls, 'aria-pressed': 'false',
        'data-testid': `button-action-${a.id}`,
        onClick: (e) => {
          const now = Date.now();
          if (state.action === null) state.firstAt = now;
          else if (state.action !== a.id) state.changes++;
          state.action = a.id;
          [...acts.children].forEach((c) => {
            c.setAttribute('aria-pressed', 'false');
            c.style.outline = '';
          });
          e.currentTarget.setAttribute('aria-pressed', 'true');
          e.currentTarget.style.outline = '2px solid var(--primary)';
          e.currentTarget.style.outlineOffset = '2px';
          submit.disabled = false;
          logEvent('s2_action_click', { action: a.id, kind: a.kind, rt_ms: now - taskStart, changes: state.changes });
        },
      }, a.label);
      acts.append(b);
    }
    body.append(acts);
    phone.append(body);
    v.append(phone);

    const submit = el('button', {
      type: 'button', class: 'btn btn-lg', disabled: true, 'data-testid': 'button-s2-submit',
      onClick: () => {
        const now = Date.now();
        const chosen = ACTIONS.find((a) => a.id === state.action);
        D.behavior.s2_action = state.action;
        D.behavior.s2_action_kind = chosen.kind;
        D.behavior.s2_first_action_rt_ms = state.firstAt ? state.firstAt - taskStart : null;
        D.behavior.s2_final_rt_ms = now - taskStart;
        D.behavior.s2_action_changes = state.changes;
        D.responses.s2_action = state.action;
        D.responses.s2_action_proceed = state.action === 'proceed' ? 1 : 0;
        D.responses.s2_action_safe = state.action === 'hold_verify' ? 1 : 0;
        logEvent('s2_submit', { action: state.action, total_rt_ms: now - taskStart, changes: state.changes });
        scrS2Scales();
      },
    }, '선택 확정');

    v.append(el('div', { class: 'actions' }, submit,
      el('span', { class: 'timer-note' }, '하나를 선택한 뒤 확정 버튼을 눌러 주세요.')));

    if (ADMIN) v.append(el('div', { class: 'notice xs' }, `[검수] Study 2 조건 ${cond.label}`));
    return v;
  }, { progress: 74 });
}

/* ============================================================
   Study 2 — 리커트 블록
   ============================================================ */
function scrS2Scales() {
  show('s2_scales', () => {
    const v = el('div', { class: 'stack-8' });
    v.append(pageHead('5/6 · 응답', '방금 상황에 대한 판단',
      '방금 보신 화면 상황을 기준으로 응답해 주세요.'));

    const ids = [];
    const blocks = [...S2_SCALES];
    if (S2_COND >= 2) blocks.push(S2_AI_ACCEPT);
    if (S2_COND === 4 || S2_COND === 5) blocks.push(S2_REACTANCE);
    blocks.push(S2_MC);

    blocks.forEach((b, i) => {
      const r = renderLikert(b);
      if (i > 0) v.append(el('div', { class: 'divider-line' }));
      v.append(r.node);
      ids.push(...r.ids);
    });

    v.append(nextBtn('응답 완료', () => {
      if (!validate(ids)) return;
      scrPostcheck();
    }));
    return v;
  }, { progress: 86 });
}

/* ============================================================
   사후 확인
   ============================================================ */
function scrPostcheck() {
  show('postcheck', () => {
    const v = el('div', { class: 'stack-6' });
    v.append(pageHead('6/6 · 마무리', '마지막 문항', '조사 품질 확인을 위한 문항입니다.'));

    const items = [
      { id: 'DB1', q: '방금 두 번째 과제(송금 상황)는 실제 상황이라고 생각하셨습니까?',
        opts: ['실제 상황이라고 생각했다', '연구용 가상 상황이라고 생각했다', '확신하지 못했다'] },
      { id: 'DB2', q: '조사 중 화면을 충분히 읽고 응답하셨습니까?',
        opts: ['충분히 읽고 응답했다', '일부는 빠르게 넘겼다', '대부분 빠르게 넘겼다'] },
    ];
    const mc = renderMC(items, { prefix: 'PC_' });
    v.append(mc.node);

    const realism = renderLikert({
      id: 'RL', title: '상황의 현실성', scale: { min: 1, max: 7, minLabel: '전혀 현실적이지 않다', maxLabel: '매우 현실적이다' },
      items: [{ id: 'RL1', t: '두 번째 과제의 상황은 현실에서 일어날 수 있다고 느꼈다.' }],
    });
    v.append(el('div', { class: 'divider-line' }));
    v.append(realism.node);

    v.append(nextBtn('조사 종료', () => {
      if (!validate([...mc.ids, ...realism.ids])) return;
      finish();
    }, { testid: 'button-finish' }));
    return v;
  }, { progress: 94 });
}

/* ============================================================
   종료 · 사후설명 · 데이터 내보내기
   ============================================================ */
function finish() {
  D.dwell[currentScreenId] = (D.dwell[currentScreenId] || 0) + (Date.now() - screenEnteredAt);
  D.meta.finished_at = new Date().toISOString();
  D.meta.duration_ms = Date.now() - startTime;
  scoreSuitability();

  show('debrief', () => {
    const v = el('div', { class: 'stack-6' });
    v.append(pageHead('연구 참여 완료', '사후 안내 (Debriefing)', null));

    v.append(el('div', { class: 'card stack-4' },
      el('h2', { class: 'sect' }, '본 연구의 실제 목적'),
      el('p', {}, '두 번째 과제에서 제시된 통화 및 송금 상황은 실제 사건이 아니라 연구 목적으로 제작된 가상 시나리오입니다. 실제 계좌, 실제 금전 이동, 실제 기관은 일체 관련되어 있지 않으며, 제시된 계좌번호는 존재하지 않는 실험용 번호입니다.'),
      el('p', {}, '본 연구는 금융 AI가 상황에 따라 설명·개입 방식을 달리할 때 소비자의 이해, 신뢰, 판단과 안전행동이 어떻게 달라지는지를 검증합니다. 이를 위해 참가자를 여러 화면 조건 중 하나에 무작위로 배정하였으며, 조사 시작 시 구체적 목적을 알리지 않은 것은 응답이 사전 지식에 영향받지 않도록 하기 위한 절차였습니다.'),
      el('p', {}, '실제 상황에서 수사기관이나 금융기관은 전화·문자로 계좌 이체를 요구하지 않습니다. 의심되는 연락을 받으셨다면 안내받은 번호가 아닌 공식 대표번호로 직접 확인하시고, 금융감독원 1332 또는 경찰 112로 상담·신고하실 수 있습니다.'),
    ));

    v.append(el('div', { class: 'completion' },
      el('p', { class: 'small muted' }, '참여 확인 코드'),
      el('p', { class: 'completion-code', 'data-testid': 'text-completion-code' }, COMPLETION_CODE),
      el('p', { class: 'xs muted', style: 'margin-top:var(--space-3)' }, '플랫폼 화면에 이 코드를 입력하시면 참여가 확인됩니다.')));

    /* 연구자용 데이터 내보내기 */
    v.append(el('div', { class: 'card stack-4' },
      el('h2', { class: 'sect' }, '연구자용 · 응답 데이터'),
      el('p', { class: 'small muted' }, 'Qualtrics·서버 연동이 없는 단독 실행 환경에서는 아래 버튼으로 이 응답을 내려받을 수 있습니다. 파일럿 검수 시 사용하세요.'),
      el('div', { class: 'row' },
        el('button', { type: 'button', class: 'btn btn-ghost', 'data-testid': 'button-export-csv', onClick: () => exportCSV() }, 'CSV 내려받기'),
        el('button', { type: 'button', class: 'btn btn-ghost', 'data-testid': 'button-export-json', onClick: () => exportJSON() }, 'JSON 내려받기 (이벤트 로그 포함)'),
        el('button', { type: 'button', class: 'btn btn-ghost', onClick: (e) => {
          const box = $('#raw-out');
          box.classList.toggle('hidden');
          e.target.textContent = box.classList.contains('hidden') ? '요약 보기' : '요약 숨기기';
        } }, '요약 보기')),
      el('pre', { class: 'data-out hidden', id: 'raw-out' }, summaryText())));

    if (REDIRECT) {
      v.append(nextBtn('참여 플랫폼으로 돌아가기', () => {
        const url = REDIRECT + (REDIRECT.includes('?') ? '&' : '?') + 'cc=' + encodeURIComponent(COMPLETION_CODE);
        location.href = url;
      }, { testid: 'button-redirect' }));
    }

    v.append(el('p', { class: 'xs muted' }, '참여해 주셔서 감사합니다. 창을 닫아도 됩니다.'));
    return v;
  }, { progress: 100 });

  logEvent('finish', { duration_ms: D.meta.duration_ms });
}

/* ============================================================
   사전 확정 적합성 채점 루브릭 (Study 1)
   ------------------------------------------------------------
   A(적용 4.5%, 유동성 낮음) vs B(적용 4.2%, 유동성 높음)
   → 어느 한쪽을 '정답'으로 두지 않고, 판단 과정의 질을
     사전에 정한 3개 요소로 0~4점으로 채점한다.
   ============================================================ */
const SUIT_KEYWORDS = ['우대', '적용', '내 조건', '제 조건', '급여이체', '급여', '카드', '중도해지',
  '부분출금', '출금', '유동', '기본금리', '12개월', '만기', '25만', '30만'];

function scoreSuitability() {
  const choice = D.behavior.s1_choice;                 // 'A' | 'B'
  const prio = D.responses.S1_PRIO;                    // 0~3
  const reason = D.responses.OR1 || '';

  // (1) 자기 조건 기준 적용금리 비교의 정확성 — UC3 (0/1)
  const rateAccuracy = D.responses.S1_UC3_correct === 1 ? 1 : 0;

  // (2) 선택–기준 정합성 (0/1/2)
  //     금리 우선 → A 가 적용금리 우위이므로 정합
  //     유동성 우선 → B 가 부분출금·중도해지 조건 우위이므로 정합
  //     광고 최고금리 기준 / 직관 → 0점 (표시금리 편향)
  let coherence = 0;
  if (prio === 0) coherence = choice === 'A' ? 2 : 1;
  else if (prio === 1) coherence = choice === 'B' ? 2 : 1;
  else coherence = 0;

  // (3) 근거 서술에 자기 조건 대조가 포함되었는지 (0/1)
  const hits = SUIT_KEYWORDS.filter((k) => reason.includes(k));
  const grounded = hits.length >= 2 ? 1 : 0;

  D.responses.SUIT_rate_accuracy = rateAccuracy;
  D.responses.SUIT_coherence = coherence;
  D.responses.SUIT_grounded = grounded;
  D.responses.SUIT_keyword_hits = hits.length;
  D.responses.SUIT_keywords = hits.join('|');
  D.responses.SUIT_total = rateAccuracy + coherence + grounded;   // 0~4
  D.responses.SUIT_max = 4;

  // 표시금리 편향 지표: 광고 최고금리(A=7.0%)를 기준으로 삼았는지
  D.responses.BIAS_headline_rate = prio === 2 ? 1 : 0;

  logEvent('suitability_scored', {
    total: D.responses.SUIT_total, rate: rateAccuracy, coherence, grounded,
  });
}

/* ---------- 요약 / 내보내기 ---------- */
function flatRow() {
  const row = { ...D.meta, ...D.behavior };
  for (const [k, v] of Object.entries(D.responses)) row[k] = v;
  for (const [k, v] of Object.entries(D.dwell)) row['dwell_' + k + '_ms'] = v;
  return row;
}

function summaryText() {
  const r = flatRow();
  const keys = ['response_id', 'prolific_pid', 's1_condition_label', 's2_condition_label',
    's1_choice', 's1_final_rt_ms', 's1_choice_changes', 'S1_comprehension_total', 'S1_attention_pass',
    'SUIT_total', 'SUIT_coherence', 'SUIT_grounded', 'BIAS_headline_rate',
    's2_action', 's2_action_kind', 's2_final_rt_ms', 's2_action_changes', 'FK_total', 'duration_ms'];
  return keys.map((k) => `${k.padEnd(26)} ${r[k] ?? ''}`).join('\n');
}

function download(name, content, mime) {
  const blob = new Blob([content], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

function exportCSV() {
  const r = flatRow();
  const keys = Object.keys(r);
  const esc = (v) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  download(`finai_${RESP_ID}.csv`, keys.join(',') + '\n' + keys.map((k) => esc(r[k])).join(',') + '\n', 'text/csv;charset=utf-8');
}

function exportJSON() {
  download(`finai_${RESP_ID}.json`, JSON.stringify(D, null, 2), 'application/json');
}

/* ---------- 다크모드 ---------- */
(function theme() {
  const t = $('#theme-toggle');
  const r = document.documentElement;
  let d = matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light';
  const paint = () => {
    r.setAttribute('data-theme', d);
    t.innerHTML = d === 'dark' ? ICON.sun : ICON.moon;
    t.setAttribute('aria-label', d === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환');
  };
  paint();
  t.addEventListener('click', () => { d = d === 'dark' ? 'light' : 'dark'; paint(); });
})();

/* ---------- 관리자 스트립 ---------- */
if (ADMIN) {
  document.body.append(el('div', { class: 'admin-strip' },
    el('span', {}, `ID ${RESP_ID}`),
    el('span', {}, `S1=${S1_COND}`),
    el('span', {}, `S2=${S2_COND}`),
    el('span', { class: 'spacer' }),
    el('span', {}, PID ? `PID ${PID}` : 'PID 없음')));
}

/* ---------- 시작 ---------- */
scrConsent();
