# 상황 적응형 금융 AI 실험 — 웹 자극물

KMAC 공모전 논문용 온라인 실험 자극물입니다. 정적 파일만으로 동작하며 빌드 과정이 없습니다.
개인 연구용 자료입니다.

## 파일

| 파일 | 역할 |
|---|---|
| `index.html` | 진입점 |
| `styles.css` | 전체 스타일 |
| `app.js` | 화면 흐름·기록·채점 로직 (ES module) |
| `data.js` | 자극물 문구·문항·수치 데이터 |
| `.nojekyll` | GitHub Pages가 파일을 그대로 서빙하도록 하는 표시 |

## 실행

정적 호스팅에 4개 파일(`index.html`, `styles.css`, `app.js`, `data.js`)과 `.nojekyll`을
루트에 올리면 됩니다. `file://`로 직접 열면 ES module 보안 정책 때문에 동작하지 않습니다.

로컬 확인:

```
npx serve .
```

## URL 파라미터

| 파라미터 | 값 | 설명 |
|---|---|---|
| `study` | `1` \| `2` | 연구 지정. 없으면 무작위 |
| `cond` | Study 1은 1~4, Study 2는 1~5 | 조건 지정. 없으면 무작위 |
| `endpoint` | URL | 응답을 POST로 보낼 주소 |
| `redirect` | URL | 제출 후 돌아갈 주소 (`?code=`, `&ok=` 자동 부착) |
| `PROLIFIC_PID` / `STUDY_ID` / `SESSION_ID` | 문자열 | 패널 식별자 기록 |
| `admin` | `1` | 개발용 단계 건너뛰기 바 표시. 본조사에서는 절대 사용 금지 |

예시: `https<!---->://USER.github.io/REPO/?study=1&endpoint=https://script.google.com/.../exec`

## 참가자 배포 URL

무작위 배정을 앱에 맡기려면 `study`만 지정하세요.

- Study 1: `?study=1`
- Study 2: `?study=2`

조건까지 고정해 배포하려면 `&cond=` 를 붙입니다.
