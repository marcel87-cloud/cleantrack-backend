const pool = require("../config/db");

const createRequest = async (req, res) => {
  try {
    const { requested_date, reason } = req.body;
    if (!requested_date || !reason?.trim()) return res.status(400).json({ message: "A requested date and reason are required" });
    const date = new Date(`${requested_date}T00:00:00`);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (Number.isNaN(date.getTime()) || date <= today) return res.status(400).json({ message: "Choose a future date" });
    const [pickups] = await pool.query(
      "SELECT id, status FROM pickup_requests WHERE id = ? AND customer_id = ?",
      [req.params.pickupId, req.user.id]
    );
    if (!pickups.length) return res.status(404).json({ message: "Pickup request not found" });
    if (!["pending", "assigned"].includes(pickups[0].status)) return res.status(400).json({ message: "Only pending or assigned pickups can be rescheduled" });
    const [existing] = await pool.query("SELECT id FROM pickup_reschedule_requests WHERE pickup_request_id = ? AND status = 'pending'", [req.params.pickupId]);
    if (existing.length) return res.status(409).json({ message: "A rescheduling request is already awaiting review" });
    const [result] = await pool.query(
      "INSERT INTO pickup_reschedule_requests (pickup_request_id, customer_id, requested_date, reason) VALUES (?, ?, ?, ?)",
      [req.params.pickupId, req.user.id, requested_date, reason.trim()]
    );
    res.status(201).json({ message: "Rescheduling request submitted", id: result.insertId });
  } catch (error) {
    res.status(500).json({ message: "Could not submit rescheduling request" });
  }
};

const listMyRequests = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT rr.*, pr.status AS pickup_status, pr.scheduled_for, cl.location_name, wc.name AS waste_type
       FROM pickup_reschedule_requests rr
       JOIN pickup_requests pr ON pr.id = rr.pickup_request_id
       JOIN customer_locations cl ON cl.id = pr.location_id
       JOIN waste_categories wc ON wc.id = pr.waste_category_id
       WHERE rr.customer_id = ? ORDER BY rr.created_at DESC`, [req.user.id]
    );
    res.json(rows);
  } catch (error) { res.status(500).json({ message: "Could not load rescheduling requests" }); }
};

const listForReview = async (req, res) => {
  try {
    let scope = "";
    const params = [];
    if (req.user.role === "manager") {
      scope = `AND EXISTS (SELECT 1 FROM pickup_assignments pa JOIN waste_companies wc2 ON wc2.id = pa.company_id
                          WHERE pa.pickup_request_id = pr.id AND wc2.manager_id = ?)`;
      params.push(req.user.id);
    }
    const [rows] = await pool.query(
      `SELECT rr.*, pr.status AS pickup_status, pr.scheduled_for, cl.location_name, cl.district,
              wc.name AS waste_type, u.full_name AS customer_name
       FROM pickup_reschedule_requests rr
       JOIN pickup_requests pr ON pr.id = rr.pickup_request_id
       JOIN customer_locations cl ON cl.id = pr.location_id
       JOIN waste_categories wc ON wc.id = pr.waste_category_id
       JOIN users u ON u.id = rr.customer_id
       WHERE rr.status = 'pending' ${scope} ORDER BY rr.created_at ASC`, params
    );
    res.json(rows);
  } catch (error) { res.status(500).json({ message: "Could not load requests for review" }); }
};

const reviewRequest = async (req, res) => {
  const { decision } = req.body;
  if (!["approved", "rejected"].includes(decision)) return res.status(400).json({ message: "Decision must be approved or rejected" });
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    let scope = "";
    const params = [req.params.id];
    if (req.user.role === "manager") { scope = "AND EXISTS (SELECT 1 FROM pickup_assignments pa JOIN waste_companies wc ON wc.id = pa.company_id WHERE pa.pickup_request_id = rr.pickup_request_id AND wc.manager_id = ?)"; params.push(req.user.id); }
    const [rows] = await connection.query(
      `SELECT rr.id, rr.pickup_request_id, rr.requested_date FROM pickup_reschedule_requests rr
       WHERE rr.id = ? AND rr.status = 'pending' ${scope} FOR UPDATE`, params
    );
    if (!rows.length) { await connection.rollback(); return res.status(404).json({ message: "Pending request not found or not in your company" }); }
    const request = rows[0];
    await connection.query("UPDATE pickup_reschedule_requests SET status = ?, reviewed_by = ?, reviewed_at = NOW() WHERE id = ?", [decision, req.user.id, request.id]);
    if (decision === "approved") {
      await connection.query("UPDATE pickup_requests SET scheduled_for = ? WHERE id = ? AND status IN ('pending', 'assigned')", [request.requested_date, request.pickup_request_id]);
    }
    await connection.commit();
    res.json({ message: `Rescheduling request ${decision}` });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ message: "Could not review request" });
  } finally { connection.release(); }
};
module.exports = { createRequest, listMyRequests, listForReview, reviewRequest };
