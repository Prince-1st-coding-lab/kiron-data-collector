const fs = require("fs");
const path = require("path");

function saveJson(directoryName, filenamePrefix, data) {
  const directory = path.join(process.cwd(), "data", directoryName);
  fs.mkdirSync(directory, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `${filenamePrefix}-${timestamp}.json`;
  const filePath = path.join(directory, filename);

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
  console.log(`[${new Date().toISOString()}] Saved ${filePath}`);
  return filePath;
}

function saveRawResponse(endpoint, data) {
  return saveJson("raw", endpoint, data);
}

function saveNormalizedData(dataset, data) {
  return saveJson("normalized", dataset, data);
}

module.exports = {
  saveRawResponse,
  saveNormalizedData,
};
