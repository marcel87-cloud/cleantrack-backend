const pool = require("../config/db");

const listMySchedules = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT ps.*, cl.location_name, wc.name AS waste_type
       FROM pickup_schedules ps
       JOIN customer_locations cl ON cl.id = ps.location_id
       JOIN waste_categories wc ON wc.id = ps.waste_category_id
       WHERE ps.customer_id = ? ORDER BY ps.created_at DESC`, [req.user.id]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: "Could not load pickup schedules" });
  }
};

const createSchedule = async (req, res) => {
  try {
    const { location_id, waste_category_id, frequency, weekday, day_of_month, start_date, end_date } = req.body;
    if (!location_id || !waste_category_id || !start_date || !["weekly", "monthly"].includes(frequency)) {
      return res.status(400).json({ message: "Location, waste type, frequency and start date are required" });
    }
    if (end_date && end_date < start_date) return res.status(400).json({ message: "End date cannot be before start date" });
    if (frequency === "weekly" && (!Number.isInteger(Number(weekday)) || Number(weekday) < 0 || Number(weekday) > 6)) {
      return res.status(400).json({ message: "Choose a valid weekday for a weekly schedule" });
    }
    if (frequency === "monthly" && (!Number.isInteger(Number(day_of_month)) || Number(day_of_month) < 1 || Number(day_of_month) > 28)) {
      return res.status(400).json({ message: "Choose a day from 1 to 28 for a monthly schedule" });
    }
    // The first generated pickup is the selected weekday/day on or after the start date.
    const start = new Date(`${start_date}T00:00:00Z`);
    if (Number.isNaN(start.getTime())) return res.status(400).json({ message: "Choose a valid start date" });
    let firstRun = new Date(start);
    if (frequency === "weekly") {
      const delta = (Number(weekday) - start.getUTCDay() + 7) % 7;
      firstRun.setUTCDate(firstRun.getUTCDate() + delta);
    } else {
      firstRun.setUTCDate(Number(day_of_month));
      if (firstRun < start) firstRun.setUTCMonth(firstRun.getUTCMonth() + 1);
    }
    const nextRunDate = firstRun.toISOString().slice(0, 10);
    if (end_date && end_date < nextRunDate) return res.status(400).json({ message: "End date must include at least one scheduled pickup" });
    const [locations] = await pool.query("SELECT id FROM customer_locations WHERE id = ? AND user_id = ?", [location_id, req.user.id]);
    if (!locations.length) return res.status(403).json({ message: "Choose one of your own locations" });
    const [categories] = await pool.query("SELECT id FROM waste_categories WHERE id = ? AND status = 'active'", [waste_category_id]);
    if (!categories.length) return res.status(400).json({ message: "Choose an active waste category" });
    const [result] = await pool.query(
      `INSERT INTO pickup_schedules (customer_id, location_id, waste_category_id, frequency, weekday, day_of_month, start_date, next_run_date, end_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.id, location_id, waste_category_id, frequency, frequency === "weekly" ? Number(weekday) : null,
       frequency === "monthly" ? Number(day_of_month) : null, start_date, nextRunDate, end_date || null]
    );
    res.status(201).json({ message: "Recurring pickup schedule saved", id: result.insertId });
  } catch (error) {
    res.status(500).json({ message: "Could not create schedule" });
  }
};

const updateScheduleStatus = async (req, res) => {
  const { status } = req.body;
  if (!["active", "paused", "cancelled"].includes(status)) return res.status(400).json({ message: "Invalid schedule status" });
  const [result] = await pool.query("UPDATE pickup_schedules SET status = ? WHERE id = ? AND customer_id = ?", [status, req.params.id, req.user.id]);
  if (!result.affectedRows) return res.status(404).json({ message: "Schedule not found" });
  res.json({ message: `Schedule ${status}` });
};

// Called at server startup and daily. Missed runs are caught up after a restart.
const dateOnly = (value) => value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
const generateDuePickups = async () => {
  const connection = await pool.getConnection();
  try {
    const [schedules] = await connection.query(
      `SELECT * FROM pickup_schedules WHERE status = 'active' AND next_run_date <= CURDATE()
       AND (end_date IS NULL OR next_run_date <= end_date) ORDER BY next_run_date ASC`
    );
    for (const schedule of schedules) {
      let runDate = dateOnly(schedule.next_run_date);
      while (runDate <= new Date().toISOString().slice(0, 10) && (!schedule.end_date || runDate <= dateOnly(schedule.end_date))) {
        await connection.beginTransaction();
        try {
          await connection.query(
            `INSERT INTO pickup_requests (customer_id, location_id, waste_category_id, description, urgency, estimated_bin_level, scheduled_for)
             VALUES (?, ?, ?, ?, 'normal', 50, ?)`,
            [schedule.customer_id, schedule.location_id, schedule.waste_category_id, 'Generated from recurring pickup schedule', runDate]
          );
          const [dates] = await connection.query(
            schedule.frequency === 'weekly'
              ? 'SELECT DATE_ADD(?, INTERVAL 7 DAY) AS next_date'
              : 'SELECT DATE_ADD(?, INTERVAL 1 MONTH) AS next_date', [runDate]
          );
          const nextDate = dateOnly(dates[0].next_date);
          await connection.query('UPDATE pickup_schedules SET next_run_date = ? WHERE id = ?', [nextDate, schedule.id]);
          await connection.commit();
          runDate = nextDate;
        } catch (error) {
          await connection.rollback();
          throw error;
        }
      }
    }
  } catch (error) {
    console.error('Recurring pickup generation failed:', error.message);
  } finally {
    connection.release();
  }
};

module.exports = { listMySchedules, createSchedule, updateScheduleStatus, generateDuePickups };
