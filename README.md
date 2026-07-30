# The Fallen (Prototype)

Phaser 3 기반의 스팀펑크 픽셀 액션 게임 프로토타입입니다.

구성 및 실행

1. 의존성 설치

```bash
npm install
```

2. 개발 서버 실행

```bash
npm run dev
```

3. 빌드 및 배포

```bash
npm run build
npm run deploy
```

키 바인딩(현재)
- WASD: 이동/점프
- 마우스 좌클릭: 현재 무기 공격
- Z: 앞으로 대시

화면/카메라
- 16:9 비율 기준으로 확대/축소
- 가로로 긴 스테이지 + 플레이어 추적 카메라
- HUD는 카메라와 분리되어 고정 표시

