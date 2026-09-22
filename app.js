/* ============================================================
   상황 적응형 금융 AI 실험 — 모의 은행 앱 런너
   개인용 · 외부 노출 금지 · 실제 금전 거래 없음
   Study 1 / Study 2 는 독립 표본. ?study=1 또는 2 로 분기.
   ============================================================ */
import {
  BANK, PROFILE, PRODUCTS, S1_CONDITIONS, S1_QUIZ, S1_PRIO, SUIT_KEYWORDS,
  S1_LIKERT, S2_CONDITIONS, S2_SCENARIO, S2_ALERTS, S2_ACTIONS, S2_STIGMA,
  S2_LIKERT, S2_REACT, CONTROLS, FIN_KNOW, FIN_SELF,
} from './data.js';

/* ---------------- 유틸 ---------------- */
const $ = (s, r = document) => r.querySelector(s);
const now = () => Math.round(performance.now());
const won = (n) => n.toLocaleString('ko-KR');
const P = new URLSearchParams(location.search);

function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k === 'text') n.textContent = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2).toLowerCase(), v);
    else n.setAttribute(k, v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    n.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return n;
}

/* ---------------- 상태 ---------------- */
const pick = (n) => 1 + Math.floor(Math.random() * n);
const STUDY = (() => {
  const s = parseInt(P.get('study'), 10);
  return s === 1 || s === 2 ? s : pick(2);
})();
const COND = (() => {
  const raw = parseInt(P.get('cond') || P.get(STUDY === 1 ? 's1' : 's2'), 10);
  const max = STUDY === 1 ? 4 : 5;
  return raw >= 1 && raw <= max ? raw : pick(max);
})();

const S = {
  pid: P.get('PROLIFIC_PID') || '',
  studyId: P.get('STUDY_ID') || '',
  sessionId: P.get('SESSION_ID') || '',
  redirect: P.get('redirect') || '',
  study: STUDY,
  cond: COND,
  startedAt: new Date().toISOString(),
  t0: now(),
  events: [],
  data: {},
  screen: null,
  screenT0: now(),
};
const DEV = P.get('admin') === '1';

function logEv(type, payload = {}) {
  S.events.push({ t: now() - S.t0, type, ...payload });
}
function setD(k, v) { S.data[k] = v; }

/* ---------------- 프레임 렌더 ---------------- */
const frame = $('#frame');

function clockText() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function shell({ title, body, tab, back, tabbar = false, bordered = false, flush = false }) {
  frame.innerHTML = '';
  const parts = [
    el('div', { class: 'statusbar' },
      el('span', { text: clockText() }),
      el('div', { class: 'sb-r' }, el('span', { text: '••• ' }), el('span', { text: 'WiFi' }), el('span', { text: '100%' })),
    ),
    el('div', { class: 'appbar' + (bordered ? ' bordered' : '') },
      back ? el('button', { class: 'iconbtn', 'aria-label': '뒤로', onclick: back }, '‹') : null,
      el('div', { class: 'title', text: title }),
      el('div', { class: 'spacer' }),
      el('div', { class: 'brandmark' }, logoSvg(), BANK.name),
    ),
    el('div', { class: 'screen' + (flush ? ' flush' : ''), id: 'scr' }, body),
    tabbar ? tabBar(tab) : null,
  ];
  frame.append(...parts.filter(Boolean));
  if (DEV) devBar();
  $('#scr').scrollTop = 0;
}

function logoSvg() {
  const w = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  w.setAttribute('viewBox', '0 0 24 24');
  w.setAttribute('width', '18'); w.setAttribute('height', '18');
  w.setAttribute('fill', 'none'); w.setAttribute('aria-hidden', 'true');
  w.innerHTML = '<path d="M4 10.5 12 4l8 6.5" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>'
    + '<path d="M6.5 11v8M12 11v8M17.5 11v8" stroke="currentColor" stroke-width="2"/>'
    + '<path d="M3.5 19.5h17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>';
  return w;
}

const TABS = [
  ['홈', '⌂'], ['조회', '☰'], ['이체', '⇄'], ['상품', '◈'], ['전체', '⋯'],
];
function tabBar(active) {
  return el('div', { class: 'tabbar' },
    TABS.map(([n, g]) => el('button', {
      class: n === active ? 'active' : '',
      onclick: () => { logEv('tab_tap', { tab: n }); },
    }, el('span', { class: 'glyph', text: g }), el('span', { text: n }))),
  );
}

function devBar() {
  frame.append(el('div', { class: 'devbar' },
    `S${S.study}·조건 ${S.cond}·${S.screen || ''}`,
    el('button', { onclick: () => next() }, '다음'),
  ));
}

/* 화면 전환 + 체류시간 기록 */
function go(name, fn) {
  if (S.screen) setD('dwell_' + S.screen + '_ms', (S.data['dwell_' + S.screen + '_ms'] || 0) + (now() - S.screenT0));
  S.screen = name; S.screenT0 = now();
  logEv('screen', { name });
  fn();
}

