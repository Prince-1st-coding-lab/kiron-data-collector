const fs = require("fs");
const path = require("path");

function saveRawResponse(endpoint, data) {
  const directory = path.join(process.cwd(), "data", "raw");
  fs.mkdirSync(directory, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `${endpoint}-${timestamp}.json`;
  const filePath = path.join(directory, filename);

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
  console.log(`[${new Date().toISOString()}] Saved ${filePath}`);
  return filePath;
}

module.exports = { saveRawResponse };
