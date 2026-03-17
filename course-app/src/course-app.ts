import { App } from "@modelcontextprotocol/ext-apps";

// ─── Types ────────────────────────────────────────────────────────────────────

declare global {
  interface Window {
    openai?: {
      setWidgetState?: (state: unknown) => Promise<void>;
      sendFollowUpMessage?: (payload: { prompt: string; scrollToBottom?: boolean }) => Promise<void>;
      widgetState?: Partial<WidgetState>;
    };
  }
}

interface WidgetState {
  token: string;
  view: View;
  lessonId: string | null;
}

type View = "login" | "dashboard" | "lesson" | "lesson-complete";

// LessonRecord unused - progress data comes from API
interface ModuleStatus {
  module: number;
  title: string;
  unlocked: boolean;
  lessons: { id: string; completed: boolean }[];
}
interface ProgressData {
  email: string;
  currentLesson: string;
  completedCount: number;
  totalLessons: number;
  modules: ModuleStatus[];
}

// ─── Lesson + puzzle definitions ──────────────────────────────────────────────

interface Lesson {
  id: string;
  module: number;
  title: string;
  concept: string;
  puzzleType: "slider-certainty" | "phrase-match" | "classify-bias" | "ev-calc" | "commit";
}

const LESSONS: Lesson[] = [
  {
    id: "1.1",
    module: 1,
    title: "Why Certainty Is a Trap",
    concept: `Most decisions are made under uncertainty, but our brains are wired to seek certainty. When we say "this will work" or "that won't happen," we're not being confident — we're being imprecise. Probabilistic thinking means expressing beliefs as a range of possibilities with rough likelihoods. It's more accurate, and it leads to better decisions.`,
    puzzleType: "slider-certainty",
  },
  {
    id: "1.2",
    module: 1,
    title: "Probability as a Language",
    concept: `Probability is a way of expressing how confident you are that something is true. A probability of 70% means: if I faced this situation 10 times, I'd expect this outcome about 7 times. When you assign numbers to your beliefs, you can track whether your confidence is actually calibrated. Most people's intuitive probabilities are poorly calibrated — especially at the extremes.`,
    puzzleType: "phrase-match",
  },
  {
    id: "1.3",
    module: 1,
    title: "Overconfidence and Underconfidence",
    concept: `The two ways to be miscalibrated are overconfidence (your 90% calls are right only 60% of the time) and underconfidence (your 50% calls are right 80% of the time). Overconfidence is more common — especially in predictions about our own abilities and plans. But underconfidence has real costs too: excessive hedging, missed opportunities. Good probabilistic thinkers aim to be neither.`,
    puzzleType: "classify-bias",
  },
  {
    id: "1.4",
    module: 1,
    title: "Expected Value: The Core Calculation",
    concept: `Expected value is what you get when you multiply each outcome by its probability and sum them. A 50% chance of winning $200 has an expected value of $100 — the same as a guaranteed $100. Expected value is the backbone of rational decision-making under uncertainty. Crucially: a good decision can have a bad outcome, and vice versa. Evaluate the process, not just the result.`,
    puzzleType: "ev-calc",
  },
  {
    id: "1.5",
    module: 1,
    title: "Module 1 Synthesis",
    concept: `You've covered four ideas: probabilistic thinking means expressing beliefs as likelihoods rather than certainties; probability is a language for calibration; there are two failure modes — overconfidence and underconfidence; and expected value gives you a framework to compare options when outcomes are uncertain. The test of whether this landed is whether you'll actually use it.`,
    puzzleType: "commit",
  },
];

// ─── App state ────────────────────────────────────────────────────────────────

const API = "https://undeniable-thinking.onrender.com";

const state = {
  token: "",
  view: "login" as View,
  progress: null as ProgressData | null,
  currentLessonId: null as string | null,
  puzzleComplete: false,
};

const app = new App({ name: "Probabilistic Thinking", version: "0.1.0" });

// ─── Styles ───────────────────────────────────────────────────────────────────

