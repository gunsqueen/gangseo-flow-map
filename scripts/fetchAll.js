const { spawnSync } = require("child_process");
const path = require("path");

const scripts = [
  "fetchBusStops.js",
  "fetchBusHourly.js",
  "fetchSubwayStations.js",
  "fetchSubwayHourly.js"
];

for (const script of scripts) {
  const result = spawnSync(process.execPath, [path.join(__dirname, script), process.argv[2]].filter(Boolean), {
    stdio: "inherit"
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}
