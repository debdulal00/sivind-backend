const express = require("express");
const verifyFirebaseToken = require("../middleware/auth");

const router = express.Router();

/**
 * GET /ai/metrics
 */
router.get("/metrics", verifyFirebaseToken, (req, res) => {
  res.json({
    metrics: {
      accuracy: 0,
      resolution: 0,
      speed: 0,
      uptime: 0,
      learningProgress: 0
    }
  });
});

module.exports = router;
