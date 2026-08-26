import pool from "./db.js";

async function testConnection() {
  try {
    const result = await pool.query("SELECT 1 AS result");
    console.log("Database test successful:", result.rows);
  } catch (error) {
    console.error("Database connection failed:", error);
  } finally {
    await pool.end();
  }
}

testConnection();
