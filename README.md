# 서울시 강서구 대중교통 데이터 파이프라인

이 프로젝트는 서울시 강서구의 버스정류장과 지하철역 시간대별 승하차 데이터를 수집하고, 앱에서 바로 쓰기 쉬운 JSON으로 가공하는 예제입니다.

초보자도 흐름을 따라가기 쉽게 아래 2단계로 나눴습니다.

1. `scripts/fetch*.js`
   서울시 Open API에서 원본 데이터를 가져와 `data/raw/*.json`에 저장합니다.
2. `scripts/processGangseoData.js`
   원본 데이터에서 강서구만 추리고, 정류장/역 단위로 다시 합쳐 `data/processed/*.json`에 저장합니다.

## 1. 사용한 서울시 데이터

이 프로젝트는 아래 4개 Open API를 사용합니다.

- 버스 시간대별 승하차: `CardBusTimeNew`
- 버스 정류장 마스터(좌표): `tbisMasterStation`
- 지하철 시간대별 승하차: `CardSubwayTime`
- 지하철 역사 마스터(좌표): `subwayStationMaster`

## 2. 폴더 구조

```text
.
├── data
│   ├── raw
│   │   ├── bus-hourly.json
│   │   ├── bus-stops.json
│   │   ├── subway-hourly.json
│   │   └── subway-stations.json
│   ├── processed
│   │   ├── gangseo-bus-stops.json
│   │   ├── gangseo-subway-stations.json
│   │   └── gangseo-transit.json
│   └── reference
│       └── gangseo-gu-boundary.json
└── scripts
    ├── fetchAll.js
    ├── fetchBusHourly.js
    ├── fetchBusStops.js
    ├── fetchSubwayHourly.js
    ├── fetchSubwayStations.js
    ├── processGangseoData.js
    └── lib
        └── seoulApi.js
```

## 3. 준비

### 3-1. Node.js 설치

Node.js 18 이상이 필요합니다.

터미널에서 아래 명령으로 확인할 수 있습니다.

```bash
node -v
```

### 3-2. 패키지 설치

프로젝트 폴더에서 아래 명령을 실행합니다.

```bash
npm install
```

### 3-3. `.env` 파일 만들기

`.env.example` 파일을 참고해서 `.env` 파일을 만듭니다.

예시:

```env
SEOUL_OPEN_API_KEY=발급받은_서울시_API_KEY
TARGET_MONTH=202602
```

설명:

- `SEOUL_OPEN_API_KEY`
  서울 열린데이터광장에서 발급받은 인증키입니다.
- `TARGET_MONTH`
  가져올 월입니다. `YYYYMM` 형식으로 적습니다.
  예: `202602`는 2026년 2월입니다.

참고:

- `SEOUL_OPEN_API_KEY`를 넣지 않으면 코드가 기본값으로 `sample` 키를 사용합니다.
- `sample` 키는 테스트 용도입니다. 실제 운영에서는 본인 키를 넣는 것을 권장합니다.
- `sample` 키는 서울시 정책상 전체 데이터를 받을 수 없고, 각 API의 앞부분 일부 데이터만 확인할 수 있습니다.
- 따라서 강서구 결과 JSON을 실제로 채우려면 반드시 본인 키로 다시 실행해야 합니다.

## 4. 데이터 파이프라인 실행 방법

### 방법 A. 한 번에 모두 실행

```bash
npm run build:data
```

이 명령은 아래 두 단계를 순서대로 실행합니다.

1. 원본 데이터 수집
2. 강서구 필터링 및 집계

### 방법 B. 단계별 실행

원본만 먼저 받고 싶으면:

```bash
npm run fetch:all
```

전처리만 다시 돌리고 싶으면:

```bash
npm run process:gangseo
```

### 방법 C. 특정 월 지정해서 실행

버스/지하철 시간대 데이터는 월 단위입니다.

예를 들어 2026년 1월 데이터를 받고 싶으면:

```bash
node scripts/fetchBusHourly.js 202601
node scripts/fetchSubwayHourly.js 202601
node scripts/processGangseoData.js
```

## 5. 각 스크립트 설명

### `scripts/fetchBusStops.js`

서울시 버스 정류장 마스터 정보를 가져옵니다.

저장 파일:

- `data/raw/bus-stops.json`

### `scripts/fetchBusHourly.js`

