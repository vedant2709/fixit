import pool from "../config/db.js";

export const createBooking = async ({ service_type, slot_time, address }) => {
  const query = `
    INSERT INTO bookings (
        service_type,
        slot_time,
        address
    )
    VALUES ($1, $2, $3)
    RETURNING *;
    `;

  const values = [service_type, slot_time, address];

  const result = await pool.query(query, values);

  return result.rows[0];
};

export const getBookings = async ({ status, service_type }) => {
  let query = `
    SELECT *
    FROM bookings
  `;

  const values = [];
  const conditions = [];

  if (status) {
    values.push(status);
    conditions.push(`status = $${values.length}`);
  }

  if (service_type) {
    values.push(service_type);
    conditions.push(`service_type = $${values.length}`);
  }

  if (conditions.length > 0) {
    query += ` WHERE ${conditions.join(" AND ")}`;
  }

  query += ` ORDER BY created_at DESC`;

  const result = await pool.query(query, values);

  return result.rows;
};

export const getBookingById = async (id) => {
  const query = `
    SELECT *
    FROM bookings 
    WHERE id = $1;
  `;

  const result = await pool.query(query, [id]);

  return result.rows[0] || null;
};

export const updateBookingStatus = async (id, status) => {
  const query = `
    UPDATE bookings
    SET
      status = $1,
      updated_at = NOW()
    WHERE id = $2
    RETURNING *;
  `;

  const values = [status, id];

  const result = await pool.query(query, values);

  return result.rows[0] || null;
};
