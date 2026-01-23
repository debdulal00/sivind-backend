const express = require("express");
const verifyFirebaseToken = require("../middleware/auth");

const router = express.Router();

/**
 * GET /dashboard/activity
 */
router.get("/activity", verifyFirebaseToken, (req, res) => {
  res.json({
    activities: []
  });
});

module.exports = router;
