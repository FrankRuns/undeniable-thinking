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
  puzzleType: "belief-poll" | "risk-cascade";
}

const LESSONS: Lesson[] = [
  {
    id: "1.1",
    module: 1,
    title: "The 30-Day Streak That Kills You",
    concept: `Your workplace has a "Days Since Last Incident" counter on the wall. It just hit 30. Everyone's proud — the trend is going the right direction. But there's a model of risk that says the longer the streak, the more dangerous things actually become. Not because the system is getting worse, but because the streak is. Complacency sets in. Maintenance gets deferred. Warning signs get normalized. The absence of bad events feels like evidence of safety — and that feeling is the hazard.`,
    puzzleType: "belief-poll",
  },
  {
    id: "1.2",
    module: 1,
    title: "Why Your Project Is Always Two Weeks Away",
    concept: `Every project manager has lived this: the finish line keeps moving. You knock out one blocker and two more appear. The team says "two more weeks" in week 4, week 8, and week 14. This isn't just bad planning — it's math. When a project has multiple steps and each step has a small chance of delay, the probabilities compound. A 10% daily chance of a problem sounds manageable. Over a 10-day sprint it means you have less than a 35% chance of finishing on time. The burndown chart shows you one line. It should show you a distribution.`,
    puzzleType: "risk-cascade",
  },
];

// Fast lookup map — avoids any Array.find() issues
const LESSON_MAP: Record<string, Lesson> = {};
for (const l of LESSONS) LESSON_MAP[l.id] = l;

// ─── App state ────────────────────────────────────────────────────────────────

const API = "https://undeniable-thinking.onrender.com";

const state = {
  token: "",
  view: "login" as View,
  progress: null as ProgressData | null,
  currentLessonId: null as string | null,
  puzzleComplete: false,
};

