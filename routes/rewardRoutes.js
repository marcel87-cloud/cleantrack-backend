const express = require("express");
const { getMyRewards } = require("../controllers/rewardController");
const { protect } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/roleMiddleware");
const router = express.Router();
router.get("/my", protect, allowRoles("customer"), getMyRewards);
module.exports = router;
