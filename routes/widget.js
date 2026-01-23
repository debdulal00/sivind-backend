const express = require("express");
const admin = require("firebase-admin");
const jwt = require("jsonwebtoken");

const router = express.Router();

/* ============================
   🔐 Auth Middleware (reuse)
============================ */
const authenticate = async (req, res, next) => {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) {
      return res.status(401).json({ error: "Missing token" });
    }

    const decoded = await admin.auth().verifyIdToken(token);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: "Invalid token" });
  }
};

/* ============================
   POST /widget/token
============================ */
router.post("/token", authenticate, async (req, res) => {
  try {
    const uid = req.user.uid;

    const widgetToken = jwt.sign(
      { storeId: uid },
      process.env.WIDGET_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      token: widgetToken,
      storeId: uid
    });
  } catch (err) {
    console.error("Widget token error:", err);
    res.status(500).json({ error: "Failed to generate widget token" });
  }
});

/* ============================
   GET /widget/status
============================ */
router.get("/status", authenticate, async (req, res) => {
  res.json({
    status: "inactive",
    activeVisitors: 0,
    loads: 0
  });
});

module.exports = router;

