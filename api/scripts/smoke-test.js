#!/usr/bin/env node
/**
 * Smoke test — runs against a local (or remote) API.
 * Usage:
 *   node scripts/smoke-test.js                          # localhost:3000
 *   node scripts/smoke-test.js https://your-render-url  # production
 */

const BASE = process.argv[2] ?? "http://localhost:3000";
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET ?? "dev-secret";

let passed = 0;
let failed = 0;

async function step(label, fn) {
  try {
    const result = await fn();
    console.log(`  ✓  ${label}`);
    passed++;
    return result;
  } catch (err) {
    console.error(`  ✗  ${label}`);
    console.error(`     ${err.message}`);
    failed++;
    return null;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function json(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Non-JSON response (${res.status}): ${text.slice(0, 200)}`);
  }
}

(async () => {
  console.log(`\nSmoke test → ${BASE}\n`);

  // 1. Health check
  await step("GET /health returns ok", async () => {
    const res = await fetch(`${BASE}/health`);
    const body = await json(res);
    assert(res.ok, `HTTP ${res.status}`);
    assert(body.status === "ok", `status != ok: ${JSON.stringify(body)}`);
  });

  // 2. Provision a test user via webhook
  const testEmail = `smoke-${Date.now()}@test.com`;
  let token = null;

  await step("POST /webhook provisions user", async () => {
    const res = await fetch(`${BASE}/webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Secret": WEBHOOK_SECRET,
      },
      body: JSON.stringify({
        type: "checkout.session.completed",
        data: { object: { customer_email: testEmail } },
      }),
    });
    const body = await json(res);
    assert(res.ok, `HTTP ${res.status}: ${JSON.stringify(body)}`);
    assert(body.token, "No token in response");
    token = body.token;
  });

  if (!token) {
    console.error("\nAborted — could not provision user.\n");
    process.exit(1);
  }

  // 3. GET /progress
  await step("GET /progress returns session state", async () => {
    const res = await fetch(`${BASE}/progress`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await json(res);
    assert(res.ok, `HTTP ${res.status}`);
    assert(body.currentLesson === "1.1", `Expected currentLesson=1.1, got ${body.currentLesson}`);
    assert(body.completedCount === 0, `Expected 0 completed, got ${body.completedCount}`);
  });

  // 4. GET /progress/curriculum
  await step("GET /progress/curriculum returns 6 modules", async () => {
    const res = await fetch(`${BASE}/progress/curriculum`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await json(res);
    assert(res.ok, `HTTP ${res.status}`);
    assert(body.curriculum.length === 6, `Expected 6 modules, got ${body.curriculum.length}`);
  });

  // 5. POST /progress/complete
  await step("POST /progress/complete marks lesson 1.1 done", async () => {
    const res = await fetch(`${BASE}/progress/complete`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ lessonId: "1.1", quizScore: 90 }),
    });
    const body = await json(res);
    assert(res.ok, `HTTP ${res.status}`);
    assert(body.success === true, "success != true");
    assert(body.currentLesson === "1.2", `Expected currentLesson=1.2, got ${body.currentLesson}`);
  });

  // 6. POST /progress/jump
  await step("POST /progress/jump sets lesson to 2.1", async () => {
    const res = await fetch(`${BASE}/progress/jump`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ lessonId: "2.1" }),
    });
    const body = await json(res);
    assert(res.ok, `HTTP ${res.status}`);
    assert(body.currentLesson === "2.1", `Expected 2.1, got ${body.currentLesson}`);
  });

  // 7. Invalid token returns 401
  await step("Invalid token returns 401", async () => {
    const res = await fetch(`${BASE}/progress`, {
      headers: { Authorization: "Bearer bad-token-xyz" },
    });
    assert(res.status === 401, `Expected 401, got ${res.status}`);
  });

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
})();
