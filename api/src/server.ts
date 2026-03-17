import express from "express";
import path from "path";
import progressRouter from "./routes/progress";
import webhookRouter from "./routes/webhook";
import { initDB } from "./db";

const app = express();
const PORT = parseInt(process.env.PORT ?? "3000", 10);
const SITE_ORIGIN = process.env.SITE_ORIGIN ?? "http://localhost:3000";

// CORS — allow the marketing site and ChatGPT to call the API
app.use((_req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Webhook-Secret");
  if (_req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});

// Stripe webhook needs raw body for signature verification
app.use(
  "/webhook",
  express.raw({ type: "application/json" }),
  webhookRouter
);

// All other routes use JSON body parsing
app.use(express.json());

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Progress routes (GPT-facing, Bearer-auth protected)
app.use("/progress", progressRouter);

// 404 fallback
app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

initDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`API running on port ${PORT}`);
      console.log(`SITE_ORIGIN: ${SITE_ORIGIN}`);
    });
  })
  .catch((err) => {
    console.error("Failed to initialize database:", err);
    process.exit(1);
  });

export default app;
