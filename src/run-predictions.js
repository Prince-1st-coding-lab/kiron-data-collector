require("dotenv").config();

const { generatePredictions } = require("./services/prediction.service");

try {
  const result = generatePredictions();
  if (!result.filePath) {
    console.error(result.reason);
    process.exitCode = 1;
  } else {
    console.log(`Prediction file created: ${result.filePath}`);
  }
} catch (error) {
  console.error("Prediction generation failed:", error.message);
  process.exitCode = 1;
}
