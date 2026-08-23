# F1 Live Timing v0.1

완료된 Formula 1 Race 세션을 OpenF1 데이터로 불러와 시간순으로 재생하는 웹 기반 라이브 타이밍 프로토타입입니다.

## v0.1 기능

- 2023년 이후 완료된 Race 세션 목록 불러오기
- 실제 Position / Interval / Lap 데이터 Replay
- 타이어 Compound / Tyre Age 표시
- Pit 횟수 표시
- Race Control 메시지
- Track Status (Green / Yellow / Red / SC / VSC / Chequered)
- Weather 표시
- 1x / 4x / 10x / 30x / 60x Replay
- 타임라인 Seek / Restart
- Session Best(보라) / Personal Best(초록) 랩타임 강조
- 모바일 반응형 UI
- OpenF1 장애 또는 로컬 프록시 미사용 시 Demo Replay fallback

## 파일 구조

```text
f1-live-timing-v0.1/
├─ index.html
├─ styles.css
├─ app.js
├─ api/
│  └─ openf1.js
├─ package.json
├─ vercel.json
└─ README.md
```

## Vercel 배포

이 폴더를 GitHub 저장소에 올린 뒤 Vercel에서 Import 하면 됩니다. 별도의 Build Command나 API Key는 v0.1에서 필요하지 않습니다.

브라우저는 `/api/openf1`을 호출하고, Vercel Serverless Function이 OpenF1 Historical API를 대신 호출합니다.

## 로컬 확인

```bash
python -m http.server 8080
```

그 후 `http://localhost:8080`으로 접속합니다. 단, 일반 Python HTTP 서버에서는 `/api/openf1` 서버리스 함수가 실행되지 않으므로 앱이 OpenF1 직접 호출을 시도하고, 그것도 실패하면 Demo Replay로 전환합니다.

Vercel CLI가 있다면 프로젝트 루트에서 `vercel dev`를 사용하는 편이 실제 배포 환경과 가장 가깝습니다.

## 다음 버전 계획

- v0.2: Practice / Qualifying / Sprint / Race 자동 UI 전환
- v0.3: Sector / Pit 상태 / Race Control 표현 강화
- v0.4: Location 기반 서킷 차량 위치 맵
- v0.5: 선택 드라이버 Telemetry (Speed/RPM/Gear/Throttle/Brake/DRS)
- v0.9: OpenF1 Real-time 인증 + 실시간 스트림/폴링 계층
- v1.0: 실제 세션 자동 감지 및 완전 자동 Live Timing

## 데이터

OpenF1은 비공식 Formula 1 데이터 API입니다. Historical data는 2023년 이후 제공되며, 실시간 데이터는 별도의 인증/구독 정책을 따릅니다.
