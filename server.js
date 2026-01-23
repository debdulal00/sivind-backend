/**
 * 🔥 CONFIRM FILE LOAD
 */
console.log("🔥 SERVER.JS LOADED - WIDGET ROUTES SHOULD EXIST");

/**
 * ============================
 * ENV
 * ============================
 */
require("dotenv").config();

/**
 * ============================
 * CORE IMPORTS
 * ============================
 */
const express = require("express");
const http = require("http");
const cors = require("cors");
const Stripe = require("stripe");
const { Server } = require("socket.io");

/**
 * ============================
 * APP + SERVER
 * ============================
 */
const app = express();
const server = http.createServer(app);

/**
 * ============================
 * FIREBASE ADMIN (SINGLETON)
 * ============================
 */
const admin = require("./firebaseAdmin");
const db = admin.firestore();

/**
 * ============================
 * GLOBAL MIDDLEWARE (ORDER MATTERS)
 * ============================
 */
app.use(cors());              // ✅ MUST BE FIRST
app.use(express.json());      // ✅ SECOND

/**
 * ============================
 * ROUTES (LOAD AFTER MIDDLEWARE)
 * ============================
 */
const widgetRoutes = require("./routes/widget");
const dashboardRoutes = require("./routes/dashboard");
const aiRoutes = require("./routes/ai");

app.use("/widget", widgetRoutes);
app.use("/dashboard", dashboardRoutes);
app.use("/ai", aiRoutes);

console.log("✅ /widget, /dashboard, /ai routes mounted");

/**
 * ============================
 * STRIPE
 * ============================
 */
if (!process.env.STRIPE_SECRET_KEY) {
  console.error("❌ STRIPE_SECRET_KEY missing");
  process.exit(1);
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/**
 * ============================
 * AUTH MIDDLEWARE
 * ============================
 */
const authenticate = async (req, res, next) => {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) {
      return res.status(401).json({ error: "Missing token" });
    }

    const decoded = await admin.auth().verifyIdToken(token);
    req.user = { uid: decoded.uid, email: decoded.email };
    next();
  } catch (err) {
    console.error("Auth error:", err.message);
    res.status(403).json({ error: "Invalid token" });
  }
};

/**
 * ============================
 * STRIPE WEBHOOK (RAW BODY)
 * ============================
 */
app.post(
  "/stripe-webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"];
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error("Webhook error:", err.message);
      return res.status(400).send("Webhook Error");
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;

      const fullSession = await stripe.checkout.sessions.retrieve(session.id, {
        expand: ["line_items"],
      });

      const priceId = fullSession.line_items.data[0].price.id;
      const userId = session.client_reference_id;

      let plan = "free";
      if (priceId === "price_1SnzoLEv6RJNuYH7bsph36eN") plan = "growth";
      if (priceId === "price_1SnzorEv6RJNuYH7HXY0Ct3T") plan = "pro";

      await db.collection("users").doc(userId).set(
        {
          plan,
          status: "active",
          stripeCustomerId: session.customer,
          subscriptionId: session.subscription,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      console.log("🔥 User upgraded:", userId, plan);
    }

    res.json({ received: true });
  }
);

/**
 * ============================
 * STRIPE CHECKOUT
 * ============================
 */
app.post("/create-checkout", authenticate, async (req, res) => {
  try {
    const { priceId } = req.body;
    const { uid, email } = req.user;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: email,
      client_reference_id: uid,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: "https://sivind.com/dashboard.html",
      cancel_url: "https://sivind.com/dashboard.html",
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error("Checkout error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * ============================
 * HEALTH CHECK
 * ============================
 */
app.get("/", (req, res) => {
  res.send("✅ SivInd backend running");
});

/**
 * ============================
 * SOCKET.IO
 * ============================
 */
const io = new Server(server, {
  cors: { origin: "*" },
});

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) throw new Error("Missing token");

    const decoded = await admin.auth().verifyIdToken(token);
    socket.user = { uid: decoded.uid, email: decoded.email };
    socket.join(decoded.uid);
    next();
  } catch {
    next(new Error("Unauthorized"));
  }
});

io.on("connection", (socket) => {
  console.log("🔌 Socket connected:", socket.user.uid);
});

/**
 * ============================
 * CLOUD RUN PORT (REQUIRED)
 * ============================
 */
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`🚀 SivInd backend listening on port ${PORT}`);
});

