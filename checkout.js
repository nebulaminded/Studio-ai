const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
  // Only allow POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { plan } = req.body;

  // ── Paste your Stripe Price IDs here ────────────────────────
  const prices = {
    pro:  process.env.STRIPE_PRICE_PRO,
    team: process.env.STRIPE_PRICE_TEAM,
  };

  if (!prices[plan]) {
    return res.status(400).json({ error: `Unknown plan: ${plan}` });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: prices[plan], quantity: 1 }],
      success_url: `${req.headers.origin}/?success=true&plan=${plan}`,
      cancel_url:  `${req.headers.origin}/?canceled=true`,
      // Optional: collect billing address
      billing_address_collection: "auto",
      // Optional: allow promo codes
      allow_promotion_codes: true,
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("Stripe error:", err.message);
    res.status(500).json({ error: err.message });
  }
};
