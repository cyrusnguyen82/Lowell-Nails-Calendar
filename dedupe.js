const db = require("./db");

/**
 * Automatically removes duplicate records from the database.
 * Handles clients (by normalized phone), appointments (by time/tech), 
 * and gift cards (by card number).
 */
async function runDedupe() {
  console.log("[Dedupe] Starting automated database cleanup...");
  try {
    // 1. Remove duplicate clients based on normalized phone numbers (keeping the oldest)
    const clientRes = await db.query(`
      DELETE FROM clients a USING clients b
      WHERE a.id > b.id
        AND regexp_replace(a.phone, '\\D', '', 'g') = regexp_replace(b.phone, '\\D', '', 'g')
    `);

    // 2. Remove identical duplicate appointments
    const apptRes = await db.query(`
      DELETE FROM appointments a USING appointments b
      WHERE a.id > b.id
        AND a.technician_id = b.technician_id
        AND a.date = b.date
        AND a.start_time = b.start_time
        AND a.client_phone = b.client_phone
    `);

    // 3. Remove duplicate gift cards
    const gcRes = await db.query(`
      DELETE FROM gift_cards a USING gift_cards b
      WHERE a.id > b.id
        AND a.card_number = b.card_number
    `);

    console.log(`[Dedupe] Cleanup complete. Removed: ${clientRes.rowCount} clients, ${apptRes.rowCount} appointments, ${gcRes.rowCount} gift cards.`);
  } catch (err) {
    console.error("[Dedupe] Error during cleanup:", err.message);
  }
}

module.exports = runDedupe;