/* ---------------- 설문 위젯 ---------------- */
function likertBlock(block, store) {
  return el('div', {},
    el('div', { class: 'sect-title', text: block.title }),
    block.items.map(([id, text, rev]) => el('div', { class: 'q' },
      el('div', { class: 'qt' }, text, rev ? el('span', { class: 'rev', text: '  (역문항)' }) : null),
      scaleRow(id, store),
    )),
  );
}
function scaleRow(id, store) {
  const wrap = el('div', { class: 'scale' });
  const ticks = el('div', { class: 'ticks' });
  for (let i = 1; i <= 7; i++) {
    ticks.append(el('button', {
      text: String(i), 'data-v': i,
      onclick: (e) => {
        [...ticks.children].forEach((b) => b.classList.remove('sel'));
        e.currentTarget.classList.add('sel');
        store[id] = i; logEv('likert', { id, v: i });
        refreshGate();
      },
    }));
  }
  wrap.append(ticks, el('div', { class: 'ends' },
    el('span', { text: '전혀 그렇지 않다' }), el('span', { text: '매우 그렇다' })));
  return wrap;
}
function choiceQ(id, q, opts, store, onPick) {
  const box = el('div', { class: 'choices' });
  opts.forEach((o, i) => box.append(el('button', {
    onclick: (e) => {
      [...box.children].forEach((b) => b.classList.remove('sel'));
      e.currentTarget.classList.add('sel');
      store[id] = i; logEv('choice', { id, i });
      if (onPick) onPick(i);
      refreshGate();
    },
  }, `${i + 1}. ${o}`)));
  return el('div', { class: 'q' }, el('div', { class: 'qt', text: q }), box);
}

/* 필수응답 게이트 */
let GATE = null;
function gate(btn, check) { GATE = { btn, check }; refreshGate(); }
function refreshGate() { if (GATE) GATE.btn.disabled = !GATE.check(); }

function cta(label, onclick, disabled = true) {
  const b = el('button', { class: 'btn primary', text: label, onclick });
  b.disabled = disabled;
  return el('div', { class: 'sticky-cta' }, b);
}

/* ---------------- 플로우 ---------------- */
const FLOW = S.study === 1
  ? ['consent', 'controls', 's1_intro', 's1_home', 's1_list', 's1_reason', 's1_quiz', 's1_likert', 'debrief']
  : ['consent', 'controls', 's2_stigma', 's2_home', 's2_transfer', 's2_likert', 'debrief'];
let step = -1;
function next() { step += 1; const n = FLOW[step]; if (n) SCREENS[n](); }

/* ---------- 1. 동의 ---------- */
function consent() {
  const store = S.data;
  const b = el('button', { class: 'btn primary', text: '동의하고 시작하기', onclick: () => { logEv('consent'); next(); } });
  b.disabled = true;
  const ck = el('div', { class: 'choices' },
    el('button', {
      onclick: (e) => { e.currentTarget.classList.toggle('sel'); store.consent = e.currentTarget.classList.contains('sel'); b.disabled = !store.consent; },
    }, '위 내용을 읽고 참여에 동의합니다.'),
  );
  go('consent', () => shell({
    title: '연구 참여 동의',
    body: el('div', { class: 'survey' },
      el('h2', { text: '금융 의사결정 상황에 대한 연구' }),
      el('p', { class: 'lead', text: '본 연구는 금융 관련 의사결정 상황에서 사람들이 정보를 어떻게 판단하는지를 알아보기 위한 학술 연구입니다.' }),
      el('div', { class: 'doc' },
        el('h3', { text: '참여 안내' }),
        el('ul', {},
          el('li', { text: '소요 시간은 약 7~9분입니다.' }),
          el('li', { text: '연구 과정에서 실제 금전이 이동하는 일은 전혀 없습니다. 화면상의 모의 선택만 수행합니다.' }),
          el('li', { text: '모든 계좌번호·연락처·기관명은 실험용 가상 정보입니다.' }),
          el('li', { text: '응답은 익명으로 처리되며 통계 분석 목적으로만 사용됩니다.' }),
          el('li', { text: '언제든지 불이익 없이 참여를 중단할 수 있습니다.' }),
          el('li', { text: '연구 종료 직후 연구의 실제 목적을 설명하는 사후설명이 제공됩니다.' }),
        ),
      ),
      ck, el('div', { class: 'sticky-cta' }, b),
    ),
  }));
}

/* ---------- 2. 통제변수 ---------- */
function controls() {
  const st = S.data;
  const body = el('div', { class: 'survey' },
    el('h2', { text: '기본 정보' }),
    el('p', { class: 'lead', text: '통계 분석을 위한 기본 문항입니다. 정답이 없는 문항이니 편하게 응답해 주세요.' }),
    el('div', { class: 'progress' }, el('i', { style: 'width:15%' })),
  );
  CONTROLS.forEach((c) => body.append(choiceQ(c.id, c.q, c.opts, st)));
  body.append(el('div', { class: 'sect-title', text: '금융 이해 문항' }));
  FIN_KNOW.forEach((c) => body.append(choiceQ(c.id, c.q, c.opts, st)));
  body.append(el('div', { class: 'q' },
    el('div', { class: 'qt', text: FIN_SELF[1] }), scaleRow(FIN_SELF[0], st)));

  const need = [...CONTROLS.map((c) => c.id), ...FIN_KNOW.map((c) => c.id), FIN_SELF[0]];
  const btn = cta('다음', () => {
    FIN_KNOW.forEach((c) => setD(c.id + '_correct', st[c.id] === c.ans ? 1 : 0));
    setD('FK_score', FIN_KNOW.reduce((a, c) => a + (st[c.id] === c.ans ? 1 : 0), 0));
    next();
  });
  body.append(btn);
  go('controls', () => shell({ title: '기본 정보', body }));
  gate(btn.firstChild, () => need.every((k) => st[k] != null));
}

/* ================= STUDY 1 ================= */

