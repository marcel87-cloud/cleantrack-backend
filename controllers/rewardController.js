const pool = require("../config/db");
const getMyRewards = async (req, res) => {
  try {
    const [[summary]] = await pool.query("SELECT COALESCE(points, 0) AS points FROM customer_points WHERE customer_id = ?", [req.user.id]);
    const [transactions] = await pool.query(
      `SELECT pt.id, pt.pickup_request_id, pt.points_awarded, pt.reason, pt.created_at,
              cl.location_name
       FROM points_transactions pt JOIN pickup_requests pr ON pr.id = pt.pickup_request_id
       JOIN customer_locations cl ON cl.id = pr.location_id
       WHERE pt.customer_id = ? ORDER BY pt.created_at DESC`, [req.user.id]
    );
    res.json({ points: summary?.points || 0, transactions, pointsPerCollection: 10 });
  } catch (error) {
    res.status(500).json({ message: "Could not load rewards" });
  }
};
module.exports = { getMyRewards };
