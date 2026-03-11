import { useEffect, useMemo, useState } from "react";
import L from "leaflet";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Polygon,
  Tooltip,
  useMap,
  useMapEvents
} from "react-leaflet";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis
} from "recharts";
import boundaryData from "../data/reference/gangseo-gu-boundary.json";
import transitData from "../data/processed/gangseo-transit.json";

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, index) => ({
  value: String(index).padStart(2, "0"),
  label: `${String(index).padStart(2, "0")}:00`
}));

function buildPlaces() {
  const busPlaces = (transitData.busStops || []).map((item) => ({
    id: `bus-${item.stopId}`,
    type: "bus",
    typeLabel: "버스정류장",
    name: item.stopName,
    subtitle: item.arsId ? `정류장번호 ${item.arsId}` : "버스정류장",
    latitude: item.latitude,
    longitude: item.longitude,
    routeNames: item.routeNumbers || [],
    totalBoardings: item.totalBoardings,
    totalAlightings: item.totalAlightings,
    hourly: item.hourly || []
  }));

  const subwayPlaces = (transitData.subwayStations || []).map((item) => ({
    id: `subway-${item.stationName}`,
    type: "subway",
    typeLabel: "지하철역",
    name: item.stationName,
    subtitle: (item.routeNames || []).join(", ") || "지하철역",
    latitude: item.latitude,
    longitude: item.longitude,
    routeNames: item.routeNames || [],
    totalBoardings: item.totalBoardings,
    totalAlightings: item.totalAlightings,
    hourly: item.hourly || []
  }));

  return [...busPlaces, ...subwayPlaces];
}

function getBoundaryLatLngs() {
  return boundaryData.geometry.coordinates[0].map(([lng, lat]) => [lat, lng]);
}

function getMetric(place, selectedHour) {
  const hourItem = place.hourly.find((item) => item.hour === selectedHour);
  const boardings = hourItem?.boardings || 0;
  const alightings = hourItem?.alightings || 0;

  return {
    boardings,
    alightings,
    total: boardings + alightings
  };
}

function getFilteredPlaces(places, viewMode) {
  if (viewMode === "all") {
    return places;
  }

  return places.filter((item) => item.type === viewMode);
}

function getMarkerStyle(metric, maxTraffic, type, selected) {
  const ratio = maxTraffic > 0 ? metric.total / maxTraffic : 0;
  const radius = 6 + ratio * 16 + (selected ? 4 : 0);
  const fillColor =
    type === "bus"
      ? ratio > 0.75
        ? "#d9480f"
        : ratio > 0.45
          ? "#f08c00"
          : "#f4b740"
      : ratio > 0.75
        ? "#1864ab"
        : ratio > 0.45
          ? "#1971c2"
          : "#74c0fc";

  return {
    radius,
    fillColor,
    fillOpacity: 0.8,
    color: selected ? "#111827" : "#ffffff",
    weight: selected ? 3 : 1.5
  };
}

function formatNumber(value) {
  return new Intl.NumberFormat("ko-KR").format(value || 0);
}

