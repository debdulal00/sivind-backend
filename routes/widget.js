const express = require("express");
const jwt = require("jsonwebtoken");
const admin = require("../firebaseAdmin");

const router = express.Router();

/* ============================
   Dashboard Auth (Firebase)
============================ */
const authenticateDashboard = async (req, res, next) => {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Missing token" });

    const decoded = await admin.auth().verifyIdToken(token);
    req.user = decoded;
    next();
  } catch {
    res.status(403).json({ error: "Invalid token" });
  }
};

/* ============================
   POST /widget/token
============================ */
router.post("/token", authenticateDashboard, async (req, res) => {
  const uid = req.user.uid;

  const widgetToken = jwt.sign(
    { storeId: uid },
    process.env.WIDGET_SECRET,
    { expiresIn: "7d" }
  );

  res.json({ token: widgetToken, storeId: uid });
});

/* ============================
   GET /widget/status (PUBLIC)
============================ */
router.get("/status", (req, res) => {
  res.json({
    status: "inactive",
    activeVisitors: 0,
    loads: 0
  });
});

/* ============================
   POST /widget/message 🔥🔥🔥
============================ */
router.post("/message", async (req, res) => {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ")
      ? header.slice(7)
      : null;

    if (!token) {
      return res.status(401).json({ error: "Missing widget token" });
    }

    const decoded = jwt.verify(token, process.env.WIDGET_SECRET);
    const { storeId } = decoded;

    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ error: "Message required" });
    }

    // 🔥 TEMP AI (echo)
    const reply = `You said: "${message}"`;

    res.json({ reply });
  } catch (err) {
    console.error("Widget message error:", err.message);
    res.status(403).json({ error: "Invalid widget token" });
  }
});

module.exports = router;

