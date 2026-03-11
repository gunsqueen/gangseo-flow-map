const path = require("path");
const { fetchAllRows, getApiKey, saveJson } = require("./lib/seoulApi");

async function main() {
  const outputPath = path.join(__dirname, "..", "data", "raw", "bus-stops.json");
  const result = await fetchAllRows("tbisMasterStation");

  saveJson(outputPath, {
    meta: {
      dataset: "서울시 정류장마스터 정보",
      serviceName: "tbisMasterStation",
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