const STYLES = `
  :root {
    --green: #1B4332;
    --green-mid: #2D6A4F;
    --green-light: #52796F;
    --cream: #F5F0E8;
    --white: #FFFFFF;
    --gray-50: #F9FAFB;
    --gray-100: #F3F4F6;
    --gray-200: #E5E7EB;
    --gray-400: #9CA3AF;
    --gray-600: #4B5563;
    --gray-800: #1F2937;
    --gold: #B7791F;
    --radius: 14px;
    --shadow: 0 4px 24px rgba(0,0,0,0.08);
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: Inter, system-ui, -apple-system, sans-serif;
    background: var(--cream);
    color: var(--gray-800);
    min-height: 100vh;
  }
  .shell {
    max-width: 720px;
    margin: 0 auto;
    padding: 20px 16px 40px;
  }
  /* ── Header ── */
  .header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 20px;
    background: var(--green);
    color: white;
    border-radius: var(--radius) var(--radius) 0 0;
  }
  .header-logo {
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    opacity: 0.7;
  }
  .header-title {
    font-size: 15px;
    font-weight: 600;
    flex: 1;
  }
  .header-progress {
    font-size: 13px;
    opacity: 0.7;
  }
  /* ── Card ── */
  .card {
    background: white;
    border-radius: 0 0 var(--radius) var(--radius);
    box-shadow: var(--shadow);
    overflow: hidden;
  }
  .card-body { padding: 28px 28px 32px; }
  /* ── Login ── */
  .login-eyebrow {
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--green-light);
    margin-bottom: 10px;
  }
  .login-h1 {
    font-size: 24px;
    font-weight: 700;
    color: var(--green);
    margin-bottom: 8px;
    line-height: 1.3;
  }
  .login-sub {
    font-size: 14px;
    color: var(--gray-600);
    margin-bottom: 28px;
    line-height: 1.6;
  }
  .field { margin-bottom: 16px; }
  .field label {
    display: block;
    font-size: 13px;
    font-weight: 600;
    color: var(--gray-800);
    margin-bottom: 6px;
  }
  .field input[type="text"],
  .field input[type="password"] {
    width: 100%;
    padding: 12px 14px;
    border: 1.5px solid var(--gray-200);
    border-radius: 10px;
    font: inherit;
    font-size: 14px;
    transition: border-color 0.15s;
    outline: none;
  }
  .field input:focus { border-color: var(--green-mid); }
  .error-msg {
    color: #B91C1C;
    font-size: 13px;
    margin-top: 8px;
    display: none;
  }
  /* ── Buttons ── */
  button {
    border: none;
    border-radius: 10px;
    padding: 12px 20px;
    font: inherit;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.15s, background 0.15s;
  }
  button:disabled { opacity: 0.45; cursor: default; }
  .btn-primary {
    background: var(--green);
    color: white;
    width: 100%;
  }
  .btn-primary:hover:not(:disabled) { background: var(--green-mid); }
  .btn-secondary {
    background: var(--gray-100);
    color: var(--gray-800);
  }
  .btn-secondary:hover:not(:disabled) { background: var(--gray-200); }
  .btn-sm {
    padding: 8px 14px;
    font-size: 13px;
  }
  /* ── Dashboard ── */
  .dash-welcome {
    font-size: 13px;
    color: var(--gray-600);
    margin-bottom: 6px;
  }
  .dash-h1 {
    font-size: 22px;
    font-weight: 700;
    color: var(--green);
    margin-bottom: 24px;
  }
  .module-card {
    border: 1.5px solid var(--gray-200);
    border-radius: var(--radius);
    overflow: hidden;
    margin-bottom: 12px;
  }
  .module-header {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 14px 18px;
    background: var(--gray-50);
    border-bottom: 1.5px solid var(--gray-200);
  }
  .module-num {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    font-weight: 700;
    flex-shrink: 0;
  }
  .module-num.done { background: var(--green); color: white; }
  .module-num.active { background: var(--green-mid); color: white; }
  .module-num.locked { background: var(--gray-200); color: var(--gray-400); }
  .module-name { font-size: 15px; font-weight: 600; flex: 1; }
  .module-status { font-size: 12px; color: var(--gray-400); }
  .module-status.done { color: var(--green); font-weight: 600; }
  .lesson-list { padding: 8px 18px 12px; }
  .lesson-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 9px 0;
    border-bottom: 1px solid var(--gray-100);
  }
  .lesson-row:last-child { border-bottom: none; }
  .lesson-dot {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    font-size: 11px;
  }
  .lesson-dot.done { background: #D1FAE5; color: var(--green); font-weight: 700; }
  .lesson-dot.current { background: var(--green); color: white; }
  .lesson-dot.upcoming { background: var(--gray-100); color: var(--gray-400); }
  .lesson-label { font-size: 14px; flex: 1; }
  .lesson-label.done { color: var(--gray-400); text-decoration: line-through; }
  .lesson-label.current { font-weight: 600; color: var(--green); }
  .locked-notice {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 18px;
    font-size: 13px;
    color: var(--gray-400);
    font-style: italic;
  }
  .continue-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 18px 0 0;
    margin-top: 8px;
    border-top: 1.5px solid var(--gray-200);
  }
  .continue-label { font-size: 14px; color: var(--gray-600); }
  .continue-label strong { color: var(--green); }
  /* ── Lesson ── */
  .lesson-eyebrow {
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--green-light);
    margin-bottom: 6px;
  }
  .lesson-h1 {
    font-size: 22px;
    font-weight: 700;
    color: var(--green);
    margin-bottom: 16px;
    line-height: 1.3;
  }
  .concept-box {
    background: var(--cream);
    border-left: 4px solid var(--green);
    border-radius: 0 10px 10px 0;
    padding: 16px 18px;
    margin-bottom: 28px;
    font-size: 14px;
    line-height: 1.75;
    color: var(--gray-800);
  }
  .puzzle-label {
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--gray-600);
    margin-bottom: 14px;
  }
  .puzzle-box {
    border: 1.5px solid var(--gray-200);
    border-radius: var(--radius);
    padding: 20px;
    margin-bottom: 24px;
    background: var(--gray-50);
  }
  /* ── Slider puzzle ── */
  .scenario {
    margin-bottom: 20px;
    padding-bottom: 20px;
    border-bottom: 1px solid var(--gray-200);
  }
  .scenario:last-of-type { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
  .scenario-text {
    font-size: 14px;
    font-style: italic;
    color: var(--gray-800);
    margin-bottom: 10px;
    line-height: 1.6;
  }
  .slider-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .slider-label { font-size: 12px; color: var(--gray-400); width: 30px; text-align: center; }
  input[type="range"] {
    flex: 1;
    accent-color: var(--green);
  }
  .slider-val {
    font-size: 15px;
    font-weight: 700;
    color: var(--green);
    width: 44px;
    text-align: center;
  }
  /* ── Phrase match ── */
  .phrase-grid {
    display: grid;
    gap: 10px;
  }
  .phrase-row {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .phrase-word {
    font-size: 14px;
    font-weight: 600;
    width: 130px;
    flex-shrink: 0;
  }
  .phrase-select {
    flex: 1;
    padding: 8px 10px;
    border: 1.5px solid var(--gray-200);
    border-radius: 8px;
    font: inherit;
    font-size: 13px;
    background: white;
    outline: none;
    cursor: pointer;
  }
  .phrase-select:focus { border-color: var(--green-mid); }
  .phrase-reveal {
    font-size: 12px;
    color: var(--green);
    width: 90px;
    text-align: right;
    font-weight: 600;
    opacity: 0;
    transition: opacity 0.3s;
  }
  .phrase-reveal.visible { opacity: 1; }
  /* ── Classify bias ── */
  .scenario-classify { margin-bottom: 16px; }
  .scenario-classify-text {
    font-size: 14px;
    line-height: 1.6;
    margin-bottom: 8px;
    color: var(--gray-800);
  }
  .classify-opts {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .classify-btn {
    padding: 6px 14px;
    font-size: 13px;
    border-radius: 20px;
    border: 1.5px solid var(--gray-200);
    background: white;
    color: var(--gray-800);
    cursor: pointer;
    transition: all 0.15s;
  }
  .classify-btn:hover { border-color: var(--green-mid); }
  .classify-btn.selected { background: var(--green); color: white; border-color: var(--green); }
  .classify-btn.correct { background: #D1FAE5; color: var(--green); border-color: var(--green); }
  .classify-btn.wrong { background: #FEE2E2; color: #B91C1C; border-color: #FCA5A5; }
  .classify-feedback {
    font-size: 13px;
    margin-top: 6px;
    font-style: italic;
    color: var(--gray-600);
    min-height: 18px;
  }
  /* ── EV calc ── */
  .ev-scenario {
    font-size: 14px;
    line-height: 1.6;
    margin-bottom: 16px;
    padding: 14px;
    background: white;
    border-radius: 10px;
    border: 1px solid var(--gray-200);
  }
  .ev-inputs { display: grid; gap: 12px; margin-bottom: 16px; }
  .ev-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .ev-label { font-size: 13px; font-weight: 600; flex: 1; }
  .ev-input {
    width: 110px;
    padding: 8px 10px;
    border: 1.5px solid var(--gray-200);
    border-radius: 8px;
    font: inherit;
    font-size: 13px;
    text-align: right;
    outline: none;
  }
  .ev-input:focus { border-color: var(--green-mid); }
  .ev-result {
    background: white;
    border: 1.5px solid var(--gray-200);
    border-radius: 10px;
    padding: 14px 16px;
    display: none;
  }
  .ev-result.visible { display: block; }
  .ev-result-num {
    font-size: 28px;
    font-weight: 700;
    color: var(--green);
    margin-bottom: 4px;
  }
  .ev-result-label { font-size: 13px; color: var(--gray-600); }
  .ev-verdict {
    margin-top: 10px;
    font-size: 14px;
    font-weight: 600;
    color: var(--gray-800);
  }
  /* ── Commit puzzle ── */
  .commit-prompt {
    font-size: 14px;
    line-height: 1.6;
    color: var(--gray-800);
    margin-bottom: 14px;
  }
  .commit-field { margin-bottom: 14px; }
  .commit-field label {
    display: block;
    font-size: 13px;
    font-weight: 600;
    color: var(--gray-800);
    margin-bottom: 6px;
  }
  .commit-field textarea {
    width: 100%;
    min-height: 80px;
    padding: 10px 12px;
    border: 1.5px solid var(--gray-200);
    border-radius: 10px;
    font: inherit;
    font-size: 14px;
    resize: vertical;
    outline: none;
    line-height: 1.6;
  }
  .commit-field textarea:focus { border-color: var(--green-mid); }
  .commit-field select {
    width: 100%;
    padding: 10px 12px;
    border: 1.5px solid var(--gray-200);
    border-radius: 10px;
    font: inherit;
    font-size: 14px;
    outline: none;
    background: white;
    cursor: pointer;
  }
  /* ── Complete state ── */
  .complete-box {
    text-align: center;
    padding: 40px 20px;
  }
  .checkmark {
    width: 72px;
    height: 72px;
    background: #D1FAE5;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 20px;
    font-size: 36px;
  }
  .complete-h1 {
    font-size: 24px;
    font-weight: 700;
    color: var(--green);
    margin-bottom: 8px;
  }
  .complete-sub {
    font-size: 14px;
    color: var(--gray-600);
    margin-bottom: 28px;
    line-height: 1.6;
  }
  .complete-btns {
    display: flex;
    flex-direction: column;
    gap: 10px;
    max-width: 320px;
    margin: 0 auto;
  }
  /* ── Nav bar ── */
  .lesson-nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20px;
  }
  .lesson-nav-back {
    font-size: 13px;
    color: var(--gray-400);
    cursor: pointer;
    background: none;
    border: none;
    padding: 4px 0;
    display: flex;
    align-items: center;
    gap: 4px;
    border-radius: 0;
  }
  .lesson-nav-back:hover { color: var(--green); }
  .lesson-pip-row {
    display: flex;
    gap: 5px;
  }
  .lesson-pip {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--gray-200);
  }
  .lesson-pip.done { background: var(--green); }
  .lesson-pip.current { background: var(--green-mid); }
`;

