# LoanCalc · 대출 상환 계산기

서버·DB 없는 정적 사이트 (HTML/CSS/JS). 계산은 모두 브라우저에서 이루어집니다.

## 실행
- `index.html`을 브라우저로 열면 바로 동작합니다. (GitHub 저장 기능은 `http(s)://` 환경, 예: GitHub Pages에서 사용하세요.)
- 로컬 서버 예: `npx http-server .`

## 테스트
```
npm test
```
`tests/`의 계산(검증값 3종 포함)·검증·저장 형식 테스트를 Node 내장 러너로 실행합니다. 설치할 패키지는 없습니다.

## GitHub Pages 배포
저장소 Settings → Pages → Branch: `main` / root 로 지정합니다.

## 결과 저장용 GitHub 연결
1. **별도의 Private 저장소**를 만듭니다. (예: `loan-data`, 최소 1개 커밋 필요 — README 추가 등)
2. GitHub → Settings → Developer settings → Fine-grained tokens에서 토큰을 발급합니다.
   - Repository access: 위 저장소만 선택
   - Permissions → **Contents: Read and write** (그 외 권한 불필요)
3. 앱의 "GitHub 연결 설정"에 아이디, 저장소, 브랜치(기본 main), 폴더(기본 results), 토큰을 입력하고 연결합니다.

토큰은 이 브라우저에만 저장됩니다. "토큰 기억하기"를 켜면 localStorage, 끄면 sessionStorage(탭을 닫으면 삭제)입니다. 공용 PC에서는 끄고, 사용 후 "연결 해제"를 누르세요.

## 구조
| 파일 | 역할 |
|---|---|
| `js/calc.js` | 상환 계산 (DOM 무관, Node 겸용) |
| `js/validate.js` | 입력 검증·오류 문구 |
| `js/format.js` | 콤마, 한글 단위, 파일명 |
| `js/storage.js` | JSON 생성/호환 파싱, CSV |
| `js/github.js` | Contents API, 연결 설정 |
| `js/chart.js`, `js/schedule.js` | 차트, 스케줄표 |
| `js/app.js` | 화면 연결 |