function s1Intro() {
  go('s1_intro', () => shell({
    title: '안내',
    body: el('div', { class: 'survey' },
      el('h2', { text: '적금 상품을 하나 선택해 주세요' }),
      el('p', { class: 'lead', text: '지금부터 모바일 뱅킹 앱 화면이 나타납니다. 아래 조건을 가진 고객이라고 가정하고, 실제로 가입할 상품을 직접 고르시면 됩니다.' }),
      profileBox('내 금융 조건'),
      el('div', { class: 'note', text: '앱 화면에서 [예금·적금] 메뉴로 들어가 두 상품을 비교한 뒤 하나를 선택하세요. 실제 가입이 이루어지는 것은 아닙니다.' }),
      cta('앱으로 이동', () => next(), false),
    ),
  }));
}

function profileBox(title) {
  return el('div', { class: 'profilebox' },
    el('div', { class: 'ph', text: title }),
    el('ul', {},
      [PROFILE.salary, PROFILE.card, PROFILE.marketing, PROFILE.auto, PROFILE.term]
        .map((t) => el('li', { text: t })),
    ),
  );
}

function bankHome(onDeposit) {
  const b = el('div', {},
    el('div', { class: 'acct-card' },
      el('div', { class: 'an', text: BANK.accountName }),
      el('div', { class: 'no', text: BANK.accountNo }),
      el('div', { class: 'bal' }, won(BANK.balance), el('small', { text: '원' })),
      el('div', { class: 'row' },
        el('button', { text: '이체' }),
        el('button', { text: '거래내역' }),
      ),
    ),
    el('div', { class: 'quick' },
      [['예금·적금', '◈'], ['대출', '₩'], ['카드', '▣'], ['전체', '⋯']].map(([n, g]) =>
        el('button', {
          onclick: () => { logEv('quick_tap', { menu: n }); if (n === '예금·적금' && onDeposit) onDeposit(); },
        }, el('span', { class: 'glyph', text: g }), el('span', { text: n }))),
    ),
    el('div', { class: 'sect-title', text: '최근 거래' }),
    el('div', { class: 'card' },
      BANK.history.map((h) => el('div', { class: 'txn' },
        el('span', { class: 'd', text: h.d }),
        el('span', { class: 't', text: h.t }),
        el('span', { class: 'a' + (h.k === 'in' ? ' in' : ''), text: (h.k === 'in' ? '+' : '') + won(h.a) + '원' }),
      )),
    ),
  );
  return b;
}

function s1Home() {
  go('s1_home', () => shell({
    title: '홈', tab: '홈', tabbar: true,
    body: bankHome(() => next()),
  }));
}

/* ---- Study 1 상품 화면 ---- */
const S1 = { firstTapT: null, changes: 0, pending: null, openedAt: null, viewed: {} };

function s1List() {
  S1.openedAt = now();
  const key = S1_CONDITIONS[S.cond].key;
  const body = el('div', {});

  if (key === 'ad') {
    body.append(el('div', { class: 'note', text: '이벤트 안내 · 신규 가입 고객 대상 특별금리' }));
  }
  PRODUCTS.forEach((p) => {
    const headline = key === 'ad' || key === 'basic' ? p.max : p.base;
    const hl = key === 'ad' || key === 'basic' ? '최고금리' : '기본금리';
    const meta = key === 'ad'
      ? '우대조건 충족 시 최고금리 적용'
      : key === 'basic'
        ? `기본 연 ${p.base.toFixed(1)}% · 가입기간 ${p.term}`
        : `최고 연 ${p.max.toFixed(1)}% · 우대조건 ${p.benefits.length}개 · ${p.term}`;
    body.append(el('div', {
      class: 'prod',
      onclick: () => { logEv('product_open', { id: p.id }); S1.viewed[p.id] = true; s1Detail(p); },
    },
      el('div', { class: 'ph' },
        el('span', { class: 'pname', text: p.name }),
        key !== 'ad' ? el('span', { class: 'ptag', text: p.tag }) : null,
      ),
      el('div', { class: 'prate' },
        el('b', { text: `연 ${headline.toFixed(1)}%` }),
        el('span', { text: hl }),
      ),
      el('div', { class: 'pmeta', text: meta }),
      key === 'ai' ? el('div', { class: 'aibox', style: 'margin-top:10px;padding:10px 12px' },
        el('div', { class: 'ah' }, el('span', { class: 'badge', text: 'AI' }), '내 조건 기준 예상 적용금리'),
        el('div', { class: 'big', text: `연 ${p.applied.toFixed(1)}%` }),
      ) : null,
    ));
  });
  body.append(el('div', { class: 'note', text: '상품을 눌러 상세 내용을 확인하고, 가입할 상품을 선택해 주세요.' }));

  go('s1_list', () => shell({ title: '예금·적금', tab: '상품', tabbar: true, bordered: true, body, back: () => s1Home() }));
}

