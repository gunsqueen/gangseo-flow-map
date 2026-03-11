const path = require("path");
const {
  readJson,
  saveJson,
  toNumber
} = require("./lib/seoulApi");

const rootDir = path.join(__dirname, "..");
const referencePath = path.join(rootDir, "data", "reference", "gangseo-gu-boundary.json");
const rawBusStopsPath = path.join(rootDir, "data", "raw", "bus-stops.json");
const rawBusHourlyPath = path.join(rootDir, "data", "raw", "bus-hourly.json");
const rawSubwayStationsPath = path.join(rootDir, "data", "raw", "subway-stations.json");
const rawSubwayHourlyPath = path.join(rootDir, "data", "raw", "subway-hourly.json");

function isPointInsidePolygon(lat, lng, polygon) {
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const xi = polygon[i][0];
    const yi = polygon[i][1];
    const xj = polygon[j][0];
    const yj = polygon[j][1];

    const intersects =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / ((yj - yi) || Number.EPSILON) + xi;

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

function normalizeStationName(name) {
  return String(name || "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/[·.]/g, "");
}

function createHourlyBucket() {
  const hours = [];

  for (let hour = 0; hour <= 23; hour += 1) {
    hours.push({
      hour: String(hour).padStart(2, "0"),
      boardings: 0,
      alightings: 0
    });
  }

  return hours;
}

function aggregateBusStop(stop, rows) {
  const hourly = createHourlyBucket();
  const routeNumbers = new Set();

  for (const row of rows) {
    routeNumbers.add(row.RTE_NO);

    for (let hour = 0; hour <= 23; hour += 1) {
      hourly[hour].boardings += toNumber(row[`HR_${hour}_GET_ON_TNOPE`] ?? row[`HR_${hour}_GET_ON_NOPE`]);
      hourly[hour].alightings += toNumber(row[`HR_${hour}_GET_OFF_TNOPE`] ?? row[`HR_${hour}_GET_OFF_NOPE`]);
    }
  }

  return {
    stopId: stop.CRTR_ID,
    arsId: stop.CRTR_NO,
    stopName: stop.CRTR_NM,
    stopType: stop.CRTR_TYPE,
    latitude: Number(stop.LAT),
    longitude: Number(stop.LOT),
    routeCount: routeNumbers.size,
    routeNumbers: Array.from(routeNumbers).sort(),
    totalBoardings: hourly.reduce((sum, item) => sum + item.boardings, 0),
    totalAlightings: hourly.reduce((sum, item) => sum + item.alightings, 0),
    hourly
  };
}

function aggregateSubwayStation(stationName, stationRows, hourlyRows) {
  const hourly = createHourlyBucket();
  const routeNames = new Set();
  const stationCodes = new Set();

  for (const row of stationRows) {
    routeNames.add(row.ROUTE);
    stationCodes.add(row.BLDN_ID);
  }

  for (const row of hourlyRows) {
    routeNames.add(row.SBWY_ROUT_LN_NM);

    for (let hour = 0; hour <= 23; hour += 1) {
      hourly[hour].boardings += toNumber(row[`HR_${hour}_GET_ON_NOPE`]);
      hourly[hour].alightings += toNumber(row[`HR_${hour}_GET_OFF_NOPE`]);
    }
  }

  const firstStation = stationRows[0];

  return {
    stationName,
    stationCodes: Array.from(stationCodes).sort(),
    routeNames: Array.from(routeNames).sort(),
    latitude: Number(firstStation.LAT),
    longitude: Number(firstStation.LOT),
    totalBoardings: hourly.reduce((sum, item) => sum + item.boardings, 0),
    totalAlightings: hourly.reduce((sum, item) => sum + item.alightings, 0),
    hourly
  };
}

function main() {
  const boundary = readJson(referencePath);
  const busStopsRaw = readJson(rawBusStopsPath);
  const busHourlyRaw = readJson(rawBusHourlyPath);
  const subwayStationsRaw = readJson(rawSubwayStationsPath);
  const subwayHourlyRaw = readJson(rawSubwayHourlyPath);
  const polygon = boundary.geometry.coordinates[0];

  const gangseoBusStops = busStopsRaw.items.filter((item) =>
    isPointInsidePolygon(Number(item.LAT), Number(item.LOT), polygon)
  );

  const gangseoBusStopMap = new Map(gangseoBusStops.map((item) => [item.CRTR_ID, item]));
  const gangseoBusHourly = busHourlyRaw.items.filter((item) => gangseoBusStopMap.has(item.STOPS_ID));
  const busRowsByStop = new Map();

  for (const row of gangseoBusHourly) {
    if (!busRowsByStop.has(row.STOPS_ID)) {
      busRowsByStop.set(row.STOPS_ID, []);
    }

    busRowsByStop.get(row.STOPS_ID).push(row);
  }

  const busResult = gangseoBusStops
    .filter((stop) => busRowsByStop.has(stop.CRTR_ID))
    .map((stop) => aggregateBusStop(stop, busRowsByStop.get(stop.CRTR_ID)))
    .sort((a, b) => b.totalBoardings + b.totalAlightings - (a.totalBoardings + a.totalAlightings));

  const gangseoSubwayStations = subwayStationsRaw.items.filter((item) =>
    isPointInsidePolygon(Number(item.LAT), Number(item.LOT), polygon)
  );

  const stationRowsByName = new Map();

  for (const row of gangseoSubwayStations) {
    const key = normalizeStationName(row.BLDN_NM);

    if (!stationRowsByName.has(key)) {
      stationRowsByName.set(key, []);
    }

    stationRowsByName.get(key).push(row);
  }

  const hourlyRowsByName = new Map();

  for (const row of subwayHourlyRaw.items) {
    const key = normalizeStationName(row.STTN);

    if (!stationRowsByName.has(key)) {
      continue;
    }

    if (!hourlyRowsByName.has(key)) {
      hourlyRowsByName.set(key, []);
    }

    hourlyRowsByName.get(key).push(row);
  }

  const subwayResult = Array.from(hourlyRowsByName.entries())
    .map(([key, rows]) => aggregateSubwayStation(stationRowsByName.get(key)[0].BLDN_NM, stationRowsByName.get(key), rows))
    .sort((a, b) => b.totalBoardings + b.totalAlightings - (a.totalBoardings + a.totalAlightings));

  const processedMeta = {
    district: "강서구",
    busTargetMonth: busHourlyRaw.meta.targetMonth,
    subwayTargetMonth: subwayHourlyRaw.meta.targetMonth,
    sampleMode: Boolean(
      busStopsRaw.meta.isSample ||
        busHourlyRaw.meta.isSample ||
        subwayStationsRaw.meta.isSample ||
        subwayHourlyRaw.meta.isSample
    ),
    processedAt: new Date().toISOString(),
    busStopCount: busResult.length,
    subwayStationCount: subwayResult.length
  };

  saveJson(path.join(rootDir, "data", "processed", "gangseo-bus-stops.json"), {
    meta: processedMeta,
    items: busResult
  });

  saveJson(path.join(rootDir, "data", "processed", "gangseo-subway-stations.json"), {
    meta: processedMeta,
    items: subwayResult
  });

  saveJson(path.join(rootDir, "data", "processed", "gangseo-transit.json"), {
    meta: processedMeta,
    busStops: busResult,
    subwayStations: subwayResult
  });

  console.log("전처리 완료");
}

main();