// ─── Root ─────────────────────────────────────────────────────────────────────

const root = document.getElementById("app")!;
root.innerHTML = `<style>${STYLES}</style><div class="shell" id="shell"></div>`;
const shell = document.getElementById("shell")!;

function render() {
  shell.innerHTML = "";
  const header = buildHeader();
  shell.appendChild(header);
  const card = document.createElement("div");
  card.className = "card";
  const body = document.createElement("div");
  body.className = "card-body";

  if (state.view === "login") renderLogin(body);
  else if (state.view === "dashboard") renderDashboard(body);
  else if (state.view === "lesson" && state.currentLessonId) {
    const lesson = LESSONS.find(l => l.id === state.currentLessonId)!;
    renderLesson(body, lesson);
  } else if (state.view === "lesson-complete" && state.currentLessonId) {
    const lesson = LESSONS.find(l => l.id === state.currentLessonId)!;
    renderComplete(body, lesson);
  }

  card.appendChild(body);
  shell.appendChild(card);
}

function buildHeader(): HTMLElement {
  const el = document.createElement("div");
  el.className = "header";

  const logo = document.createElement("span");
  logo.className = "header-logo";
  logo.textContent = "Probabilistic Thinking";

  const title = document.createElement("span");
  title.className = "header-title";

  const prog = document.createElement("span");
  prog.className = "header-progress";

  if (state.progress) {
    title.textContent = state.view === "lesson" || state.view === "lesson-complete"
      ? (LESSONS.find(l => l.id === state.currentLessonId)?.title ?? "")
      : "Your Progress";
    prog.textContent = `${state.progress.completedCount}/${state.progress.totalLessons}`;
  } else {
    title.textContent = "Course";
  }

  el.appendChild(logo);
  el.appendChild(title);
  if (state.progress) el.appendChild(prog);
  return el;
}