function formatDistance(meters) {
  if (!Number.isFinite(meters)) {
    return "-";
  }

  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)}km`;
  }

  return `${Math.round(meters)}m`;
}

function MapViewportWatcher({ onViewportChange, onViewportError, onMapReady }) {
  const map = useMapEvents({
    moveend: publishViewport,
    zoomend: publishViewport
  });

  useEffect(() => {
    onMapReady(map);
    publishViewport();
  }, [map, onMapReady]);

  function publishViewport() {
    try {
      const bounds = map.getBounds();
      const center = map.getCenter();

      onViewportChange({
        south: bounds.getSouth(),
        west: bounds.getWest(),
        north: bounds.getNorth(),
        east: bounds.getEast(),
        centerLat: center.lat,
        centerLng: center.lng,
        zoom: map.getZoom()
      });
      onViewportError("");
    } catch (error) {
      onViewportError("현재 지도 범위를 계산할 수 없습니다.");
    }
  }

  return null;
}

export default function App() {
  const [viewMode, setViewMode] = useState("all");
  const [rankingScope, setRankingScope] = useState("viewport");
  const [selectedHour, setSelectedHour] = useState("18");
  const [selectedPlaceId, setSelectedPlaceId] = useState(null);
  const [viewport, setViewport] = useState(null);
  const [viewportError, setViewportError] = useState("");
  const [mapInstance, setMapInstance] = useState(null);

  const boundaryLatLngs = useMemo(() => getBoundaryLatLngs(), []);
  const allPlaces = useMemo(() => buildPlaces(), []);

  const placesWithMetrics = useMemo(() => {
    const centerLatLng =
      viewport && Number.isFinite(viewport.centerLat) && Number.isFinite(viewport.centerLng)
        ? L.latLng(viewport.centerLat, viewport.centerLng)
        : null;

    return allPlaces.map((place) => {
      const metric = getMetric(place, selectedHour);
      const distanceFromCenter = centerLatLng
        ? centerLatLng.distanceTo(L.latLng(place.latitude, place.longitude))
        : Number.NaN;

      return {
        ...place,
        metric,
        distanceFromCenter
      };
    });
  }, [allPlaces, selectedHour, viewport]);

  const filteredPlaces = useMemo(
    () => getFilteredPlaces(placesWithMetrics, viewMode),
    [placesWithMetrics, viewMode]
  );

  const visiblePlaces = useMemo(() => {
    if (!viewport) {
      return [];
    }

    try {
      const bounds = L.latLngBounds(
        [viewport.south, viewport.west],
        [viewport.north, viewport.east]
      );

      return filteredPlaces.filter((place) => bounds.contains([place.latitude, place.longitude]));
    } catch (error) {
      return [];
    }
  }, [filteredPlaces, viewport]);

  const visibleCounts = useMemo(() => {
    const source = viewport
      ? placesWithMetrics.filter((place) => {
          try {
            const bounds = L.latLngBounds(
              [viewport.south, viewport.west],
              [viewport.north, viewport.east]
            );
            return bounds.contains([place.latitude, place.longitude]);
          } catch (error) {
            return false;
          }
        })
      : [];

    return {
      bus: source.filter((place) => place.type === "bus").length,
      subway: source.filter((place) => place.type === "subway").length,
      total: source.length
    };
  }, [placesWithMetrics, viewport]);

  const rankedPlaces = useMemo(() => {
    const source = rankingScope === "viewport" ? visiblePlaces : filteredPlaces;

    return [...source].sort((a, b) => {
      if (b.metric.total !== a.metric.total) {
        return b.metric.total - a.metric.total;
      }

      return b.totalBoardings + b.totalAlightings - (a.totalBoardings + a.totalAlightings);
    });
  }, [filteredPlaces, rankingScope, visiblePlaces]);

  const topTwenty = useMemo(() => rankedPlaces.slice(0, 20), [rankedPlaces]);
  const selectedPlace = useMemo(
    () => placesWithMetrics.find((place) => place.id === selectedPlaceId) || null,
    [placesWithMetrics, selectedPlaceId]
  );
  const selectedPlaceIsVisible = useMemo(
    () => visibleCounts.total > 0 && visiblePlaces.some((place) => place.id === selectedPlaceId),
    [selectedPlaceId, visibleCounts.total, visiblePlaces]
  );
  const selectedPlaceIsInCurrentViewMode = useMemo(
    () => filteredPlaces.some((place) => place.id === selectedPlaceId),
    [filteredPlaces, selectedPlaceId]
  );
  const maxTraffic = filteredPlaces[0]
    ? Math.max(...filteredPlaces.map((place) => place.metric.total))
    : 0;

  const summary = useMemo(
    () => ({
      count: rankedPlaces.length,
      traffic: rankedPlaces.reduce((sum, item) => sum + item.metric.total, 0),
      sampleMode: Boolean(transitData.meta?.sampleMode)
    }),
    [rankedPlaces]
  );

  const dataError = allPlaces.length === 0 ? "데이터가 비어 있습니다. 전처리 JSON을 다시 확인해 주세요." : "";
  const rankingError =
    dataError || (rankingScope === "viewport" && !viewport ? "현재 지도 범위를 계산할 수 없습니다." : "") || viewportError;
  const emptyVisibleMessage =
    !rankingError && rankingScope === "viewport" && visibleCounts.total === 0
      ? "현재 지도 범위 내 표시할 데이터가 없습니다"
      : "";

  useEffect(() => {
    if (!selectedPlaceId && topTwenty[0]) {
      setSelectedPlaceId(topTwenty[0].id);
    }
  }, [selectedPlaceId, topTwenty]);

  function handleRankClick(place) {
    setSelectedPlaceId(place.id);

    if (mapInstance) {
      mapInstance.panTo([place.latitude, place.longitude], { animate: true });
    }
  }

  const rankingTitle =
    rankingScope === "viewport" ? "현재 화면 기준 TOP 20" : "강서구 전체 기준 TOP 20";
  const rankingSubtitle =
    rankingScope === "viewport"
      ? `현재 화면 내 ${formatNumber(rankedPlaces.length)}개 지점 중 상위 20개`
      : `강서구 전체 ${formatNumber(rankedPlaces.length)}개 지점 중 상위 20개`;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Gangseo Transit Flow</p>
          <h1>강서구 버스정류장 · 지하철역 유동인구 지도</h1>
          <p className="topbar-copy">
            실제 전처리 JSON을 읽어 시간대별 유동인구를 지도와 랭킹으로 확인합니다.
          </p>
        </div>
        <div className="meta-group">
          <span className="meta-chip">버스 {transitData.meta?.busTargetMonth || "-"}</span>
          <span className="meta-chip">지하철 {transitData.meta?.subwayTargetMonth || "-"}</span>
        </div>
      </header>

      <section className="control-bar">
        <div className="toggle-group" aria-label="보기 방식">
          <button
            className={viewMode === "all" ? "toggle active" : "toggle"}
            onClick={() => setViewMode("all")}
            type="button"
          >
            통합
          </button>
          <button
            className={viewMode === "bus" ? "toggle active" : "toggle"}
            onClick={() => setViewMode("bus")}
            type="button"
          >
            버스
          </button>
          <button
            className={viewMode === "subway" ? "toggle active" : "toggle"}
            onClick={() => setViewMode("subway")}
            type="button"
          >
            지하철
          </button>
        </div>

        <div className="toggle-group scope-toggle" aria-label="랭킹 기준">
          <button
            className={rankingScope === "viewport" ? "toggle active" : "toggle"}
            onClick={() => setRankingScope("viewport")}
            type="button"
          >
            현재 화면 기준
          </button>
          <button
            className={rankingScope === "district" ? "toggle active" : "toggle"}
            onClick={() => setRankingScope("district")}
            type="button"
          >
            강서구 전체 기준
          </button>
        </div>

        <div className="time-control">
          <label className="time-label" htmlFor="hour-slider">
            시간대 선택
          </label>
          <div className="time-display">{selectedHour}:00 기준</div>
          <input
            id="hour-slider"
            className="time-slider"
            max="23"
            min="0"
            onChange={(event) => setSelectedHour(String(event.target.value).padStart(2, "0"))}
            type="range"
            value={Number(selectedHour)}
          />
          <select
            className="time-select"
            onChange={(event) => setSelectedHour(event.target.value)}
            value={selectedHour}
          >
            {HOUR_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="summary-strip">
          <div className="summary-card">
            <span className="summary-label">랭킹 대상 지점 수</span>
            <strong>{formatNumber(summary.count)}</strong>
          </div>
          <div className="summary-card">
            <span className="summary-label">선택 시간 총 유동</span>
            <strong>{formatNumber(summary.traffic)}</strong>
          </div>
        </div>
      </section>

      {summary.sampleMode ? (
        <section className="notice">
          현재 데이터는 서울시 `sample` 키로 생성된 파일이라 실제 강서구 지점이 비어 있습니다. `.env`에 실제 API 키를 넣고
          `npm run build:data`를 다시 실행하면 지도와 랭킹이 채워집니다.
        </section>
      ) : null}

      <main className="content-grid">
        <section className="map-panel">
          <div className="panel-heading">
            <div>
              <h2>강서구 지도</h2>
              <p>지도 이동과 확대/축소가 끝나면 현재 화면 기준 랭킹이 다시 계산됩니다.</p>
            </div>
            <div className="legend">
              <span className="legend-item bus">버스</span>
              <span className="legend-item subway">지하철</span>
            </div>
          </div>

          <div className="map-frame">
            <MapContainer
              center={[37.5585, 126.84]}
              className="leaflet-map"
              scrollWheelZoom={true}
              zoom={12}
            >
              <MapViewportWatcher
                onMapReady={setMapInstance}
                onViewportChange={setViewport}
                onViewportError={setViewportError}
              />
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <Polygon
                pathOptions={{ color: "#1f2937", fillColor: "#dbeafe", fillOpacity: 0.14, weight: 2 }}
                positions={boundaryLatLngs}
              />

              {filteredPlaces.map((place) => {
                const style = getMarkerStyle(
                  place.metric,
                  maxTraffic,
                  place.type,
                  selectedPlace?.id === place.id
                );

                return (
                  <CircleMarker
                    center={[place.latitude, place.longitude]}
                    eventHandlers={{
                      click: () => setSelectedPlaceId(place.id)
                    }}
                    key={place.id}
                    pathOptions={style}
                    radius={style.radius}
                  >
                    <Tooltip>
                      <div className="tooltip-box">
                        <strong>{place.name}</strong>
                        <span>{place.typeLabel}</span>
                        <span>{selectedHour}:00 유동 {formatNumber(place.metric.total)}</span>
                      </div>
                    </Tooltip>
                  </CircleMarker>
                );
              })}
            </MapContainer>
          </div>
        </section>

        <aside className="side-panel">
          <section className="panel-card ranking-card">
            <div className="panel-heading compact">
              <div>
                <h2>{rankingTitle}</h2>
                <p>{rankingSubtitle}</p>
              </div>
            </div>

            <div className="visible-summary">
              <div className="visible-card">
                <span>현재 화면 버스</span>
                <strong>{formatNumber(visibleCounts.bus)}</strong>
              </div>
              <div className="visible-card">
                <span>현재 화면 지하철</span>
                <strong>{formatNumber(visibleCounts.subway)}</strong>
              </div>
              <div className="visible-card">
                <span>현재 화면 전체</span>
                <strong>{formatNumber(visibleCounts.total)}</strong>
              </div>
            </div>

            <div className="ranking-list">
              {rankingError ? (
                <div className="empty-state">{rankingError}</div>
              ) : emptyVisibleMessage ? (
                <div className="empty-state">{emptyVisibleMessage}</div>
              ) : topTwenty.length === 0 ? (
                <div className="empty-state">표시할 데이터가 없습니다.</div>
              ) : (
                topTwenty.map((place, index) => (
                  <button
                    className={selectedPlace?.id === place.id ? "rank-item active" : "rank-item"}
                    key={place.id}
                    onClick={() => handleRankClick(place)}
                    type="button"
                  >
                    <span className="rank-number">{index + 1}</span>
                    <span className="rank-main">
                      <strong>{place.name}</strong>
                      <small>{place.subtitle}</small>
                      <small>중심에서 {formatDistance(place.distanceFromCenter)}</small>
                    </span>
                    <span className="rank-value">{formatNumber(place.metric.total)}</span>
                  </button>
                ))
              )}
            </div>
          </section>

          <section className="panel-card detail-card">
            <div className="panel-heading compact">
              <div>
                <h2>상세 패널</h2>
                <p>클릭한 지점의 시간대별 추이</p>
              </div>
            </div>

            {selectedPlace ? (
              <div className="detail-content">
                {!selectedPlaceIsVisible ? (
                  <div className="detail-notice">현재 화면 밖 지점</div>
                ) : null}
                {!selectedPlaceIsInCurrentViewMode ? (
                  <div className="detail-notice muted">현재 보기 옵션에 포함되지 않은 지점입니다.</div>
                ) : null}

                <div className="detail-header">
                  <div>
                    <span className={selectedPlace.type === "bus" ? "detail-type bus" : "detail-type subway"}>
                      {selectedPlace.typeLabel}
                    </span>
                    <h3>{selectedPlace.name}</h3>
                    <p>{selectedPlace.subtitle}</p>
                  </div>
                  <div className="detail-stats">
                    <div>
                      <span>총 승차</span>
                      <strong>{formatNumber(selectedPlace.totalBoardings)}</strong>
                    </div>
                    <div>
                      <span>총 하차</span>
                      <strong>{formatNumber(selectedPlace.totalAlightings)}</strong>
                    </div>
                  </div>
                </div>

                <div className="detail-chart">
                  <ResponsiveContainer height="100%" width="100%">
                    <LineChart data={selectedPlace.hourly}>
                      <CartesianGrid stroke="#d9e0e8" strokeDasharray="3 3" />
                      <XAxis dataKey="hour" />
                      <YAxis />
                      <RechartsTooltip formatter={(value) => formatNumber(value)} />
                      <Legend />
                      <Line
                        dataKey="boardings"
                        dot={false}
                        name="승차"
                        stroke="#d9480f"
                        strokeWidth={2.5}
                        type="monotone"
                      />
                      <Line
                        dataKey="alightings"
                        dot={false}
                        name="하차"
                        stroke="#1864ab"
                        strokeWidth={2.5}
                        type="monotone"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div className="detail-foot">
                  <span>선택 시간 유동</span>
                  <strong>{formatNumber(getMetric(selectedPlace, selectedHour).total)}</strong>
                </div>
              </div>
            ) : (
              <div className="empty-state detail-empty">
                지도나 랭킹에서 지점을 선택하면 상세 차트가 표시됩니다.
              </div>
            )}
          </section>
        </aside>
      </main>
    </div>
  );
}