서울시 버스 노선별 정류장별 시간대별 승하차 정보를 가져옵니다.

입력:

- 월(`YYYYMM`)

저장 파일:

- `data/raw/bus-hourly.json`

### `scripts/fetchSubwayStations.js`

서울시 지하철 역사 마스터 정보를 가져옵니다.

저장 파일:

- `data/raw/subway-stations.json`

### `scripts/fetchSubwayHourly.js`

서울시 지하철 역별 시간대별 승하차 정보를 가져옵니다.

입력:

- 월(`YYYYMM`)

저장 파일:

- `data/raw/subway-hourly.json`

### `scripts/processGangseoData.js`

아래 작업을 수행합니다.

1. 강서구 경계 폴리곤으로 버스 정류장과 지하철역을 필터링합니다.
2. 버스 데이터는 `정류장 단위`로 다시 합칩니다.
3. 지하철 데이터는 `역 단위`로 합칩니다.
4. 최종 JSON 파일을 저장합니다.

저장 파일:

- `data/processed/gangseo-bus-stops.json`
- `data/processed/gangseo-subway-stations.json`
- `data/processed/gangseo-transit.json`

## 6. 결과 JSON 형태

### 버스 결과 예시

```json
{
  "stopId": "116000123",
  "arsId": "16123",
  "stopName": "예시정류장",
  "stopType": "가로변",
  "latitude": 37.56,
  "longitude": 126.82,
  "routeCount": 5,
  "routeNumbers": ["60", "605", "6629"],
  "totalBoardings": 12345,
  "totalAlightings": 11700,
  "hourly": [
    { "hour": "00", "boardings": 12, "alightings": 8 }
  ]
}
```

### 지하철 결과 예시

```json
{
  "stationName": "발산",
  "stationCodes": ["0517"],
  "routeNames": ["5호선"],
  "latitude": 37.558598,
  "longitude": 126.837668,
  "totalBoardings": 23456,
  "totalAlightings": 22880,
  "hourly": [
    { "hour": "00", "boardings": 35, "alightings": 22 }
  ]
}
```

## 7. 강서구 필터링 방식

버스 정류장 마스터와 역사 마스터에는 자치구 이름이 직접 들어 있지 않아서, 이 프로젝트는 `data/reference/gangseo-gu-boundary.json`에 있는 강서구 경계 좌표를 사용해 `좌표가 강서구 안에 들어오는지` 검사합니다.

즉, 필터링 기준은 다음과 같습니다.

- 버스정류장 위도/경도
- 지하철역 위도/경도
- 강서구 경계 폴리곤 포함 여부

## 8. 자주 하는 수정

### 다른 자치구로 바꾸고 싶을 때

현재 코드는 강서구 전용입니다.

다른 자치구로 바꾸려면:

1. `data/reference/gangseo-gu-boundary.json`을 원하는 자치구 경계 파일로 바꿉니다.
2. `scripts/processGangseoData.js`의 출력 파일 이름과 메타 정보를 바꿉니다.

### 프론트엔드에서 바로 쓰고 싶을 때

가장 바로 쓰기 쉬운 파일은 아래 둘입니다.

- `data/processed/gangseo-bus-stops.json`
- `data/processed/gangseo-subway-stations.json`

두 파일 모두 `hourly` 배열을 가지고 있으므로, 시간대별 차트나 지도 팝업에 바로 연결할 수 있습니다.

## 9. 주의사항

- 서울시 월별 데이터는 보통 매월 초 갱신됩니다.
- 같은 정류장이라도 여러 버스 노선이 지나기 때문에, 버스 원본은 중복 정류장이 많습니다.
- 이 프로젝트는 그 중복을 정류장 단위로 다시 합쳐서 저장합니다.
- 지하철은 같은 역 이름이 여러 호선에 걸쳐 있을 수 있으므로, 역명 기준으로 합계 처리합니다.

## 10. 프론트엔드 지도 앱 실행 방법

이 프로젝트에는 React + Vite 기반 지도 앱이 포함되어 있습니다.

사용한 라이브러리:

- React
- Vite
- Leaflet
- Recharts

### 개발 서버 실행

```bash
npm run dev
```

실행 후 터미널에 표시되는 로컬 주소를 브라우저에서 열면 됩니다.

보통은 아래와 비슷한 주소가 나옵니다.