// ─── Login view ───────────────────────────────────────────────────────────────

function renderLogin(body: HTMLElement) {
  body.innerHTML = `
    <p class="login-eyebrow">ChatGPT-Native Course</p>
    <h1 class="login-h1">Think in probabilities,<br>not certainties.</h1>
    <p class="login-sub">Enter the access token from your enrollment email to load your progress and pick up where you left off.</p>
    <div class="field">
      <label for="token-input">Access Token</label>
      <input type="password" id="token-input" placeholder="Paste your token here" autocomplete="off" spellcheck="false" />
      <p class="error-msg" id="login-error">Token not found. Check your enrollment email.</p>
    </div>
    <button class="btn-primary" id="login-btn">Start Learning</button>
  `;

  const input = body.querySelector<HTMLInputElement>("#token-input")!;
  const btn = body.querySelector<HTMLButtonElement>("#login-btn")!;
  const err = body.querySelector<HTMLElement>("#login-error")!;

  // Restore saved token if available
  const saved = window.openai?.widgetState?.token;
  if (saved) input.value = saved;

  input.addEventListener("keydown", (e) => { if (e.key === "Enter") btn.click(); });

  btn.addEventListener("click", async () => {
    const token = input.value.trim();
    if (!token) return;
    btn.disabled = true;
    btn.textContent = "Loading…";
    err.style.display = "none";

    const result = await loadProgress(token);
    if (!result) {
      err.style.display = "block";
      btn.disabled = false;
      btn.textContent = "Start Learning";
      return;
    }

    state.token = token;
    state.progress = result;
    state.view = "dashboard";
    await window.openai?.setWidgetState?.({ token, view: "dashboard", lessonId: null });
    render();
  });
}

// ─── Dashboard view ───────────────────────────────────────────────────────────

