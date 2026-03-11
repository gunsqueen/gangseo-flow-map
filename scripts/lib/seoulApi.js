const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

dotenv.config();

const BASE_URL = "http://openapi.seoul.go.kr:8088";
const PAGE_SIZE = 1000;

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function getApiKey() {
  return process.env.SEOUL_OPEN_API_KEY || "sample";
}

function isSampleKey() {
  return getApiKey() === "sample";
}

function getTargetMonth() {
  if (process.env.TARGET_MONTH) {
    return process.env.TARGET_MONTH;
  }

  const now = new Date();
  const previousMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const year = previousMonth.getUTCFullYear();
  const month = String(previousMonth.getUTCMonth() + 1).padStart(2, "0");
  return `${year}${month}`;
}

function buildApiUrl(serviceName, startIndex, endIndex, extraParams = []) {
  const key = getApiKey();
  const encodedParams = extraParams.map((value) =>
    encodeURIComponent(value === undefined || value === null || value === "" ? " " : String(value))
  );

  return [
    BASE_URL,
    encodeURIComponent(key),
    "json",
    encodeURIComponent(serviceName),
    String(startIndex),
    String(endIndex),
    ...encodedParams
  ].join("/");
}

async function fetchJson(url, retryCount = 3) {
  let lastError;

  for (let attempt = 1; attempt <= retryCount; attempt += 1) {
    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      lastError = error;
      await sleep(300 * attempt);
    }
  }

  throw lastError;
}

async function fetchAllRows(serviceName, extraParams = []) {
  if (isSampleKey()) {
    const url = buildApiUrl(serviceName, 1, 5, extraParams);
    const payload = await fetchJson(url);
    const serviceData = payload[serviceName];

    if (!serviceData || !serviceData.RESULT || serviceData.RESULT.CODE !== "INFO-000") {
      throw new Error(`${serviceName} 샘플 응답을 가져오지 못했습니다.`);
    }

    return {
      serviceName,
      totalCount: Number(serviceData.list_total_count || serviceData.row?.length || 0),
      items: serviceData.row || [],
      isSample: true
    };
  }

  let startIndex = 1;
  const allRows = [];
  let totalCount = null;

  while (totalCount === null || allRows.length < totalCount) {
    const endIndex = startIndex + PAGE_SIZE - 1;
    const url = buildApiUrl(serviceName, startIndex, endIndex, extraParams);
    const payload = await fetchJson(url);
    const serviceData = payload[serviceName];

    if (!serviceData || !serviceData.RESULT) {
      throw new Error(`${serviceName} 응답 형식이 예상과 다릅니다.`);
    }

    if (serviceData.RESULT.CODE !== "INFO-000") {
      throw new Error(`${serviceName} 오류: ${serviceData.RESULT.CODE} ${serviceData.RESULT.MESSAGE}`);
    }

    const rows = serviceData.row || [];

    if (totalCount === null) {
      totalCount = Number(serviceData.list_total_count || 0);
    }

    allRows.push(...rows);

    if (rows.length === 0) {
      break;
    }

    startIndex += PAGE_SIZE;
  }

  return {
    serviceName,
    totalCount: totalCount || allRows.length,
    items: allRows,
    isSample: false
  };
}

function saveJson(filePath, data) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  return Number(value);
}

function hourlyKeys(prefix) {
  const result = [];

  for (let hour = 0; hour <= 23; hour += 1) {
    result.push(`${prefix}${hour}`);
  }

  return result;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = {
  ensureDir,
  fetchAllRows,
  getApiKey,
  getTargetMonth,
  hourlyKeys,
  isSampleKey,
  readJson,
  saveJson,
  toNumber
};