function s1Detail(p) {
  const key = S1_CONDITIONS[S.cond].key;
  const body = el('div', {});

  body.append(el('div', { class: 'card' },
    el('div', { class: 'ph', style: 'display:flex;align-items:baseline;gap:8px' },
      el('span', { class: 'pname', style: 'font-size:17px;font-weight:800', text: p.name }),
      key !== 'ad' ? el('span', { class: 'ptag', text: p.tag }) : null,
    ),
    el('div', { class: 'prate', style: 'margin-top:10px' },
      el('b', { style: 'font-size:28px', text: `연 ${(key === 'ad' || key === 'basic' ? p.max : p.base).toFixed(1)}%` }),
      el('span', { text: (key === 'ad' || key === 'basic') ? '최고금리' : '기본금리' }),
    ),
    key === 'ad' ? el('div', { class: 'pmeta', style: 'margin-top:8px', text: '우대조건을 모두 충족하는 경우 적용되는 최고금리입니다.' }) : null,
  ));

  if (key === 'basic') {
    body.append(el('div', { class: 'card' },
      row('기본금리', `연 ${p.base.toFixed(1)}%`),
      row('최고금리', `연 ${p.max.toFixed(1)}%`),
      row('가입기간', p.term),
      row('중도해지', p.early),
    ));
  }

  if (key === 'list' || key === 'ai') {
    /* ③·④ 정보 동등: 아래 원자료 블록은 두 조건에서 완전히 동일 */
    body.append(el('div', { class: 'sect-title', text: '금리 정보' }));
    body.append(el('div', { class: 'card' },
      row('기본금리', `연 ${p.base.toFixed(1)}%`),
      row('최고금리', `연 ${p.max.toFixed(1)}%`),
    ));
    body.append(el('div', { class: 'sect-title', text: '우대조건' }));
    const bcard = el('div', { class: 'card' });
    p.benefits.forEach((b) => {
      if (key === 'ai') {
        bcard.append(el('div', { class: 'bene' + (b.met ? '' : ' off') },
          el('span', { class: 'mk ' + (b.met ? 'y' : 'n'), text: b.met ? '✓' : '–' }),
          el('span', { class: 'bl' }, b.label, el('div', { class: 'bw', text: b.why })),
          el('span', { class: 'br', text: `+${b.rate.toFixed(1)}%p` }),
        ));
      } else {
        bcard.append(el('div', { class: 'rowline' },
          el('span', { class: 'k', text: b.label }),
          el('span', { class: 'v num', text: `+${b.rate.toFixed(1)}%p` }),
        ));
      }
    });
    body.append(bcard);
    body.append(el('div', { class: 'sect-title', text: '기타 조건' }));
    body.append(el('div', { class: 'card' },
      row('가입기간', p.term),
      row('중도해지', p.early),
      row('부분출금', p.liquidity),
    ));
    body.append(el('div', { class: 'sect-title', text: '주요 판단요인' }));
    body.append(el('div', { class: 'card' },
      el('ul', { style: 'list-style:none' }, p.factors.map((f) =>
        el('li', { style: 'font-size:13.5px;padding:5px 0 5px 13px;position:relative' },
          el('span', { style: 'position:absolute;left:2px;top:12px;width:4px;height:4px;border-radius:50%;background:var(--text-3);display:block' }), f))),
    ));
    body.append(profileBox('내 금융 조건'));

    if (key === 'ai') {
      const metSum = p.benefits.filter((b) => b.met).reduce((a, b) => a + b.rate, 0);
      const formula = `연 ${p.base.toFixed(1)}% + ` +
        p.benefits.filter((b) => b.met).map((b) => `${b.rate.toFixed(1)}%p`).join(' + ') +
        ` = 연 ${p.applied.toFixed(1)}%`;
      body.append(el('div', { class: 'aibox' },
        el('div', { class: 'ah' }, el('span', { class: 'badge', text: 'AI' }), '내 조건을 반영한 계산 결과'),
        el('div', { class: 'big', style: 'margin-top:6px', text: `예상 적용금리 연 ${p.applied.toFixed(1)}%` }),
        el('div', { class: 'calc', text: formula }),
        el('div', { class: 'calc', style: 'margin-top:6px', text: `충족 우대조건 ${p.benefits.filter((b) => b.met).length}개 (합계 +${metSum.toFixed(1)}%p) · 미충족 ${p.benefits.filter((b) => !b.met).length}개` }),
        el('div', { class: 'calc', style: 'margin-top:6px', text: `중도해지 ${p.early} · 부분출금 ${p.liquidity}` }),
        el('div', { class: 'alert-extra', style: 'border-top-color:#c9d9ff', text: '계산 결과만 제공하며 특정 상품을 추천하지 않습니다. 최종 선택은 고객님이 하십니다.' }),
      ));
    }
  }

  const other = PRODUCTS.find((x) => x.id !== p.id);
  body.append(el('div', { class: 'btnrow', style: 'margin-top:16px' },
    el('button', {
      class: 'btn ghost', text: `${other.name} 보기`,
      onclick: () => { logEv('product_switch', { to: other.id }); S1.viewed[other.id] = true; s1Detail(other); },
    }),
  ));
  body.append(el('div', { class: 'sticky-cta' },
    el('button', { class: 'btn primary', text: '이 상품 가입하기', onclick: () => s1Confirm(p) })));

  go('s1_detail_' + p.id, () => shell({
    title: '상품 상세', tab: '상품', tabbar: true, bordered: true, body, back: () => s1List(),
  }));
}

function row(k, v) {
  return el('div', { class: 'rowline' }, el('span', { class: 'k', text: k }), el('span', { class: 'v num', text: v }));
}