function renderDashboard(body: HTMLElement) {
  if (!state.progress) return;
  const p = state.progress;

  const welcome = document.createElement("p");
  welcome.className = "dash-welcome";
  welcome.textContent = `Signed in as ${p.email}`;

  const h1 = document.createElement("h1");
  h1.className = "dash-h1";
  h1.textContent = p.completedCount === 0
    ? "Ready to start?"
    : `${p.completedCount} of ${p.totalLessons} lessons complete`;

  body.appendChild(welcome);
  body.appendChild(h1);

  for (const mod of p.modules) {
    const allDone = mod.lessons.every(l => l.completed);
    const anyDone = mod.lessons.some(l => l.completed);
    const statusText = !mod.unlocked ? "Locked" : allDone ? "Complete" : anyDone ? "In progress" : "Not started";

    const card = document.createElement("div");
    card.className = "module-card";

    const numClass = allDone ? "done" : mod.unlocked ? "active" : "locked";
    const statusClass = allDone ? "done" : "";

    card.innerHTML = `
      <div class="module-header">
        <div class="module-num ${numClass}">${allDone ? "✓" : mod.module}</div>
        <span class="module-name">Module ${mod.module}: ${mod.title}</span>
        <span class="module-status ${statusClass}">${statusText}</span>
      </div>
    `;

    if (mod.unlocked) {
      const list = document.createElement("div");
      list.className = "lesson-list";

      for (const lesson of mod.lessons) {
        const isCurrent = lesson.id === p.currentLesson;
        const def = LESSONS.find(l => l.id === lesson.id);
        const dotClass = lesson.completed ? "done" : isCurrent ? "current" : "upcoming";
        const labelClass = lesson.completed ? "done" : isCurrent ? "current" : "";

        const row = document.createElement("div");
        row.className = "lesson-row";
        row.innerHTML = `
          <div class="lesson-dot ${dotClass}">${lesson.completed ? "✓" : lesson.id}</div>
          <span class="lesson-label ${labelClass}">${def?.title ?? lesson.id}</span>
        `;

        if (!lesson.completed && def) {
          const btn = document.createElement("button");
          btn.className = "btn-secondary btn-sm";
          btn.textContent = isCurrent ? "Continue →" : "Start";
          btn.addEventListener("click", () => openLesson(lesson.id));
          row.appendChild(btn);
        }

        list.appendChild(row);
      }
      card.appendChild(list);
    } else {
      const notice = document.createElement("div");
      notice.className = "locked-notice";
      notice.textContent = `🔒 Complete Module ${mod.module - 1} to unlock`;
      card.appendChild(notice);
    }

    body.appendChild(card);
  }

  // Continue bar
  const currentLesson = LESSONS.find(l => l.id === p.currentLesson);
  if (currentLesson) {
    const bar = document.createElement("div");
    bar.className = "continue-bar";
    bar.innerHTML = `<span class="continue-label">Next up: <strong>${currentLesson.title}</strong></span>`;
    const btn = document.createElement("button");
    btn.className = "btn-primary";
    btn.style.width = "auto";
    btn.textContent = "Keep Learning →";
    btn.addEventListener("click", () => openLesson(p.currentLesson));
    bar.appendChild(btn);
    body.appendChild(bar);
  }
}

function openLesson(lessonId: string) {
  state.currentLessonId = lessonId;
  state.view = "lesson";
  state.puzzleComplete = false;
  render();
}

// ─── Lesson view ──────────────────────────────────────────────────────────────

function renderLesson(body: HTMLElement, lesson: Lesson) {
  // Nav
  const nav = document.createElement("div");
  nav.className = "lesson-nav";

  const back = document.createElement("button");
  back.className = "lesson-nav-back";
  back.innerHTML = "← Dashboard";
  back.addEventListener("click", () => { state.view = "dashboard"; render(); });
  nav.appendChild(back);

  if (state.progress) {
    const pipRow = document.createElement("div");
    pipRow.className = "lesson-pip-row";
    const mod = state.progress.modules.find(m => m.module === lesson.module);
    if (mod) {
      for (const l of mod.lessons) {
        const pip = document.createElement("div");
        pip.className = "lesson-pip" + (l.completed ? " done" : l.id === lesson.id ? " current" : "");
        pipRow.appendChild(pip);
      }
    }
    nav.appendChild(pipRow);
  }

  body.appendChild(nav);

  // Eyebrow + title
  const eyebrow = document.createElement("p");
  eyebrow.className = "lesson-eyebrow";
  eyebrow.textContent = `Module ${lesson.module} · Lesson ${lesson.id}`;
  body.appendChild(eyebrow);

  const h1 = document.createElement("h1");
  h1.className = "lesson-h1";
  h1.textContent = lesson.title;
  body.appendChild(h1);

  // Concept
  const concept = document.createElement("div");
  concept.className = "concept-box";
  concept.textContent = lesson.concept;
  body.appendChild(concept);

  // Puzzle
  const puzzleLabel = document.createElement("p");
  puzzleLabel.className = "puzzle-label";
  puzzleLabel.textContent = "Exercise";
  body.appendChild(puzzleLabel);

  const puzzleBox = document.createElement("div");
  puzzleBox.className = "puzzle-box";
  body.appendChild(puzzleBox);

  // Complete btn
  const completeBtn = document.createElement("button");
  completeBtn.className = "btn-primary";
  completeBtn.textContent = "Mark Complete & Discuss with ChatGPT →";
  completeBtn.disabled = true;
  body.appendChild(completeBtn);

  // Render puzzle
  if (lesson.puzzleType === "slider-certainty") renderSliderPuzzle(puzzleBox, completeBtn);
  else if (lesson.puzzleType === "phrase-match") renderPhraseMatch(puzzleBox, completeBtn);
  else if (lesson.puzzleType === "classify-bias") renderClassifyBias(puzzleBox, completeBtn);
  else if (lesson.puzzleType === "ev-calc") renderEVCalc(puzzleBox, completeBtn);
  else if (lesson.puzzleType === "commit") renderCommit(puzzleBox, completeBtn);

  completeBtn.addEventListener("click", async () => {
    if (completeBtn.disabled) return;
    completeBtn.disabled = true;
    completeBtn.textContent = "Saving…";
    await markComplete(lesson);
  });
}

