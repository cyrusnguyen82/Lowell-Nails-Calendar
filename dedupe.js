const db = require("./db");

/**
 * Database Fresh Start Utility.
 * Clears all transaction data (appointments, clients, gift cards).
 * Keeps configuration data (technicians).
 */
async function runDedupe() {
  console.log("[Maintenance] Starting ONE-TIME database wipe for fresh start...");
  try {
    await db.query("TRUNCATE TABLE appointments, clients, gift_cards RESTART IDENTITY CASCADE");
    console.log("[Maintenance] Success: Appointments, Clients, and Gift Cards cleared.");
  } catch (err) {
    console.error("[Maintenance] Wipe failed:", err.message);
  }
}

module.exports = runDedupe;