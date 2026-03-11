const path = require("path");
const { fetchAllRows, getApiKey, getTargetMonth, saveJson } = require("./lib/seoulApi");

async function main() {
  const targetMonth = process.argv[2] || getTargetMonth();
  const outputPath = path.join(__dirname, "..", "data", "raw", "subway-hourly.json");
  const result = await fetchAllRows("CardSubwayTime", [targetMonth]);

  saveJson(outputPath, {
    meta: {
      dataset: "서울시 지하철 호선별 역별 시간대별 승하차 인원 정보",
      serviceName: "CardSubwayTime",
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
