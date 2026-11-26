require("dotenv").config();

const { startScheduler } = require("./jobs/collection.job");
const { startDashboardServer } = require("./dashboard.server");

try {
  startDashboardServer();
  startScheduler();
} catch (error) {
  console.error("Application startup failed:", error.message);
  process.exitCode = 1;
}