// ─── Puzzle: Slider certainty (1.1) ──────────────────────────────────────────

const SCENARIOS_11 = [
  { text: `"I'm certain this product feature will delight users — we've done the research."`, label: "A product manager before launch" },
  { text: `"There's no way this negotiation falls through — we've built great rapport."`, label: "A sales lead before a big deal" },
  { text: `"I know exactly how long this will take — I've done projects like this before."`, label: "A developer estimating a task" },
];

function renderSliderPuzzle(box: HTMLElement, completeBtn: HTMLButtonElement) {
  box.innerHTML = `<p style="font-size:14px;margin-bottom:18px;color:var(--gray-600);">Each statement below expresses certainty. Drag the slider to show what probability you'd <em>actually</em> assign to each outcome being true.</p>`;

  const answered = new Set<number>();

  SCENARIOS_11.forEach((s, idx) => {
    const div = document.createElement("div");
    div.className = "scenario";
    div.innerHTML = `
      <p class="scenario-text">${s.text}</p>
      <p style="font-size:12px;color:var(--gray-400);margin-bottom:8px;">— ${s.label}</p>
      <div class="slider-row">
        <span class="slider-label">50%</span>
        <input type="range" id="slider-${idx}" min="50" max="100" value="95" step="1" />
        <span class="slider-val" id="val-${idx}">95%</span>
      </div>
    `;
    box.appendChild(div);

    const slider = div.querySelector<HTMLInputElement>(`#slider-${idx}`)!;
    const val = div.querySelector<HTMLElement>(`#val-${idx}`)!;

    slider.addEventListener("input", () => {
      val.textContent = slider.value + "%";
      answered.add(idx);
      if (answered.size === SCENARIOS_11.length) {
        const insight = document.getElementById("slider-insight");
        if (insight) {
          insight.style.display = "block";
          completeBtn.disabled = false;
        }
      }
    });
  });

  const insight = document.createElement("div");
  insight.id = "slider-insight";
  insight.style.cssText = "display:none;background:white;border:1.5px solid var(--green);border-radius:10px;padding:14px 16px;font-size:14px;line-height:1.6;margin-top:4px;";
  insight.innerHTML = `<strong style="color:var(--green);">Notice something?</strong><br>Even your "certain" beliefs probably landed between 70–95%, not at 100%. The gap between certainty and probability is where miscalibration lives. Naming that gap is the first step.`;
  box.appendChild(insight);
}

// ─── Puzzle: Phrase match (1.2) ───────────────────────────────────────────────

const PHRASES = [
  { word: "Almost certain", research: "93%", ranges: ["0–20%", "20–40%", "40–60%", "60–80%", "80–100%"], correct: "80–100%" },
  { word: "Probable", research: "71%", ranges: ["0–20%", "20–40%", "40–60%", "60–80%", "80–100%"], correct: "60–80%" },
  { word: "Good chance", research: "68%", ranges: ["0–20%", "20–40%", "40–60%", "60–80%", "80–100%"], correct: "60–80%" },
  { word: "Possible", research: "44%", ranges: ["0–20%", "20–40%", "40–60%", "60–80%", "80–100%"], correct: "40–60%" },
  { word: "Unlikely", research: "15%", ranges: ["0–20%", "20–40%", "40–60%", "60–80%", "80–100%"], correct: "0–20%" },
];

function renderPhraseMatch(box: HTMLElement, completeBtn: HTMLButtonElement) {
  box.innerHTML = `<p style="font-size:14px;margin-bottom:16px;color:var(--gray-600);">For each phrase, pick the probability range you think most people mean when they use it. Then see what research says.</p>`;

  const grid = document.createElement("div");
  grid.className = "phrase-grid";
  box.appendChild(grid);

  let answered = 0;

  PHRASES.forEach((phrase) => {
    const row = document.createElement("div");
    row.className = "phrase-row";

    const word = document.createElement("span");
    word.className = "phrase-word";
    word.textContent = `"${phrase.word}"`;

    const select = document.createElement("select");
    select.className = "phrase-select";
    select.innerHTML = `<option value="">Pick a range…</option>` +
      phrase.ranges.map(r => `<option value="${r}">${r}</option>`).join("");

    const reveal = document.createElement("span");
    reveal.className = "phrase-reveal";
    reveal.textContent = `~${phrase.research} avg`;

    select.addEventListener("change", () => {
      if (!reveal.classList.contains("visible")) {
        reveal.classList.add("visible");
        answered++;
        if (answered === PHRASES.length) completeBtn.disabled = false;
      }
    });

    row.appendChild(word);
    row.appendChild(select);
    row.appendChild(reveal);
    grid.appendChild(row);
  });

  const note = document.createElement("p");
  note.style.cssText = "font-size:13px;color:var(--gray-400);margin-top:14px;font-style:italic;";
  note.textContent = "Research values from Sherman Kent's probability word studies. Select all five to reveal what researchers found.";
  box.appendChild(note);
}

// ─── Puzzle: Classify bias (1.3) ──────────────────────────────────────────────

