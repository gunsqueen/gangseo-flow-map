const path = require("path");
const { fetchAllRows, getApiKey, getTargetMonth, saveJson } = require("./lib/seoulApi");

async function main() {
  const targetMonth = process.argv[2] || getTargetMonth();
  const outputPath = path.join(__dirname, "..", "data", "raw", "bus-hourly.json");
  const result = await fetchAllRows("CardBusTimeNew", [targetMonth]);

  saveJson(outputPath, {
    meta: {
      dataset: "서울시 버스노선별 정류장별 시간대별 승하차 인원 정보",
      serviceName: "CardBusTimeNew",
      targetMonth,
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
