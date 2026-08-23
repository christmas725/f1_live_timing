# F1 Live Timing v0.1.2

완료된 Formula 1 Race 세션을 OpenF1 데이터로 불러와 시간순으로 재생하는 웹 기반 라이브 타이밍 프로토타입입니다.

## v0.1 기본 기능

- 2023년 이후 완료된 Race 세션 목록 불러오기
- Position / Interval / Lap 데이터 Replay
- 타이어 Compound / Tyre Age 표시
- Pit 횟수 표시
- Race Control 메시지
- Track Status (Green / Yellow / Red / SC / VSC / Chequered)
- Weather 표시
- 1x / 4x / 10x / 30x / 60x Replay
- 타임라인 Seek / Restart
- Session Best(보라) / Personal Best(초록) 랩타임 강조
- 모바일 반응형 UI

## v0.1.1 Hotfix

- Vercel 비프레임워크 JavaScript Function을 ESM/Web Handler 형식으로 변경
- `package.json`에 `"type": "module"` 추가
- `/api/openf1`이 `Request` / `Response` Web API를 사용하도록 수정

## v0.1.2 Live Lock / Offline Replay Hotfix

OpenF1은 F1 라이브 세션 시간대에 비인증 사용자의 전역 API 접근을 제한할 수 있습니다. v0.1.2부터 이 상태를 일반 서버 오류와 구분합니다.

Fallback 순서는 다음과 같습니다.

```text
OpenF1 Historical API
        ↓ 실패 / Live Lock
Local Historical Cache
2025 Abu Dhabi GP Laps 1–7
        ↓ 파일 오류
Demo Replay
```

### Local Historical Cache

`data/local-2025-abu-dhabi-l1-7.json`

- 2025 Abu Dhabi Grand Prix의 실제 1~7랩 Historical Snapshot
- 실제 Lap Time
- 실제 Lap Position
- 실제 Gap to Leader
- Interval은 각 랩의 인접 차량 Gap 차이로 계산
- Starting Grid 및 첫 Stint 길이 포함
- 경량 fallback 데이터이므로 Tyre Compound, Pit Stop, Weather는 포함하지 않음
- OpenF1이 잠긴 경기 주말에도 실제 기록 기반으로 Replay UI를 테스트하기 위한 용도

Historical snapshot 작성 시 FIA 2025 Abu Dhabi GP Timing Information과 공개된 2025 Abu Dhabi GP timing tables를 대조했습니다.

## 파일 구조

```text
f1-live-timing-v0.1.2/
├─ index.html
├─ styles.css
├─ app.js
├─ data/
│  └─ local-2025-abu-dhabi-l1-7.json
├─ api/
│  └─ openf1.js
├─ package.json
├─ vercel.json
└─ README.md
```

## Vercel 배포

이 폴더의 **내용 전체를 기존 GitHub 저장소 루트에 덮어쓴 뒤 Commit/Push**하면 됩니다.

별도의 Build Command는 필요하지 않습니다.

정상적인 파일 배치는 아래와 같아야 합니다.

```text
/
├─ index.html
├─ app.js
├─ styles.css
├─ package.json
├─ vercel.json
├─ data/
│  └─ local-2025-abu-dhabi-l1-7.json
└─ api/
   └─ openf1.js
```

배포 후 프록시 확인 주소:

```text
/api/openf1?endpoint=sessions&year=2026&session_name=Race
```

- 평상시: JSON 배열 → OpenF1 Historical 정상
- 라이브 세션 중: `Live F1 session in progress...` → OpenF1 Live Lock 정상 감지 대상
- 메인 화면에서는 Live Lock 시 Local Cache가 선택 가능한 상태로 표시됨

## 로컬 확인

```bash
python -m http.server 8080
```

그 후 `http://localhost:8080`으로 접속합니다. 일반 Python HTTP 서버에서는 `/api/openf1` 서버리스 함수가 실행되지 않으므로 OpenF1 직접 호출을 시도한 뒤 필요하면 Local Cache로 fallback합니다.

Vercel CLI가 있다면 프로젝트 루트에서 `vercel dev`를 사용하는 편이 실제 배포 환경과 가장 가깝습니다.

## 다음 버전 계획

- v0.2: Practice / Qualifying / Sprint / Race 자동 UI 전환
- v0.3: Sector / Pit 상태 / Race Control 표현 강화
- v0.4: Location 기반 서킷 차량 위치 맵
- v0.5: 선택 드라이버 Telemetry (Speed/RPM/Gear/Throttle/Brake/DRS)
- v0.9: OpenF1 Real-time 인증 + WebSocket/MQTT 계층
- v1.0: 실제 세션 자동 감지 및 완전 자동 Live Timing

## OpenF1 요금 관련

OpenF1의 Historical 데이터는 개인 용도 기준 무료이며, 실시간 데이터가 필요한 Sponsor 플랜은 별도 월 구독입니다. 인증 정보는 향후 v0.9에서 Vercel 환경변수에만 저장하도록 구성할 예정입니다.
