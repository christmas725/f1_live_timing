# F1 Live Timing v0.9.0

OpenF1 유료 구독 인증을 서버 측에 연결하기 위한 Live Timing 정식 전환 기반 버전입니다.

현재 UI의 Historical Replay 기능은 그대로 유지하면서, Vercel Function이 OpenF1 계정 자격 증명으로 OAuth2 access token을 발급받아 인증된 REST 요청을 처리합니다. 다음 단계에서 이 기반 위에 실제 Live Session 자동 감지와 실시간 갱신을 연결합니다.

## v0.9.0 핵심 변경

- OpenF1 유료 계정 OAuth2 인증 지원
- OpenF1 username/password는 Vercel Environment Variables에만 저장
- 브라우저에는 OpenF1 password를 전달하지 않음
- access token은 Vercel Function 메모리에서만 캐시
- token 만료 전에 자동 갱신
- upstream 401/403 발생 시 token 1회 강제 갱신 후 재시도
- 인증 변수가 없으면 Historical용 anonymous 모드 유지
- `car_data`, `location`, `overtakes`, `team_radio` endpoint를 향후 Live 기능용으로 허용
- `/api/openf1?endpoint=auth_status` 진단 endpoint 추가
- OpenF1 응답은 `no-store` 처리
- `.env`, `.env.*` Git 제외

## 중요: 자격 증명은 GitHub에 올리지 마세요

OpenF1 가입 후 받은 username/password는 코드, GitHub, README, 브라우저 JavaScript에 넣지 않습니다.

OpenF1 공식 안내에 따르면 토큰 발급에는 가입 메일로 받은 **username**과 **password**를 사용합니다. username이 이메일 주소와 다를 수 있으므로 OpenF1 가입 메일에 적힌 값을 사용하세요.

## Vercel Environment Variables 설정

Vercel의 `f1-live-timing` 프로젝트에서:

`Settings → Environment Variables`

다음 두 값을 추가합니다.

```text
OPENF1_USERNAME=<OpenF1 가입 메일에 적힌 username>
OPENF1_PASSWORD=<OpenF1 가입 메일에 적힌 password>
```

권장 적용 환경:

- Production
- Preview
- Development

환경변수를 저장한 뒤 기존 배포를 **Redeploy**해야 새 Function에서 읽을 수 있습니다.

## 인증 확인

배포 후 아래 주소를 엽니다.

```text
/api/openf1?endpoint=auth_status
```

정상 예시:

```json
{
  "configured": true,
  "authenticated": true,
  "mode": "authenticated",
  "expires_in": 3599
}
```

`expires_in` 값은 호출 시점에 따라 달라집니다.

환경변수가 아직 없으면:

```json
{
  "configured": false,
  "authenticated": false,
  "mode": "anonymous"
}
```

## 실제 OpenF1 요청 확인

인증 확인 후:

```text
/api/openf1?endpoint=sessions&session_key=latest
```

Live Session 중에도 인증이 정상이라면 OpenF1의 인증된 응답을 받을 수 있습니다.

## 보안 구조

```text
Browser
   │
   │ /api/openf1
   ▼
Vercel Function
   │
   ├─ OPENF1_USERNAME  ┐
   └─ OPENF1_PASSWORD  ┘ Vercel Environment Variables
   │
   ▼
POST https://api.openf1.org/token
   │
   ▼
1-hour access token
   │
   ▼
OpenF1 authenticated REST API
```

브라우저는 OpenF1 username/password를 알지 못합니다.

## 현재 동작

Historical Replay 기능은 v0.1.2와 동일하게 유지합니다.

Fallback:

```text
OpenF1 Historical API
        ↓ 실패
Local Historical Cache
2025 Abu Dhabi GP Laps 1–7
        ↓ 파일 오류
Demo Replay
```

유료 인증이 설정되면 과거 데이터도 Live Session Lock에 걸리지 않고 인증된 경로로 접근할 수 있습니다.

## 다음 단계: v0.9.1 / v1.0

인증 확인 후 다음 순서로 진행합니다.

1. 현재/최신 F1 세션 자동 감지
2. LIVE / REPLAY 모드 자동 전환
3. Practice / Qualifying / Sprint / Race 세션 타입별 표시
4. Position / Interval 약 4초 갱신
5. Lap / Sector 갱신
6. Pit / Stint / Tyre 갱신
7. Race Control / Weather 갱신
8. 선택 드라이버 Telemetry
9. Location 기반 Track Map
10. 실제 세션 회귀 테스트 후 v1.0

OpenF1 공식 문서상 access token은 약 1시간 유효하며, 실시간 데이터는 MQTT/WebSocket 사용을 권장합니다. 현재 v0.9.0은 우선 안전한 서버 측 인증 기반을 완성하는 단계입니다.
