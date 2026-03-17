import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { createUser } from "../db";

const router = Router();

// Stripe sends raw body for signature verification — mount with express.raw()
router.post("/", async (req: Request, res: Response) => {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const sigHeader = req.headers["stripe-signature"] as string | undefined;

  let event: { type: string; data: { object: { customer_email?: string; customer_details?: { email?: string } } } };

  if (webhookSecret && sigHeader) {
    // Proper Stripe signature verification (requires express.raw() middleware on this route)
    try {
      const stripe = (await import("stripe")).default;
      const stripeClient = new stripe(process.env.STRIPE_SECRET_KEY ?? "", {
        apiVersion: "2023-10-16",
      });
      event = stripeClient.webhooks.constructEvent(
        req.body as Buffer,
        sigHeader,
        webhookSecret
      ) as typeof event;
    } catch (err) {
      console.error("Stripe signature verification failed:", err);
      res.status(400).json({ error: "Webhook signature invalid" });
      return;
    }
  } else {
    // Dev/test fallback: trust raw JSON body, verify shared secret
    const sharedSecret = process.env.WEBHOOK_SECRET;
    const providedSecret = req.headers["x-webhook-secret"] as string | undefined;
    if (sharedSecret && providedSecret !== sharedSecret) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    // express.raw() gives us a Buffer; parse it
    const raw = req.body as Buffer | string | object;
    if (Buffer.isBuffer(raw)) {
      event = JSON.parse(raw.toString("utf-8")) as typeof event;
    } else if (typeof raw === "string") {
      event = JSON.parse(raw) as typeof event;
    } else {
      event = raw as typeof event;
    }
  }

  if (event.type !== "checkout.session.completed") {
    res.json({ received: true, action: "ignored" });
    return;
  }

  const session = event.data.object;
  const email =
    session.customer_email ??
    session.customer_details?.email ??
    null;

  if (!email) {
    console.error("No email found in checkout.session.completed event");
    res.status(400).json({ error: "No email in event" });
    return;
  }

  const token = uuidv4();
  await createUser(token, email);

  await sendWelcomeEmail(email, token);

  console.log(`Provisioned user: ${email} → token: ${token}`);
  res.json({ received: true, token });
});

async function sendWelcomeEmail(email: string, token: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log(`[email skipped — no RESEND_API_KEY] Would send to ${email}, token: ${token}`);
    return;
  }

  const { Resend } = await import("resend");
  const resend = new Resend(apiKey);

  const gptLink = "https://chatgpt.com/g/g-YOUR-GPT-ID"; // update after GPT is published

  await resend.emails.send({
    from: process.env.FROM_EMAIL ?? "hello@affective-analytics.com",
    to: email,
    subject: "You're enrolled — here's your access link",
    html: `
      <p>Thanks for enrolling in <strong>Probabilistic Thinking</strong>.</p>
      <p>Here's how to get started:</p>
      <ol>
        <li>Open the course: <a href="${gptLink}">${gptLink}</a></li>
        <li>When the GPT asks for your access token, paste this:<br>
            <code style="background:#f4f4f4;padding:4px 8px;border-radius:4px;">${token}</code>
        </li>
      </ol>
      <p>The course picks up where you left off each session. Save this email so you always have your token handy.</p>
      <p>Questions? Reply to this email.</p>
    `,
  });
}

export default router;
