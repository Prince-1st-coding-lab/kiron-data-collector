require("dotenv").config();

const playBetMan = require("./clients/playbetman.client");

async function main() {
  const competition_id = Number(process.env.COMPETITION_ID);
  if (!Number.isInteger(competition_id) || competition_id <= 0) {
    throw new Error("Set a valid COMPETITION_ID in .env.");
  }

  const data = await playBetMan.fetchStanding({ competition_id });
  console.log("Connection successful. Response preview:");
  console.log(JSON.stringify(data, null, 2).slice(0, 12000));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