const app = new App({ name: "Affective Analytics", version: "0.1.0" });

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
  /* ── Belief Poll (1.1) ── */
  .belief-question {
    font-size: 15px;
    font-weight: 600;
    color: var(--gray-800);
    margin-bottom: 16px;
    line-height: 1.5;
  }
  .belief-opts {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-bottom: 4px;
  }
  .belief-opt {
    padding: 12px 16px;
    border: 1.5px solid var(--gray-200);
    border-radius: 10px;
    background: white;
    font-size: 14px;
    cursor: pointer;
    text-align: left;
    transition: all .15s;
    font-family: inherit;
  }
  .belief-opt:hover:not(:disabled) { border-color: var(--green-mid); background: #F0FDF4; }
  .belief-opt.selected { border-color: var(--green); background: #DCFCE7; font-weight: 600; }
  .belief-opt.wrong { border-color: #FCA5A5; background: #FEE2E2; }
  .belief-reveal { display: none; margin-top: 16px; }
  .belief-reveal.visible { display: block; }
  .gauge-wrap { margin: 0 auto 16px; max-width: 300px; text-align: center; }
  .gauge-label {
    font-size: 11px;
    color: var(--gray-500);
    margin-bottom: 6px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: .05em;
  }
  .gauge-bar-track {
    height: 20px;
    background: var(--gray-200);
    border-radius: 10px;
    overflow: hidden;
    margin-bottom: 4px;
  }
  .gauge-bar-fill {
    height: 100%;
    border-radius: 10px;
    background: linear-gradient(90deg, #86EFAC 0%, #FACC15 55%, #EF4444 100%);
    transition: width 1.4s ease;
    width: 0%;
  }
  .gauge-days {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    color: var(--gray-400);
  }
  .gauge-insight {
    font-size: 14px;
    line-height: 1.6;
    color: var(--gray-700);
    background: white;
    border: 1.5px solid var(--gray-200);
    border-radius: 10px;
    padding: 14px 16px;
  }
  .gauge-insight strong { color: var(--green-dark); }
  /* ── Risk Cascade (1.2) ── */
  .cascade-setup {
    font-size: 14px;
    line-height: 1.6;
    color: var(--gray-700);
    margin-bottom: 16px;
  }
  .cascade-display {
    text-align: center;
    margin-bottom: 20px;
    padding: 20px 16px;
    background: white;
    border: 1.5px solid var(--gray-200);
    border-radius: 12px;
  }
  .cascade-day-label {
    font-size: 12px;
    color: var(--gray-500);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: .05em;
    margin-bottom: 4px;
  }
  .cascade-prob {
    font-size: 52px;
    font-weight: 800;
    color: var(--green-dark);
    transition: color 0.5s;
    margin-bottom: 4px;
    line-height: 1;
  }
  .cascade-prob.warn { color: #D97706; }
  .cascade-prob.danger { color: #DC2626; }
  .cascade-sublabel { font-size: 12px; color: var(--gray-400); }
  .cascade-btn-row { display: flex; justify-content: center; margin-bottom: 16px; }
  .cascade-insight {
    display: none;
    font-size: 14px;
    line-height: 1.6;
    color: var(--gray-700);
    background: white;
    border: 1.5px solid var(--gray-200);
    border-radius: 10px;
    padding: 14px 16px;
  }
  .cascade-insight.visible { display: block; }
  .cascade-insight strong { color: var(--green-dark); }
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
    const lesson = LESSON_MAP[state.currentLessonId!];
    renderLesson(body, lesson);
  } else if (state.view === "lesson-complete" && state.currentLessonId) {
    const lesson = LESSON_MAP[state.currentLessonId!];
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
  logo.textContent = "Affective Analytics";

  const title = document.createElement("span");
  title.className = "header-title";

  const prog = document.createElement("span");
  prog.className = "header-progress";

  if (state.progress) {
    title.textContent = state.view === "lesson" || state.view === "lesson-complete"
      ? (LESSON_MAP[state.currentLessonId!]?.title ?? "")
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
    <h1 class="login-h1">Analytics that change<br>how you decide.</h1>
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

  // Restore saved token and auto-login if valid
  const saved = window.openai?.widgetState?.token ?? localStorage.getItem("aa_token");
  if (saved) {
    input.value = saved;
    // Auto-submit after a short delay so the UI renders first
    setTimeout(() => btn.click(), 100);
  }

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
    localStorage.setItem("aa_token", token);
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
        const def = LESSON_MAP[lesson.id];
        const dotClass = lesson.completed ? "done" : isCurrent ? "current" : "upcoming";
        const labelClass = lesson.completed ? "done" : isCurrent ? "current" : "";

        const row = document.createElement("div");
        row.className = "lesson-row";
        const comingSoon = !def && !lesson.completed;
        row.innerHTML = `
          <div class="lesson-dot ${comingSoon ? "upcoming" : dotClass}">${lesson.completed ? "✓" : lesson.id}</div>
          <span class="lesson-label ${comingSoon ? "" : labelClass}">${def?.title ?? lesson.id}</span>
          ${comingSoon ? `<span style="font-size:11px;color:#aaa;margin-left:auto;">Coming soon</span>` : ""}
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
  const currentLesson = LESSON_MAP[p.currentLesson];
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
  if (lesson.puzzleType === "belief-poll") renderBeliefPoll(puzzleBox, completeBtn);
  else if (lesson.puzzleType === "risk-cascade") renderRiskCascade(puzzleBox, completeBtn);

  completeBtn.addEventListener("click", async () => {
    if (completeBtn.disabled) return;
    completeBtn.disabled = true;
    completeBtn.textContent = "Saving…";
    await markComplete(lesson);
  });
}

// ─── Puzzle: Belief Poll (1.1) ────────────────────────────────────────────────

function renderBeliefPoll(box: HTMLElement, completeBtn: HTMLButtonElement) {
  box.innerHTML = `
    <p class="belief-question">A factory floor displays a "Days Since Last Incident" counter. It's been on a 30-day streak with no accidents. What happens to the probability of an incident tomorrow?</p>
    <div class="belief-opts">
      <button class="belief-opt" data-answer="down">📉 Risk goes down — the streak proves the safety culture is working</button>
      <button class="belief-opt" data-answer="same">➡️ Stays the same — yesterday's record doesn't change tomorrow's odds</button>
      <button class="belief-opt" data-answer="up">📈 Risk goes up — pressure builds, complacency creeps in</button>
    </div>
    <div class="belief-reveal" id="belief-reveal">
      <div class="gauge-wrap">
        <div class="gauge-label">Risk level over streak duration</div>
        <div class="gauge-bar-track"><div class="gauge-bar-fill" id="gauge-fill"></div></div>
        <div class="gauge-days"><span>Day 0</span><span>Day 15</span><span>Day 30+</span></div>
      </div>
      <div class="gauge-insight">
        <strong>The answer is "up" — and often dramatically so.</strong><br><br>
        Long streaks don't just create complacency. They create false confidence in a system that may have just been lucky. The 2023 Maui wildfire burned through a region with a strong recent safety record. The counter said "safe." The risk model said otherwise.<br><br>
        <em>Recency bias makes the recent past feel like a guarantee of the future. It isn't.</em>
      </div>
    </div>
  `;

  const opts = box.querySelectorAll<HTMLButtonElement>(".belief-opt");
  const reveal = box.querySelector<HTMLElement>("#belief-reveal")!;
  const gaugeFill = box.querySelector<HTMLElement>("#gauge-fill")!;

  opts.forEach(btn => {
    btn.addEventListener("click", () => {
      opts.forEach(b => b.disabled = true);
      const isCorrect = btn.dataset.answer === "up";
      btn.classList.add(isCorrect ? "selected" : "wrong");
      if (!isCorrect) {
        const correct = box.querySelector<HTMLButtonElement>('[data-answer="up"]');
        if (correct) correct.classList.add("selected");
      }
      reveal.classList.add("visible");
      setTimeout(() => { gaugeFill.style.width = "82%"; }, 100);
      completeBtn.disabled = false;
    });
  });
}

// ─── Puzzle: Risk Cascade (1.2) ───────────────────────────────────────────────

function renderRiskCascade(box: HTMLElement, completeBtn: HTMLButtonElement) {
  let day = 0;
  let prob = 1.0;

  box.innerHTML = `
    <p class="cascade-setup">Your project has <strong>10 tasks</strong>. Each one has a <strong>10% chance of slipping</strong> by at least a day. Click through each task to see what happens to your on-time odds.</p>
    <div class="cascade-display">
      <div class="cascade-day-label" id="cascade-day-label">Before we start</div>
      <div class="cascade-prob" id="cascade-prob">100%</div>
      <div class="cascade-sublabel">chance of finishing on time</div>
    </div>
    <div class="cascade-btn-row">
      <button class="btn-primary" id="cascade-next">Complete Task 1 →</button>
    </div>
    <div class="cascade-insight" id="cascade-insight">
      <strong>After 10 tasks: only 34.9% on-time.</strong><br><br>
      Each task looked fine in isolation — just a 10% slip risk. But ten of them chained together? You've lost two thirds of your buffer before a single delay happens on purpose.<br><br>
      This is why every project is "two weeks away." The schedule isn't lying. The model is. Burndown charts assume each task is safe and independent — they don't compound the risk.
    </div>
  `;

  const dayLabel = box.querySelector<HTMLElement>("#cascade-day-label")!;
  const probDisplay = box.querySelector<HTMLElement>("#cascade-prob")!;
  const nextBtn = box.querySelector<HTMLButtonElement>("#cascade-next")!;
  const insight = box.querySelector<HTMLElement>("#cascade-insight")!;

  nextBtn.addEventListener("click", () => {
    day++;
    prob *= 0.9;
    const pct = (prob * 100).toFixed(1);
    probDisplay.textContent = pct + "%";
    dayLabel.textContent = `After task ${day}`;

    probDisplay.className = "cascade-prob";
    if (prob < 0.5) probDisplay.classList.add("danger");
    else if (prob < 0.75) probDisplay.classList.add("warn");

    if (day < 10) {
      nextBtn.textContent = `Complete Task ${day + 1} →`;
    } else {
      nextBtn.disabled = true;
      nextBtn.textContent = "All tasks done";
      insight.classList.add("visible");
      completeBtn.disabled = false;
    }
  });
}

// ─── Complete view ────────────────────────────────────────────────────────────

function renderComplete(body: HTMLElement, lesson: Lesson) {
  const isLastInModule = lesson.id === "1.4" || lesson.id === "2.4" || lesson.id === "3.4";
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
  const prompt = `I just finished the "${lesson.title}" exercise in my Affective Analytics course. Ask me one sharp question to test whether I actually understood it. After I answer, tell me what I got right or what I missed — then ask: "Want to dig deeper into this, or relaunch the course for the next lesson?" If I say relaunch (or anything like next, continue, move on), call open_course. If I want to dig deeper, keep going — but always end that thread by asking the same question again.`.trim();

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
  const savedToken = window.openai?.widgetState?.token ?? localStorage.getItem("aa_token");
  if (savedToken) {
    const progress = await loadProgress(savedToken);
    if (progress) {
      state.token = savedToken;
      state.progress = progress;
      const ws = window.openai?.widgetState;
      state.currentLessonId = ws?.lessonId ?? null;
      state.view = (ws?.view as View) ?? "dashboard";
      render();
      return;
    }
  }
  state.view = "login";
  render();
};

render();
app.connect();
