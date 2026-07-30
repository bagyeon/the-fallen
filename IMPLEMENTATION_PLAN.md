@"
**계획 문서: 스팀펑크 픽셀 액션 게임 (the-fallen)**

요약: Phaser 3 기반 HTML+JavaScript 웹게임을 제작합니다. 좌→우 액션(플랫폼 요소 포함), WASD 조작, 리볼버(6발+재장전)·진동 도검, 픽셀 아트(캐릭터 128×128), 총 10 스테이지 + 보스, 오디오는 무료 리소스 사용, 배포는 GitHub Pages(`bagyeon` 계정).

**목표**
- 데스크톱 웹에서 즉시 플레이 가능한 시연용 사이트 제공
- 기본 게임플레이(이동/공격/무기 전환/스테이지 흐름) 동작 보장

**구현 단계 (요약)**
- 1: 프로젝트 초기화 — `npm init -y`, `npm install phaser`, dev: `vite`, `gh-pages`
- 2: 파일·폴더 생성 — `index.html`, `package.json`(스크립트), `src/`, `assets/`
- 3: 씬 구조 구현 — `Boot` → `Title` → `Stage(N)` → `Boss` → `End`
- 4: 플레이어 구현 — WASD 이동, 발사(리볼버 6발+재장전), 근접(도검 차지·진동 히트)
- 5: 적·스폰 시스템 및 기본 AI (3~5종 적)
- 6: 레벨(타일맵) 기본 구현 — 높낮이 있는 플랫폼, 파럴랙스 배경
- 7: UI·사운드 — HUD(체력/탄약/스테이지), 무료 BGM/SFX 적용
- 8: 빌드·배포 — Git 초기화, GitHub(`bagyeon/the-fallen`) 푸시, `gh-pages`로 배포
- 9: 검증 및 폴리싱 — 입력 반응성, 밸런스, 메모리/로딩 최적화

**생성될 파일(주요)**
- `index.html` — 엔트리
- `package.json` — 스크립트: `dev`, `build`, `deploy`
- `src/main.js` — Phaser 게임 초기화
- `src/scenes/BootScene.js`, `TitleScene.js`, `StageScene.js`, `BossScene.js`, `EndScene.js`
- `src/entities/Player.js`, `Bullet.js`, `MeleeHit.js`, `Enemy.js`, `Boss.js`
- `assets/sprites/` `assets/tilemaps/` `assets/sfx/` `assets/music/`
- `README.md` — 실행/배포 방법

**주요 기술·설정**
- 엔진: Phaser 3
- 빌드 툴: Vite (개발 서버 + 빌드)
- 배포: GitHub Pages (`gh-pages` 패키지)
- 픽셀 아트 기준: 캐릭터 128×128 (placeholder → 아트 교체)
- 오디오: 무료 리소스 사용(추후 교체 가능)

**package.json 예시 스크립트**
- "dev": "vite"
- "build": "vite build"
- "preview": "vite preview"
- "deploy": "gh-pages -d dist"

**배포(간단 절차)**
- 로컬: `npm run build` → `dist/` 생성
- 배포: `npm run deploy` → GitHub Pages에 콘텐츠 업로드
- 예상 URL: `https://bagyeon.github.io/the-fallen/`

**검증 항목**
- 타이틀 진입 및 스테이지 선택 가능
- WASD로 플레이어 이동(좌/우/점프) 확인
- 리볼버: 6발 발사 → 탄약 0 → 재장전 동작 확인
- 도검: 차지 후 넓은 히트박스 적용 확인
- 스테이지 클리어 → 타이틀 복귀 → 다음 스테이지 진입 플로우 확인
- 보스전 페이즈 전환 및 승리 시 엔딩 씬 확인
- 배포 URL 접속 시 동일 동작 확인

**결정/전제 사항(현재)**
- 엔진: Phaser 3 (확정)
- 픽셀 해상도: 128×128 (확정)
- 오디오: 무료 리소스 사용 (확정)
- 호스팅: GitHub Pages, 계정 `bagyeon` (확정)

**다음 작업(원하시면 제가 실행)**
- 스캐폴드 생성 → 로컬 실행 확인 → GitHub 저장소 생성(`bagyeon/the-fallen`) → 푸시 → `gh-pages` 배포
- 작업 진행 시 생성된 주요 파일들을 단계별로 보고 드림
"@ | Out-File -FilePath .\IMPLEMENTATION_PLAN.md -Encoding utf8