function s1Confirm(p) {
  if (S1.firstTapT == null) {
    S1.firstTapT = now() - S1.openedAt;
    setD('s1_first_choice', p.id);
    setD('s1_first_choice_rt_ms', S1.firstTapT);
  } else if (S1.pending && S1.pending !== p.id) {
    S1.changes += 1;
  }
  S1.pending = p.id;
  logEv('s1_tap_join', { id: p.id });

  const scrim = el('div', { class: 'scrim' });
  const sheet = el('div', { class: 'sheet' },
    el('div', { class: 'grab' }),
    el('div', { style: 'font-size:17px;font-weight:800;letter-spacing:-.01em', text: '가입 상품 확인' }),
    el('div', { class: 'card', style: 'margin-top:12px' },
      row('상품', p.name),
      row('가입기간', p.term),
      row('월 납입액', '300,000원'),
    ),
    el('div', { class: 'note', text: '모의 화면입니다. 실제 가입이나 출금은 발생하지 않습니다.' }),
    el('div', { class: 'actions' },
      el('button', {
        class: 'btn primary', text: '이 상품으로 가입 신청',
        onclick: () => {
          setD('s1_choice', p.id);
          setD('s1_final_rt_ms', now() - S1.openedAt);
          setD('s1_choice_changes', S1.changes);
          setD('s1_viewed_both', (S1.viewed.A && S1.viewed.B) ? 1 : 0);
          logEv('s1_choice_final', { id: p.id });
          scrim.remove(); sheet.remove();
          s1Done(p);
        },
      }),
      el('button', {
        class: 'btn ghost', text: '다시 비교하기',
        onclick: () => { logEv('s1_cancel', { id: p.id }); scrim.remove(); sheet.remove(); },
      }),
    ),
  );
  scrim.addEventListener('click', () => { scrim.remove(); sheet.remove(); });
  frame.append(scrim, sheet);
}

function s1Done(p) {
  go('s1_done', () => shell({
    title: '가입 완료',
    body: el('div', {},
      el('div', { class: 'done-hero' },
        el('div', { class: 'ring', text: '✓' }),
        el('h2', { text: '가입 신청이 접수되었습니다' }),
        el('p', { text: `${p.name} · ${p.term}` }),
      ),
      el('div', { class: 'note', text: '모의 화면이며 실제 가입은 이루어지지 않았습니다. 이어서 몇 가지 문항에 응답해 주세요.' }),
      cta('다음', () => next(), false),
    ),
  }));
}

function s1Reason() {
  const st = S.data;
  const ta = el('textarea', { placeholder: '예: 급여이체가 없어서 실제로 받을 수 있는 우대금리를 기준으로 비교했습니다. (최소 20자)' });
  const cc = el('div', { class: 'charcount', text: '0자' });
  const body = el('div', { class: 'survey' },
    el('h2', { text: '선택 이유' }),
    el('p', { class: 'lead', text: '방금 그 상품을 선택한 이유를 구체적으로 적어 주세요.' }),
    el('div', { class: 'q' }, el('div', { class: 'qt', text: '선택 이유 (최소 20자)' }), ta, cc),
    choiceQ(S1_PRIO.id, S1_PRIO.q, S1_PRIO.opts, st),
  );
  const btn = cta('다음', () => { setD('OR1', ta.value.trim()); next(); });
  body.append(btn);
  ta.addEventListener('input', () => { cc.textContent = ta.value.trim().length + '자'; refreshGate(); });
  go('s1_reason', () => shell({ title: '선택 이유', body }));
  gate(btn.firstChild, () => ta.value.trim().length >= 20 && st[S1_PRIO.id] != null);
}

function s1Quiz() {
  const st = S.data;
  const body = el('div', { class: 'survey' },
    el('h2', { text: '상품 정보 확인 문항' }),
    el('p', { class: 'lead', text: '방금 확인한 상품 내용에 대한 문항입니다. 상품 화면으로는 돌아갈 수 없으며, 모르는 경우 가장 가깝다고 생각하는 답을 골라 주세요.' }),
    profileBox('내 금융 조건 (참고)'),
  );
  S1_QUIZ.forEach((q) => body.append(choiceQ(q.id, q.q, q.opts, st)));
  const btn = cta('다음', () => {
    let sc = 0;
    S1_QUIZ.forEach((q) => { const ok = st[q.id] === q.ans ? 1 : 0; setD(q.id + '_correct', ok); sc += ok; });
    setD('UC_score', sc);
    scoreSuitability();
    next();
  });
  body.append(btn);
  go('s1_quiz', () => shell({ title: '확인 문항', body }));
  gate(btn.firstChild, () => S1_QUIZ.every((q) => st[q.id] != null));
}

/* 의사결정 적합성 0~100점 루브릭 (논문 표 6) */
function scoreSuitability() {
  const st = S.data;
  const acc = st.UC3_correct === 1 ? 30 : 0;                 // 적용금리 비교 정확성 30
  const early = st.UC4_correct === 1 ? 15 : 0;               // 중도해지 조건 이해 15
  const prio = st[S1_PRIO.id];                               // 0=적용금리 1=유동성 2=광고최고금리 3=직관
  const ch = st.s1_choice;
  let coh = 0;                                               // 선택-기준 정합성 30
  if (prio === 0) coh = ch === 'A' ? 30 : 15;
  else if (prio === 1) coh = ch === 'B' ? 30 : 15;
  else coh = 0;
  const txt = (st.OR1 || '');
  const hits = SUIT_KEYWORDS.filter((k) => txt.includes(k)).length;
  const grounded = Math.min(hits, 3) / 3 * 15;               // 근거의 자기조건 대조 15
  const both = st.s1_viewed_both === 1 ? 10 : 0;             // 두 상품 모두 확인 10
  setD('SUIT_rate_accuracy', acc);
  setD('SUIT_early_terms', early);
  setD('SUIT_coherence', coh);
  setD('SUIT_grounded', Math.round(grounded));
  setD('SUIT_compared', both);
  setD('SUIT_total_100', Math.round(acc + early + coh + grounded + both));
  setD('SUIT_keyword_hits', hits);
  setD('BIAS_headline_rate', prio === 2 ? 1 : 0);
}

