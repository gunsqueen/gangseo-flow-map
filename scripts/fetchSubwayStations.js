const path = require("path");
const { fetchAllRows, getApiKey, saveJson } = require("./lib/seoulApi");

async function main() {
  const outputPath = path.join(__dirname, "..", "data", "raw", "subway-stations.json");
  const result = await fetchAllRows("subwayStationMaster");

  saveJson(outputPath, {
    meta: {
      dataset: "서울시 역사마스터 정보",
      serviceName: "subwayStationMaster",
      apiKeyUsed: getApiKey() === "sample" ? "sample" : "user-key",
      isSample: result.isSample,
      fetchedAt: new Date().toISOString(),
      totalCount: result.totalCount
    },
    items: result.items
  });

  console.log(`저장 완료: ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