const CLASSIFY_SCENARIOS = [
  {
    text: `Alex said he was 90% confident his presentation would go well. He gave 10 presentations with that confidence — 9 went well, 1 bombed.`,
    answer: "well-calibrated",
    feedback: "When 90% confidence matches a 90% hit rate, that's good calibration.",
  },
  {
    text: `Sarah said she was 95% confident her startup would close a funding round. Out of 20 founders who said the same thing with the same confidence, only 8 closed.`,
    answer: "overconfident",
    feedback: "95% confidence with a ~40% base rate = overconfidence. The gap is the problem.",
  },
  {
    text: `Marcus says he's "50-50" on whether his code is correct before testing. In reality, his code passes tests 85% of the time.`,
    answer: "underconfident",
    feedback: "50% stated confidence with 85% accuracy = underconfidence. He knows more than he thinks.",
  },
  {
    text: `Priya predicted a 70% chance of rain before checking any forecast, and it rained 7 out of 10 times she made that prediction.`,
    answer: "well-calibrated",
    feedback: "70% confidence matching a 70% hit rate. That's what calibration looks like.",
  },
];

function renderClassifyBias(box: HTMLElement, completeBtn: HTMLButtonElement) {
  box.innerHTML = `<p style="font-size:14px;margin-bottom:16px;color:var(--gray-600);">Read each scenario and classify the person's predictions.</p>`;

  let answered = 0;

  CLASSIFY_SCENARIOS.forEach((s) => {
    const div = document.createElement("div");
    div.className = "scenario-classify";

    const text = document.createElement("p");
    text.className = "scenario-classify-text";
    text.textContent = s.text;

    const opts = document.createElement("div");
    opts.className = "classify-opts";

    const feedback = document.createElement("p");
    feedback.className = "classify-feedback";

    const labels: Record<string, string> = {
      "overconfident": "Overconfident",
      "underconfident": "Underconfident",
      "well-calibrated": "Well-calibrated",
    };

    let selected = false;
    for (const [key, label] of Object.entries(labels)) {
      const btn = document.createElement("button");
      btn.className = "classify-btn";
      btn.textContent = label;
      btn.dataset["value"] = key;

      btn.addEventListener("click", () => {
        if (selected) return;
        selected = true;
        answered++;

        const isCorrect = key === s.answer;
        btn.className = "classify-btn " + (isCorrect ? "correct" : "wrong");

        // Show correct if wrong
        if (!isCorrect) {
          const correctBtn = opts.querySelector<HTMLButtonElement>(`[data-value="${s.answer}"]`);
          if (correctBtn) correctBtn.className = "classify-btn correct";
        }

        feedback.textContent = s.feedback;

        // Disable all buttons in this group
        opts.querySelectorAll<HTMLButtonElement>(".classify-btn").forEach(b => { b.disabled = true; });

        if (answered === CLASSIFY_SCENARIOS.length) completeBtn.disabled = false;
      });

      opts.appendChild(btn);
    }

    div.appendChild(text);
    div.appendChild(opts);
    div.appendChild(feedback);
    box.appendChild(div);
  });
}

// ─── Puzzle: EV Calc (1.4) ────────────────────────────────────────────────────

function renderEVCalc(box: HTMLElement, completeBtn: HTMLButtonElement) {
  box.innerHTML = `
    <div class="ev-scenario">
      <strong>The decision:</strong> You're evaluating whether to launch a new product. If it succeeds, you net $500k. If it fails, you lose $100k in sunk costs. You estimate a 40% chance of success. Should you launch?
    </div>
    <p style="font-size:13px;color:var(--gray-600);margin-bottom:14px;">Adjust the inputs if you want to explore different scenarios, then calculate.</p>
    <div class="ev-inputs">
      <div class="ev-row">
        <span class="ev-label">Probability of success (%)</span>
        <input type="number" class="ev-input" id="ev-prob" value="40" min="0" max="100" />
      </div>
      <div class="ev-row">
        <span class="ev-label">Payoff if success ($)</span>
        <input type="number" class="ev-input" id="ev-win" value="500000" step="1000" />
      </div>
      <div class="ev-row">
        <span class="ev-label">Loss if failure ($)</span>
        <input type="number" class="ev-input" id="ev-lose" value="100000" step="1000" />
      </div>
    </div>
    <button class="btn-secondary" id="calc-btn" style="margin-bottom:16px;">Calculate EV</button>
    <div class="ev-result" id="ev-result">
      <div class="ev-result-num" id="ev-num">—</div>
      <div class="ev-result-label">Expected value of launching</div>
      <div class="ev-verdict" id="ev-verdict"></div>
    </div>
  `;

  const calcBtn = box.querySelector<HTMLButtonElement>("#calc-btn")!;
  const result = box.querySelector<HTMLElement>("#ev-result")!;
  const evNum = box.querySelector<HTMLElement>("#ev-num")!;
  const verdict = box.querySelector<HTMLElement>("#ev-verdict")!;

  calcBtn.addEventListener("click", () => {
    const p = parseFloat((box.querySelector<HTMLInputElement>("#ev-prob")!).value) / 100;
    const win = parseFloat((box.querySelector<HTMLInputElement>("#ev-win")!).value);
    const lose = parseFloat((box.querySelector<HTMLInputElement>("#ev-lose")!).value);

    const ev = p * win - (1 - p) * lose;
    evNum.textContent = (ev >= 0 ? "+" : "") + "$" + Math.round(ev).toLocaleString();
    evNum.style.color = ev >= 0 ? "var(--green)" : "#B91C1C";

    verdict.textContent = ev > 0
      ? `EV is positive — launching is the better bet. But consider your risk tolerance: can you absorb the loss if it fails?`
      : `EV is negative — the numbers don't favor launching at this probability. What would need to change to make it worth it?`;

    result.classList.add("visible");
    completeBtn.disabled = false;
  });
}