function s1Likert() {
  const st = S.data;
  const body = el('div', { class: 'survey' },
    el('h2', { text: '방금 화면에 대한 평가' }),
    el('p', { class: 'lead', text: '방금 확인한 상품 화면을 떠올리며 응답해 주세요. 정답은 없습니다.' }),
    el('div', { class: 'progress' }, el('i', { style: 'width:80%' })),
  );
  S1_LIKERT.forEach((b) => body.append(likertBlock(b, st)));
  const ids = S1_LIKERT.flatMap((b) => b.items.map((i) => i[0]));
  const btn = cta('다음', () => next());
  body.append(btn);
  go('s1_likert', () => shell({ title: '설문', body }));
  gate(btn.firstChild, () => ids.every((k) => st[k] != null));
}

/* ================= STUDY 2 ================= */

function s2Stigma() {
  const st = S.data;
  const body = el('div', { class: 'survey' },
    el('h2', { text: '일반적인 생각에 대한 문항' }),
    el('p', { class: 'lead', text: '일반적으로 어떻게 생각하시는지 응답해 주세요. 특정 상황을 가정하지 않아도 됩니다.' }),
    el('div', { class: 'progress' }, el('i', { style: 'width:25%' })),
  );
  body.append(likertBlock({ title: '도움 요청에 대한 생각', items: S2_STIGMA }, st));
  const btn = cta('다음', () => {
    const v = S2_STIGMA.map(([id]) => st[id]);
    setD('STIGMA_mean', Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 100) / 100);
    next();
  });
  body.append(btn);
  go('s2_stigma', () => shell({ title: '설문', body }));
  gate(btn.firstChild, () => S2_STIGMA.every(([id]) => st[id] != null));
}

function s2Home() {
  go('s2_home', () => {
    shell({ title: '홈', tab: '홈', tabbar: true, body: bankHome(null) });
    setTimeout(() => { if (S.screen === 's2_home') s2Call(); }, 1600);
  });
}

