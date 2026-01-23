const express = require("express");
const admin = require("../firebaseAdmin");
const jwt = require("jsonwebtoken");

const router = express.Router();

/* ============================
   🔐 Firebase Auth (Dashboard only)
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
  } catch {
    return res.status(403).json({ error: "Invalid token" });
  }
};

/* ============================
   POST /widget/token
   (Dashboard → Widget JWT)
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
   GET /widget/status (PUBLIC)
============================ */
router.get("/status", async (req, res) => {
  res.json({
    status: "inactive",
    activeVisitors: 0,
    loads: 0
  });
});

/* ============================
   POST /widget/message ✅ NEW
   (Widget → Backend)
============================ */
router.post("/message", async (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({ error: "Missing widget token" });
    }

    // Verify widget JWT (NOT Firebase)
    const decoded = jwt.verify(token, process.env.WIDGET_SECRET);
    const { storeId } = decoded;

    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ error: "Message required" });
    }

    // 🔥 TEMP AI (Echo mode)
    const reply = `You said: "${message}"`;

    res.json({ reply });
  } catch (err) {
    console.error("Widget message error:", err.message);
    res.status(403).json({ error: "Invalid widget token" });
  }
});

module.exports = router;

