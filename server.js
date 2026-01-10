require("dotenv").config();
const express = require("express");
const Stripe = require("stripe");
const cors = require("cors");
const admin = require("firebase-admin");

const app = express();

/* ============================
   Stripe
============================ */
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/* ============================
   Firebase Admin
============================ */
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert({
import admin from "firebase-admin";

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  }),
});



const db = admin.firestore();

/* ============================
   Middleware
============================ */
app.use(cors());

// IMPORTANT: Stripe webhook must use RAW body
app.use("/stripe-webhook", express.raw({ type: "application/json" }));
app.use(express.json());

/* ============================
   Create Checkout Session
============================ */
app.post("/create-checkout", async (req, res) => {
  try {
    const { priceId, userId, email } = req.body;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: email,
      client_reference_id: userId,   // this links Stripe → Firebase user
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: "https://sivind.com/dashboard.html",
      cancel_url: "https://sivind.com/dashboard.html"
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error("Stripe error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ============================
   Stripe Webhook (FIXED)*/
app.get("/stripe-webhook", (req, res) => {
  res.send("Stripe webhook OK");
});
app.post("/stripe-webhook", async (req, res) => {
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      req.headers["stripe-signature"],
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.log("❌ Webhook verification failed:", err.message);
    return res.status(400).send("Webhook Error");
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;

    // 🔥 FIX: fetch line_items
    const fullSession = await stripe.checkout.sessions.retrieve(
      session.id,
      { expand: ["line_items"] }
    );

    const priceId = fullSession.line_items.data[0].price.id;
    const userId = session.client_reference_id;

    console.log("Paid price:", priceId);

    let plan = "free";
    if (priceId === "price_1SnzoLEv6RJNuYH7bsph36eN") plan = "growth";
    if (priceId === "price_1SnzorEv6RJNuYH7HXY0Ct3T") plan = "pro";

    await db.collection("users").doc(userId).update({
      plan: plan,
      status: "active",
      stripeCustomerId: session.customer,
      subscriptionId: session.subscription,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log("✅ User upgraded to", plan);
  }

  res.json({ received: true });
});

/* ============================
   Start Server
============================ */
app.listen(4242, () => {
  console.log("🚀 Stripe backend running on port 4242");
});