// ─── Puzzle: Commit (1.5) ─────────────────────────────────────────────────────

function renderCommit(box: HTMLElement, completeBtn: HTMLButtonElement) {
  box.innerHTML = `
    <p class="commit-prompt">The test of whether this landed is whether you'll use it. Name one real decision coming up where you'll apply probabilistic thinking.</p>
    <div class="commit-field">
      <label for="commit-decision">The decision I'll apply this to:</label>
      <textarea id="commit-decision" placeholder="e.g. 'Deciding whether to take on a new client next month…'"></textarea>
    </div>
    <div class="commit-field">
      <label for="commit-tool">The tool I'll use:</label>
      <select id="commit-tool">
        <option value="">Choose one…</option>
        <option value="probability">Express my confidence as a probability (not certainty)</option>
        <option value="ev">Calculate the expected value of each option</option>
        <option value="both">Both — probability + expected value</option>
        <option value="calibration">Check my calibration against past predictions</option>
      </select>
    </div>
  `;

  const textarea = box.querySelector<HTMLTextAreaElement>("#commit-decision")!;
  const select = box.querySelector<HTMLSelectElement>("#commit-tool")!;

  const check = () => {
    if (textarea.value.trim().length > 20 && select.value) {
      completeBtn.disabled = false;
    } else {
      completeBtn.disabled = true;
    }
  };

  textarea.addEventListener("input", check);
  select.addEventListener("change", check);
}

// ─── Complete view ────────────────────────────────────────────────────────────

function renderComplete(body: HTMLElement, lesson: Lesson) {
  const isLastInModule = lesson.id === "1.5";
  body.innerHTML = `
    <div class="complete-box">
      <div class="checkmark">✓</div>
      <h1 class="complete-h1">Lesson complete!</h1>
      <p class="complete-sub">${
        isLastInModule
          ? "You've finished Module 1: Mental Models for Uncertainty. Head back to ChatGPT to debrief and discuss what stuck."
          : "Your progress is saved. Head back to ChatGPT to discuss what you just learned — then come back for the next lesson."
      }</p>
      <div class="complete-btns">
        <button class="btn-primary" id="discuss-btn">Discuss with ChatGPT →</button>
        <button class="btn-secondary" id="back-dash-btn">Back to Dashboard</button>
      </div>
    </div>
  `;

  body.querySelector<HTMLButtonElement>("#back-dash-btn")!.addEventListener("click", async () => {
    const progress = await loadProgress(state.token);
    if (progress) state.progress = progress;
    state.view = "dashboard";
    render();
  });

  body.querySelector<HTMLButtonElement>("#discuss-btn")!.addEventListener("click", async () => {
    await sendHandoff(lesson);
  });
}

async function sendHandoff(lesson: Lesson) {
  const nextLesson = LESSONS.find(l => {
    const parts = lesson.id.split(".");
    const nextId = `${parts[0]}.${parseInt(parts[1]) + 1}`;
    return l.id === nextId;
  });

  const prompt = `
I just completed lesson ${lesson.id}: "${lesson.title}" in the Probabilistic Thinking course.

Here's the concept I studied:
${lesson.concept}

I completed the interactive exercise for this lesson.

${nextLesson ? `The next lesson is ${nextLesson.id}: "${nextLesson.title}".` : `This was the final lesson in Module 1.`}

Please act as my Socratic tutor for this concept. Ask me one question to check whether I genuinely understood the key idea — don't re-explain the concept, just probe my understanding. If I get it right, affirm specifically what I got right. If I miss the point, push back with a follow-up question rather than just explaining it again.
`.trim();

  await window.openai?.sendFollowUpMessage?.({ prompt, scrollToBottom: true });
}

// ─── API helpers ──────────────────────────────────────────────────────────────

async function loadProgress(token: string): Promise<ProgressData | null> {
  try {
    const res = await fetch(`${API}/progress`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return await res.json() as ProgressData;
  } catch {
    return null;
  }
}

async function markComplete(lesson: Lesson): Promise<void> {
  try {
    await fetch(`${API}/progress/complete`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${state.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ lessonId: lesson.id }),
    });
    const progress = await loadProgress(state.token);
    if (progress) state.progress = progress;
  } catch {
    // Continue to complete view even if API call fails
  }
  state.view = "lesson-complete";
  await window.openai?.setWidgetState?.({ token: state.token, view: "lesson-complete", lessonId: lesson.id });
  render();
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────

app.ontoolresult = async () => {
  const saved = window.openai?.widgetState;
  if (saved?.token) {
    const progress = await loadProgress(saved.token);
    if (progress) {
      state.token = saved.token;
      state.progress = progress;
      state.currentLessonId = saved.lessonId ?? null;
      state.view = (saved.view as View) ?? "dashboard";
      render();
      return;
    }
  }
  state.view = "login";
  render();
};

render();
app.connect();
