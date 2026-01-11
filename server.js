require("dotenv").config();
const express = require("express");
const Stripe = require("stripe");
const cors = require("cors");
const admin = require("firebase-admin");

const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/* ============================
   Firebase
============================ */
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  }),
});

const db = admin.firestore();

/* ============================
   CORS
============================ */
app.use(cors());

/* ============================
   Stripe Webhook (RAW BODY ONLY)
   MUST come BEFORE any json()
============================ */
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
      console.error("❌ Signature verification failed:", err.message);
      return res.status(400).send("Webhook Error");
    }

    console.log("✅ Stripe event verified:", event.type);

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

      await db.collection("users").doc(userId).update({
        plan,
        status: "active",
        stripeCustomerId: session.customer,
        subscriptionId: session.subscription,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log("🔥 User upgraded:", userId, plan);
    }

    res.json({ received: true });
  }
);

/* ============================
   JSON for everything else
============================ */
app.use(express.json());

/* ============================
   Checkout API
============================ */
app.post("/create-checkout", async (req, res) => {
  try {
    const { priceId, userId, email } = req.body;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: email,
      client_reference_id: userId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: "https://sivind.com/dashboard.html",
      cancel_url: "https://sivind.com/dashboard.html",
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

/* ============================
   Health
============================ */
app.get("/", (req, res) => {
  res.send("Stripe backend running");
});

/* ============================
   Start
============================ */
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log("🚀 Stripe backend running on port", PORT);
});