function s2Call() {
  logEv('s2_call_start');
  const lines = el('div', { class: 'lines' });
  let i = 0;
  const timer = el('div', { class: 'ct', text: '00:03' });
  let sec = 3;
  const tick = setInterval(() => {
    sec += 1;
    timer.textContent = `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
  }, 1000);

  const nextBtn = el('button', { class: 'cbtn', text: '계속 듣기' });
  const endBtn = el('button', { class: 'cbtn end', style: 'margin-top:8px', text: '통화 종료 후 이체 화면으로' });
  endBtn.style.display = 'none';

  function addLine() {
    if (i >= S2_SCENARIO.lines.length) return;
    lines.append(el('div', { class: 'bubble', text: S2_SCENARIO.lines[i] }));
    lines.scrollTop = lines.scrollHeight;
    logEv('s2_call_line', { i });
    i += 1;
    if (i >= S2_SCENARIO.lines.length) { nextBtn.style.display = 'none'; endBtn.style.display = 'block'; }
  }
  nextBtn.addEventListener('click', addLine);
  endBtn.addEventListener('click', () => {
    clearInterval(tick);
    logEv('s2_call_end', { sec });
    setD('s2_call_sec', sec);
    call.remove();
    next();
  });

  const call = el('div', { class: 'callscreen' },
    el('div', { class: 'ci' },
      el('div', { class: 'cl', text: '수신 통화' }),
      el('div', { class: 'cn', text: S2_SCENARIO.caller }),
      el('div', { class: 'cno', text: S2_SCENARIO.callerNo }),
      timer,
    ),
    lines,
    nextBtn, endBtn,
  );
  frame.append(call);
  addLine();
}

/* ---- Study 2 이체 화면 ---- */
const S2 = { firstT: null, changes: 0, sel: null, openedAt: null, alertShown: null };

function s2Transfer() {
  S2.openedAt = now();
  let amount = 0;
  const disp = el('div', { class: 'amount-display empty', text: '보낼 금액 입력' });
  const okBtn = el('button', { class: 'btn primary', text: '이체하기' });
  okBtn.disabled = true;

  function draw() {
    if (amount === 0) { disp.className = 'amount-display empty'; disp.textContent = '보낼 금액 입력'; okBtn.disabled = true; }
    else { disp.className = 'amount-display'; disp.textContent = won(amount) + '원'; okBtn.disabled = false; }
  }
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '100만', '0', '←'];
  const pad = el('div', { class: 'keypad' }, keys.map((k) => el('button', {
    class: (k === '100만' || k === '←') ? 'fn' : '', text: k,
    onclick: () => {
      if (k === '←') amount = Math.floor(amount / 10);
      else if (k === '100만') amount = Math.min(amount + 1000000, 99999999);
      else amount = Math.min(amount * 10 + Number(k), 99999999);
      logEv('s2_amount', { amount }); draw();
    },
  })));

  const body = el('div', {},
    el('div', { class: 'field' }, el('label', { text: '출금 계좌' }),
      el('div', { class: 'box muted', text: `${BANK.accountName} · ${BANK.accountNo}` })),
    el('div', { class: 'field' }, el('label', { text: '받는 분' }),
      el('div', { class: 'box', text: S2_SCENARIO.payee })),
    el('div', { class: 'field' }, el('label', { text: '입금 계좌' }),
      el('div', { class: 'box muted', text: `${S2_SCENARIO.payeeBank} ${S2_SCENARIO.payeeAcct}` })),
    el('div', { class: 'field' }, el('label', { text: '보낼 금액' }), disp),
    pad,
    el('div', { class: 'warnnote', text: `통화 중 안내: 3시간 이내 ${won(S2_SCENARIO.amount)}원 이체 요청` }),
    el('div', { class: 'sticky-cta' }, okBtn),
  );
  okBtn.addEventListener('click', () => { setD('s2_amount_entered', amount); s2Alert(); });

  go('s2_transfer', () => shell({ title: '이체', tab: '이체', tabbar: true, bordered: true, body }));
}

function s2Alert() {
  const a = S2_ALERTS[S.cond];
  logEv('s2_alert_shown', { cond: S.cond, has: !!a });
  S2.openedAt = now();

  const scrim = el('div', { class: 'scrim' });
  const sheet = el('div', { class: 'sheet' }, el('div', { class: 'grab' }));

  if (a) {
    const wrap = el('div', { class: `alert-wrap tone-${a.tone}` },
      el('div', { class: 'alert-head' },
        el('span', { class: 'badge', text: 'AI' }),
        el('span', { class: 'lbl', text: '금융보호 알림' }),
      ),
      el('div', { class: 'alert-title', text: a.title }),
      a.bullets.length ? el('ul', { class: 'alert-list' }, a.bullets.map((b) => el('li', { text: b }))) : null,
      a.extra ? el('div', { class: 'alert-extra', text: a.extra }) : null,
      S.cond >= 4 ? el('div', { class: 'alert-contact', text: '금융 관련 상담·신고: 금융감독원 1332 / 경찰 신고: 112' }) : null,
    );
    sheet.append(wrap);
  } else {
    sheet.append(el('div', { style: 'font-size:17px;font-weight:800', text: '이체 내용 확인' }),
      el('div', { class: 'card', style: 'margin-top:12px' },
        row('받는 분', S2_SCENARIO.payee),
        row('입금 계좌', S2_SCENARIO.payeeAcct),
        row('보낼 금액', won(S.data.s2_amount_entered || 0) + '원'),
      ));
  }

  const actions = el('div', { class: 'actions' });
  const confirm = el('button', { class: 'btn primary', text: '선택 확정' });
  confirm.disabled = true;
  S2_ACTIONS.forEach((act) => {
    const b = el('button', {
      class: 'abtn',
      onclick: () => {
        if (S2.firstT == null) {
          S2.firstT = now() - S2.openedAt;
          setD('s2_first_action', act.id);
          setD('s2_first_action_rt_ms', S2.firstT);
        } else if (S2.sel && S2.sel !== act.id) S2.changes += 1;
        S2.sel = act.id;
        [...actions.querySelectorAll('.abtn')].forEach((x) => x.classList.remove('sel'));
        b.classList.add('sel');
        confirm.disabled = false;
        logEv('s2_action_tap', { id: act.id });
      },
    }, el('span', { text: act.label }), el('span', { class: 'chev', text: '›' }));
    actions.append(b);
  });
  confirm.addEventListener('click', () => {
    const act = S2_ACTIONS.find((x) => x.id === S2.sel);
    setD('s2_action', act.id);
    setD('s2_action_kind', act.kind);
    setD('s2_final_rt_ms', now() - S2.openedAt);
    setD('s2_action_changes', S2.changes);
    setD('s2_proceed_binary', act.id === 'proceed' ? 1 : 0);
    logEv('s2_action_final', { id: act.id });
    scrim.remove(); sheet.remove();
    s2Ack(act);
  });
  sheet.append(el('div', { class: 'sect-title', text: '어떻게 하시겠습니까?' }), actions, el('div', { style: 'margin-top:10px' }, confirm));
  frame.append(scrim, sheet);
}

function s2Ack(act) {
  const msg = act.id === 'proceed'
    ? '이체 요청이 접수되었습니다.'
    : act.id === 'stop' ? '이체가 중단되었습니다.'
      : act.id === 'hold_verify' ? '이체를 보류했습니다.' : '이체를 보류하고 검색 화면으로 이동합니다.';
  go('s2_ack', () => shell({
    title: '처리 결과',
    body: el('div', {},
      el('div', { class: 'done-hero' },
        el('div', { class: 'ring', text: act.id === 'proceed' ? '!' : '✓' }),
        el('h2', { text: msg }),
        el('p', { text: '모의 화면이며 실제 금전은 이동하지 않았습니다.' }),
      ),
      cta('다음', () => next(), false),
    ),
  }));
}

function s2Likert() {
  const st = S.data;
  const body = el('div', { class: 'survey' },
    el('h2', { text: '방금 상황에 대한 문항' }),
    el('p', { class: 'lead', text: '방금 화면에서 경험한 상황을 떠올리며 응답해 주세요.' }),
    el('div', { class: 'progress' }, el('i', { style: 'width:80%' })),
  );
  const blocks = [...S2_LIKERT];
  if (S.cond >= 4) blocks.push({ title: '안내 방식에 대한 느낌', items: S2_REACT });
  blocks.forEach((b) => body.append(likertBlock(b, st)));
  const ids = blocks.flatMap((b) => b.items.map((i) => i[0]));
  const btn = cta('다음', () => next());
  body.append(btn);
  go('s2_likert', () => shell({ title: '설문', body }));
  gate(btn.firstChild, () => ids.every((k) => st[k] != null));
}

/* ---------- 사후설명 ---------- */
function debrief() {
  const st = S.data;
  const code = 'CAFAI-' + Math.random().toString(36).slice(2, 8).toUpperCase();
  setD('completion_code', code);
  setD('finishedAt', new Date().toISOString());
  setD('total_ms', now() - S.t0);
  if (S.screen) setD('dwell_' + S.screen + '_ms', (st['dwell_' + S.screen + '_ms'] || 0) + (now() - S.screenT0));

  const body = el('div', { class: 'survey' },
    el('h2', { text: '연구 안내 (사후설명)' }),
    el('div', { class: 'doc' },
      S.study === 2 ? el('p', { html: '<strong>방금 보신 상황은 실제가 아닌 가상의 금융사기 시나리오였습니다.</strong> 연구 목적상 사전에 사기 여부를 알려드리지 않았습니다. 불편을 드렸다면 양해를 부탁드립니다.' }) : null,
      el('p', { text: '본 연구는 금융 AI가 상황에 따라 설명과 개입 방식을 달리할 때 소비자의 이해와 판단이 어떻게 달라지는지를 검증하기 위한 학술 연구입니다. 참가자는 여러 조건 중 하나에 무작위로 배정되었습니다.' }),
      el('p', { text: '화면에 나온 은행명, 상품, 계좌번호, 전화번호, 기관명은 모두 실험용 가상 정보이며 실제 금전 거래는 발생하지 않았습니다.' }),
      S.study === 2 ? el('div', { class: 'note', text: '실제로 유사한 연락을 받으신 경우: 금융감독원 1332 또는 경찰 112로 문의하시고, 안내받은 번호나 링크가 아닌 기관의 공식 대표번호를 직접 확인하세요.' }) : null,
      el('h3', { text: '자료 활용 재동의' }),
      el('p', { text: '위 설명을 확인한 뒤에도 본인의 응답 자료를 연구에 사용하는 것에 동의하십니까?' }),
    ),
  );
  const reuse = el('div', { class: 'choices' });
  ['동의합니다 (자료 사용)', '동의하지 않습니다 (자료 제외 요청)'].forEach((t, i) => {
    reuse.append(el('button', {
      onclick: (e) => {
        [...reuse.children].forEach((b) => b.classList.remove('sel'));
        e.currentTarget.classList.add('sel');
        setD('reconsent', i === 0 ? 1 : 0);
        refreshGate();
      },
    }, t));
  });
  body.append(reuse);

  const post = el('div', {},
    el('div', { class: 'sect-title', text: '마지막 점검 문항' }),
    el('div', { class: 'q' }, el('div', { class: 'qt', text: '실험 중 제시된 상황이 실제 상황과 비슷하게 느껴졌습니까?' }), scaleRow('PC1', st)),
    el('div', { class: 'q' }, el('div', { class: 'qt', text: '이 연구의 목적을 응답 전에 짐작하고 있었습니까?' }), scaleRow('PC2', st)),
  );
  body.append(post);

  const fin = el('button', { class: 'btn primary', text: '응답 제출하고 마치기' });
  fin.disabled = true;
  fin.addEventListener('click', () => {
    logEv('submit');
    if (S.redirect) { location.href = S.redirect + (S.redirect.includes('?') ? '&' : '?') + 'code=' + code; return; }
    finish(code);
  });
  body.append(el('div', { class: 'sticky-cta' }, fin));
  go('debrief', () => shell({ title: '사후설명', body }));
  gate(fin, () => st.reconsent != null && st.PC1 != null && st.PC2 != null);
}

function rowsForExport() {
  return {
    participant_id: S.pid, prolific_study_id: S.studyId, prolific_session_id: S.sessionId,
    study: S.study, condition: S.cond,
    condition_label: (S.study === 1 ? S1_CONDITIONS : S2_CONDITIONS)[S.cond].label,
    started_at: S.startedAt, ...S.data,
  };
}

function finish(code) {
  const rec = rowsForExport();
  const body = el('div', {},
    el('div', { class: 'done-hero' },
      el('div', { class: 'ring', text: '✓' }),
      el('h2', { text: '참여가 완료되었습니다' }),
      el('p', { text: '아래 완료 코드를 설문 플랫폼에 입력해 주세요.' }),
    ),
    el('div', { class: 'code', text: code }),
    el('div', { class: 'note', text: '창을 닫으시면 됩니다. 연구에 참여해 주셔서 감사합니다.' }),
    el('div', { class: 'btnrow', style: 'margin-top:16px' },
      el('button', { class: 'btn ghost', text: 'CSV 저장', onclick: () => dl(toCsv(rec), `resp_S${S.study}_c${S.cond}_${code}.csv`, 'text/csv') }),
      el('button', { class: 'btn ghost', text: 'JSON 저장', onclick: () => dl(JSON.stringify({ ...rec, events: S.events }, null, 2), `resp_S${S.study}_c${S.cond}_${code}.json`, 'application/json') }),
    ),
  );
  go('finish', () => shell({ title: '완료', body }));
}

function toCsv(o) {
  const ks = Object.keys(o);
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""').replace(/\n/g, ' ')}"`;
  return '\uFEFF' + ks.join(',') + '\n' + ks.map((k) => esc(o[k])).join(',') + '\n';
}
function dl(text, name, mime) {
  const a = el('a', { href: URL.createObjectURL(new Blob([text], { type: mime })), download: name });
  document.body.append(a); a.click(); a.remove();
}

/* ---------------- 등록 ---------------- */
const SCREENS = {
  consent, controls,
  s1_intro: s1Intro, s1_home: s1Home, s1_list: s1List,
  s1_reason: s1Reason, s1_quiz: s1Quiz, s1_likert: s1Likert,
  s2_stigma: s2Stigma, s2_home: s2Home, s2_transfer: s2Transfer, s2_likert: s2Likert,
  debrief,
};
window.__EXP = { S, next, go: (n) => SCREENS[n] && SCREENS[n]() };
next();
