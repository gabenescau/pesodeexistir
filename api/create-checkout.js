import { findOrCreateCustomer, findOrCreateProduct, createCheckout } from "./abacatepay.js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function upsertSubscriptionInSupabase({ userId, email, plan, checkoutId }) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.warn("Supabase credentials not configured for server");
    return;
  }

  const now = new Date().toISOString();
  const isAnnual = plan === "annual";
  const durationDays = isAnnual ? 365 : 30;

  const payload = {
    user_id: userId,
    customer_email: email || "",
    plan: isAnnual ? "ope_club_annual" : "ope_club_monthly",
    status: "pending",
    current_period_start: now,
    current_period_end: new Date(Date.now() + durationDays * 86400000).toISOString(),
    provider: "abacatepay",
    metadata: {
      checkout_id: checkoutId,
      plan,
      source: "abacatepay_checkout",
    },
    updated_at: now,
  };

  const res = await fetch(`${SUPABASE_URL}/rest/v1/subscriptions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_SERVICE_KEY,
      "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
      "Prefer": "return=representation",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    console.error("Erro ao salvar subscription no Supabase:", await res.text());
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Método não permitido" });
  }

  try {
    const { plan, userId, email, name, taxId } = req.body;

    if (!plan || !userId || !email) {
      return res.status(400).json({
        success: false,
        error: "Campos obrigatórios: plan, userId, email",
      });
    }

    if (plan !== "monthly" && plan !== "annual") {
      return res.status(400).json({
        success: false,
        error: "Plano inválido. Use 'monthly' ou 'annual'",
      });
    }

    const externalId = plan === "monthly" ? "ope_club_monthly" : "ope_club_annual";
    const productName = plan === "monthly" ? "OPE Club Mensal" : "OPE Club Anual";
    const productPrice = plan === "monthly" ? 2400 : 14400;

    const customer = await findOrCreateCustomer({ email, name, taxId });

    const product = await findOrCreateProduct({
      externalId,
      name: productName,
      price: productPrice,
      description: plan === "monthly"
        ? "Assinatura mensal OPE Club"
        : "Assinatura anual OPE Club com mais de 50% de desconto",
    });

    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:5173";

    const checkout = await createCheckout({
      customerId: customer.id,
      items: [{ id: product.id, quantity: 1 }],
      returnUrl: `${baseUrl}/pagamento/processando`,
      completionUrl: `${baseUrl}/pagamento/processando`,
      methods: ["PIX", "CARD"],
    });

    await upsertSubscriptionInSupabase({
      userId,
      email,
      plan,
      checkoutId: checkout.id,
    });

    res.status(200).json({
      success: true,
      data: {
        url: checkout.url,
        checkoutId: checkout.id,
      },
    });
  } catch (error) {
    console.error("Erro ao criar checkout:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Erro interno ao criar checkout",
    });
  }
}