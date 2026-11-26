require("dotenv").config();

const { startScheduler } = require("./jobs/collection.job");

try {
  startScheduler();
} catch (error) {
  console.error("Collector startup failed:", error.message);
  process.exitCode = 1;
}