```text
http://localhost:5173
```

### 배포용 빌드

```bash
npm run build
```

빌드 결과물은 `dist/` 폴더에 생성됩니다.

### 미리보기

```bash
npm run preview
```

## 11. 지도 앱 기능

지도 앱은 아래 기능을 제공합니다.

1. 강서구 지도 위에 버스정류장과 지하철역 표시
2. 시간대 슬라이더와 드롭다운으로 시간 선택
3. 선택 시간대 기준으로 원 크기와 색상 변경
4. 오른쪽 패널에 TOP 20 랭킹 표시
5. 지점 클릭 시 시간대별 승차/하차 추이 차트 표시
6. 버스 / 지하철 / 통합 보기 토글
7. 모바일 / 데스크톱 반응형 UI
8. `data/processed/gangseo-transit.json` 실제 파일 사용
9. 지도 이동 / 확대 / 축소 후 현재 화면 안에 보이는 지점만 기준으로 랭킹 재계산
10. `현재 화면 기준 TOP 20` / `강서구 전체 기준 TOP 20` 토글 제공
11. 랭킹 항목에 지도 중심에서의 거리 표시
12. 랭킹 항목 클릭 시 해당 위치로 지도 `panTo`

## 12. 현재 화면 기준 랭킹 동작 방식

기본 랭킹 기준은 `현재 화면 기준 TOP 20`입니다.

즉, Leaflet 지도의 현재 viewport 안에 실제로 보이는 지점만 대상으로 랭킹을 계산합니다.

동작 방식:

1. Leaflet의 `map.getBounds()`로 현재 지도 범위를 가져옵니다.
2. 각 지점의 `lat/lng`가 현재 bounds 안에 포함되는지 검사합니다.
3. 현재 보기 옵션(버스 / 지하철 / 통합)과 시간대 선택값을 반영합니다.
4. 선택한 시간대의 유동인구 합계(`boardings + alightings`)를 기준으로 내림차순 정렬합니다.
5. 상위 20개만 우측 패널에 표시합니다.

성능을 위해 다음 시점에만 갱신합니다.

- `moveend`
- `zoomend`

즉, 드래그 중에는 계속 다시 계산하지 않고, 이동이 끝난 뒤에만 다시 계산합니다.

우측 패널 상단에는 항상 아래 수치를 같이 표시합니다.

- 현재 화면 안의 버스 정류장 수
- 현재 화면 안의 지하철역 수
- 현재 화면 안의 전체 지점 수

예외 처리:

- 현재 화면 안에 지점이 없으면 `현재 지도 범위 내 표시할 데이터가 없습니다` 메시지를 보여줍니다.
- 데이터가 비어 있거나 bounds 계산이 실패하면 에러 메시지를 보여줍니다.
- 선택한 지점이 현재 화면 밖으로 나가면 상세 패널에 `현재 화면 밖 지점` 안내를 보여줍니다.

## 13. 프론트엔드에서 읽는 데이터

React 앱은 아래 실제 JSON 파일을 직접 import해서 사용합니다.

- `data/processed/gangseo-transit.json`
- `data/reference/gangseo-gu-boundary.json`

즉, 전처리 결과를 다시 mock 데이터로 옮기지 않습니다.

데이터를 다시 만들었으면:

```bash
npm run build:data
```

그 다음 개발 서버를 다시 보면 최신 데이터가 화면에 반영됩니다.

## 14. sample 키 사용 시 화면이 비는 이유

서울시 `sample` 키는 API 응답 건수가 매우 작아서, 현재 프로젝트에서는 강서구 지점이 하나도 포함되지 않을 수 있습니다.

이 경우 지도 앱은 다음처럼 동작합니다.

- 강서구 경계 지도는 표시됨
- 랭킹과 상세 데이터는 비어 있음
- 상단 안내 문구로 sample 모드임을 표시함

실제 지도를 채우려면 반드시 `.env`에 본인 API 키를 넣고 아래 순서로 다시 실행해야 합니다.

```bash
npm run build:data
npm run dev
```

## 15. 추천 실행 순서

처음에는 아래 순서대로 실행하면 됩니다.

```bash
npm install
cp .env.example .env
npm run build:data
npm run dev
```

실행이 끝나면:

- `data/processed/` 폴더에서 전처리 JSON 확인
- 브라우저에서 지도 앱 확인
