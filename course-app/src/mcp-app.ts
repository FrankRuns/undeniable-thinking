import { App } from "@modelcontextprotocol/ext-apps";

declare global {
  interface Window {
    Plotly: {
      newPlot: (el: HTMLElement, data: unknown[], layout: Record<string, unknown>, config?: Record<string, unknown>) => Promise<void>;
      react: (el: HTMLElement, data: unknown[], layout: Record<string, unknown>, config?: Record<string, unknown>) => Promise<void>;
    };
    openai?: {
      setWidgetState?: (state: unknown) => Promise<void>;
      sendFollowUpMessage?: (payload: { prompt: string; scrollToBottom?: boolean }) => Promise<void>;
      widgetState?: Partial<CourseState>;
    };
  }
}

type Distribution = "normal" | "uniform" | "exponential" | "bimodal";
type Phase = "hook" | "intake" | "lesson";

interface CourseState {
  phase: Phase;
  role: string;
  domain: string;
  challenge: string;
  lessonIndex: number;
  distribution: Distribution;
  n: number;
  mean: number;
  std: number;
  bins: number;
  seed: number;
}

interface LessonContent {
  title: string;
  hook: string;
  paragraphsBefore: string[];
  insight: string;
  interactiveInstruction: string;
  paragraphsAfter: string[];
  histogramParams: Pick<CourseState, "distribution" | "n" | "mean" | "std" | "bins" | "seed">;
}

const DEFAULTS: CourseState = {
  phase: "hook",
  role: "",
  domain: "",
  challenge: "",
  lessonIndex: 0,
  distribution: "normal",
  n: 300,
  mean: 0,
  std: 1,
  bins: 20,
  seed: 42,
};

// ─── CSS ───────────────────────────────────────────────────────────────────────

const CSS = `
  :root { font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #111827; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #f3f4f6; }
  .shell { max-width: 720px; margin: 0 auto; padding: 16px; }

  /* HOOK */
  .hook-screen {
    background: #0c0c0c;
    border-radius: 20px;
    padding: 56px 48px 64px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.18);
  }
  .hook-eyebrow {
    font-size: 11px; letter-spacing: 0.18em; color: #4b5563;
    margin-bottom: 28px; font-weight: 600; text-transform: uppercase;
  }
  .hook-headline {
    font-size: 40px; font-weight: 800; color: #fff;
    line-height: 1.1; margin-bottom: 20px; letter-spacing: -0.02em;
  }
  .hook-headline em { color: #d1fae5; font-style: normal; }
  .hook-sub {
    font-size: 17px; color: #9ca3af; line-height: 1.65;
    margin-bottom: 44px; max-width: 500px;
  }
  .hook-cta {
    background: #fff; color: #0c0c0c; border: none;
    border-radius: 12px; padding: 14px 28px; font-size: 16px;
    font-weight: 700; cursor: pointer; font-family: inherit;
    transition: opacity 0.15s;
  }
  .hook-cta:hover { opacity: 0.88; }

  /* INTAKE */
  .intake-screen {
    background: white; border-radius: 20px;
    padding: 40px 48px 48px;
    box-shadow: 0 10px 30px rgba(17,24,39,0.07);
  }
  .intake-eyebrow {
    font-size: 11px; letter-spacing: 0.18em; color: #6b7280;
    margin-bottom: 12px; font-weight: 600; text-transform: uppercase;
  }
  .intake-desc { font-size: 16px; color: #6b7280; line-height: 1.55; margin-bottom: 36px; }
  .intake-field { margin-bottom: 24px; }
  .intake-label { display: block; font-size: 14px; font-weight: 700; color: #374151; margin-bottom: 8px; }
  .intake-input {
    width: 100%; padding: 12px 16px; font-size: 15px; font-family: inherit;
    border: 1.5px solid #e5e7eb; border-radius: 12px; outline: none;
    color: #111827; transition: border-color 0.15s;
  }
  .intake-input:focus { border-color: #111827; }
  .intake-actions { display: flex; align-items: center; gap: 16px; margin-top: 12px; }
  .intake-cta {
    background: #111827; color: white; border: none; border-radius: 12px;
    padding: 13px 24px; font-size: 15px; font-weight: 700; cursor: pointer; font-family: inherit;
  }
  .intake-skip {
    background: none; border: none; color: #9ca3af; font-size: 14px;
    cursor: pointer; font-family: inherit; padding: 13px 0;
  }
  .intake-skip:hover { color: #6b7280; }

  /* LESSON */
  .lesson-screen {
    background: white; border-radius: 20px; overflow: hidden;
    box-shadow: 0 10px 30px rgba(17,24,39,0.07);
  }
  .lesson-header { padding: 20px 32px 16px; border-bottom: 1px solid #f3f4f6; }
  .lesson-progress-label {
    font-size: 11px; letter-spacing: 0.15em; color: #9ca3af;
    margin-bottom: 8px; font-weight: 600; text-transform: uppercase;
  }
  .lesson-progress-track { height: 3px; background: #f3f4f6; border-radius: 2px; }
  .lesson-progress-fill {
    height: 100%; background: #111827; border-radius: 2px; transition: width 0.5s ease;
  }
  .lesson-body { padding: 32px 32px 24px; }
  .lesson-hook {
    font-size: 22px; font-weight: 800; line-height: 1.3;
    color: #111827; margin-bottom: 20px; letter-spacing: -0.01em;
  }
  .lesson-body p { font-size: 16px; line-height: 1.75; color: #374151; margin-bottom: 16px; }
  .lesson-insight {
    border-left: 3px solid #111827; padding: 14px 20px;
    background: #f9fafb; border-radius: 0 12px 12px 0;
    font-size: 15px; font-weight: 600; color: #111827;
    margin: 24px 0; line-height: 1.55;
  }
  .lesson-interactive {
    background: #f9fafb; border: 1px solid #e5e7eb;
    border-radius: 16px; padding: 20px 24px; margin: 24px 0;
  }
  .lesson-interactive-label {
    font-size: 10px; letter-spacing: 0.2em; color: #9ca3af;
    font-weight: 700; margin-bottom: 6px; text-transform: uppercase;
  }
  .lesson-interactive-instruction {
    font-size: 14px; color: #6b7280; line-height: 1.6;
    margin-bottom: 16px; font-style: italic;
  }
  .control-row { margin-bottom: 14px; }
  .control-label {
    display: flex; justify-content: space-between;
    font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px;
  }
  .control-slider { width: 100%; accent-color: #111827; cursor: pointer; }
  .lesson-chart { width: 100%; min-height: 260px; }
  .lesson-footer {
    display: flex; justify-content: space-between; align-items: center;
    padding: 16px 32px 24px; border-top: 1px solid #f3f4f6;
  }
  .lesson-back-btn {
    background: none; border: 1.5px solid #e5e7eb; border-radius: 10px;
    padding: 10px 18px; font-size: 14px; font-weight: 600;
    color: #6b7280; cursor: pointer; font-family: inherit;
  }
  .lesson-back-btn:hover { border-color: #9ca3af; color: #374151; }
  .lesson-next-btn {
    background: #111827; color: white; border: none; border-radius: 12px;
    padding: 12px 24px; font-size: 15px; font-weight: 700;
    cursor: pointer; font-family: inherit;
  }
  .lesson-finish { background: #059669 !important; }

  @media (max-width: 600px) {
    .hook-screen { padding: 36px 28px 44px; }
    .hook-headline { font-size: 28px; }
    .intake-screen { padding: 28px 24px 36px; }
    .lesson-body { padding: 24px 20px 20px; }
    .lesson-footer { padding: 12px 20px 20px; }
  }
`;

// ─── APP SETUP ─────────────────────────────────────────────────────────────────

const app = new App({ name: "Probabilistic Thinking", version: "1.0.0" });

const appRoot = document.getElementById("app");
if (!appRoot) throw new Error("Missing app root");

const styleEl = document.createElement("style");
styleEl.textContent = CSS;
document.head.appendChild(styleEl);

let state: CourseState = { ...DEFAULTS };
let currentData: number[] = [];
let plotReady = false;

// ─── DATA GENERATION ──────────────────────────────────────────────────────────

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function normalSample(rng: () => number, mean: number, std: number): number {
  const u1 = Math.max(rng(), Number.EPSILON);
  const u2 = rng();
  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return mean + z0 * std;
}

function generateData(params: Pick<CourseState, "distribution" | "n" | "mean" | "std" | "seed">): number[] {
  const rng = mulberry32(Math.floor(params.seed));
  const { distribution, n, mean, std } = params;
  const data: number[] = [];
  for (let i = 0; i < n; i++) {
    switch (distribution) {
      case "uniform": {
        const width = std * Math.sqrt(12);
        data.push(mean - width / 2 + rng() * width);
        break;
      }
      case "exponential": {
        const rate = 1 / Math.max(std, 0.0001);
        data.push(mean + (-Math.log(1 - rng()) / rate));
        break;
      }
      case "bimodal": {
        const offset = std * 1.5;
        const center = rng() < 0.5 ? mean - offset : mean + offset;
        data.push(normalSample(rng, center, std * 0.7));
        break;
      }
      default:
        data.push(normalSample(rng, mean, std));
    }
  }
  return data;
}

// ─── LESSON CONTENT ───────────────────────────────────────────────────────────

function getLessonContent(index: number, s: CourseState): LessonContent {
  const role = s.role || "professional";
  const domain = s.domain || "your field";
  const challenge = s.challenge || "your key decision";

  const lessons: LessonContent[] = [

    // ── LESSON 1: THE UPGRADE ──────────────────────────────────────────────────
    {
      title: "The Upgrade",
      hook: "Most smart people are wrong about predictions at an embarrassing rate. Here's the specific reason.",
      paragraphsBefore: [
        `They're playing the wrong game. They ask: "what will happen?" Then they pick the most likely outcome and defend it. That's the certainty game. It feels confident. It's mostly luck dressed up as skill.`,
        `Probabilistic thinkers play a different game. They ask: "what's the full spread of what could happen?" They don't pick one outcome — they map the distribution. Then they make decisions that perform well across that whole map.`,
        `As a ${role} in ${domain}, you already have good intuitions about uncertainty. This gives you a precise language for those intuitions — one that's more honest, and more persuasive.`,
      ],
      insight: "Stop asking 'what will happen?' Start asking 'what's the distribution of outcomes?'",
      interactiveInstruction: "Drag the bins slider. Same data, different resolution. Notice how the story changes — 5 bins looks like one thing, 50 bins reveals another. This is your first intuition: uncertainty looks different at different scales.",
      paragraphsAfter: [
        `The person who says "we'll hit $2M next quarter" is playing the certainty game. The person who says "I think we land between $1.5M and $2.5M — realistic downside is $1.2M if X happens" is playing the distribution game. Completely different. Completely better.`,
      ],
      histogramParams: { distribution: "normal", n: 300, mean: 0, std: 1, bins: 20, seed: 42 },
    },

    // ── LESSON 2: YOUR PRIOR ──────────────────────────────────────────────────
    {
      title: "Your Prior",
      hook: "Before you predict anything about your specific case, you need to know what happens in general.",
      paragraphsBefore: [
        `That's called your prior. Your base rate. The starting point before you layer on everything you know about this particular situation.`,
        `Bayesian thinking, in plain English: start with what's generally true. Then update based on what you specifically know. The updating is allowed. But skipping the prior entirely? That's where overconfidence lives.`,
      ],
      insight: `Your specific knowledge should shift you from the base rate — not replace it.`,
      interactiveInstruction: `This is a base rate distribution. The width (spread) represents uncertainty — how much you know. Drag it left to simulate strong specific evidence. Drag it right for maximum uncertainty. Where are you right now on "${challenge}"?`,
      paragraphsAfter: [
        `The mistake most smart people make: they go straight to "this case is different." Sometimes it is. But you're more likely to be overconfident than underconfident. Every expert in every field is. Research is consistent on this.`,
        `For ${challenge}: before you consider everything you know about your specific situation — what usually happens in cases like this? Start there. Then adjust.`,
      ],
      histogramParams: { distribution: "normal", n: 500, mean: 0, std: 2, bins: 25, seed: 7 },
    },

    // ── LESSON 3: THE TAILS ────────────────────────────────────────────────────
    {
      title: "The Tails",
      hook: "When people say they're 90% confident about a range, they're right only about 50% of the time.",
      paragraphsBefore: [
        `This isn't stupidity. It's a universal human bias. We imagine the future as a narrow tunnel of likely outcomes. We ignore the wide wings of unlikely-but-possible.`,
        `Those wings are the tails. Everything that can genuinely transform or ruin your situation lives in the tails. And we systematically underestimate them.`,
      ],
      insight: "When you think you know the range, double it. You'll still be slightly overconfident.",
      interactiveInstruction: "Drag the sample size up. Watch how more data fills in the tails — outcomes you'd never expect start appearing. The curve never actually reaches zero. There are always more tails than you think.",
      paragraphsAfter: [
        `The practical fix: when estimating ranges, explicitly ask yourself two questions. What's a plausible bad outcome that isn't my worst nightmare? What's a plausible good outcome that isn't pure fantasy? Add both to your range. It'll feel too wide. Do it anyway.`,
        `For ${challenge}: your 90% confidence interval is probably about half as wide as it should be. What would the doubled version look like?`,
      ],
      histogramParams: { distribution: "normal", n: 100, mean: 0, std: 1.5, bins: 28, seed: 13 },
    },

    // ── LESSON 4: SAYING IT OUT LOUD ──────────────────────────────────────────
    {
      title: "Saying It Out Loud",
      hook: "Thinking probabilistically is easy. Saying it out loud is where most people stop.",
      paragraphsBefore: [
        `When someone asks "will this work?", every instinct says: give them a clear answer. Yes or no. Decisive. They're waiting.`,
        `But a clear answer is often a dishonest one. You don't know. Neither does anyone else. The language that actually works: "I'd give this about 70%. The main risk is X. If X doesn't happen, I'd move to 85%."`,
        `That's honest. It's confident. And it's more useful than a false yes.`,
      ],
      insight: "People trust you more when you're specific about your uncertainty — not less.",
      interactiveInstruction: "This bimodal distribution shows two clusters of outcomes — one good, one bad. Drag the center to shift the relative weight between them. Notice: it's never 100% one peak. Real decisions always have a distribution.",
      paragraphsAfter: [
        `When you're wrong — you didn't say it would happen. You said it was 70% likely. The 30% occurred. That's not failure. That's probability working exactly as described.`,
        `One last thing. You don't need to be precisely right about the number. 67% vs 72% is noise. What matters is the category: near-certain, likely, coin flip, unlikely, remote. Five buckets. Use them. You'll immediately be more useful than most people in any room you're in.`,
        `For ${challenge}: what's your honest probability right now? Say it out loud.`,
      ],
      histogramParams: { distribution: "bimodal", n: 400, mean: 0, std: 1, bins: 30, seed: 99 },
    },

  ];

  return lessons[index];
}

// ─── RENDER FUNCTIONS ─────────────────────────────────────────────────────────

function render() {
  plotReady = false;
  if (state.phase === "hook") renderHook();
  else if (state.phase === "intake") renderIntake();
  else renderLesson(state.lessonIndex);
  void persistState();
}

function renderHook() {
  appRoot!.innerHTML = `
    <div class="shell">
      <div class="hook-screen">
        <div class="hook-eyebrow">Probabilistic Thinking</div>
        <h1 class="hook-headline">Most smart people are<br><em>wrong about predictions.</em></h1>
        <p class="hook-sub">In 20 minutes, you'll think differently about every uncertain decision you face — and immediately sound like the smartest person in the room.</p>
        <button class="hook-cta" id="begin-btn">Show me how →</button>
      </div>
    </div>
  `;
  document.getElementById("begin-btn")!.addEventListener("click", () => {
    state.phase = "intake";
    render();
  });
}

function renderIntake() {
  appRoot!.innerHTML = `
    <div class="shell">
      <div class="intake-screen">
        <div class="intake-eyebrow">Personalize your course</div>
        <p class="intake-desc">Three quick questions. Every concept and example will be adapted to your actual situation.</p>
        <div class="intake-field">
          <label class="intake-label">What's your role?</label>
          <input id="role-input" class="intake-input" placeholder="e.g. product manager, founder, doctor..." value="${escHtml(state.role)}" />
        </div>
        <div class="intake-field">
          <label class="intake-label">What domain or field are you in?</label>
          <input id="domain-input" class="intake-input" placeholder="e.g. healthcare, tech startups, finance..." value="${escHtml(state.domain)}" />
        </div>
        <div class="intake-field">
          <label class="intake-label">What's a decision weighing on you right now?</label>
          <input id="challenge-input" class="intake-input" placeholder="e.g. whether to launch this feature..." value="${escHtml(state.challenge)}" />
        </div>
        <div class="intake-actions">
          <button class="intake-cta" id="start-btn">Build my lessons →</button>
          <button class="intake-skip" id="skip-btn">Skip personalization</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById("start-btn")!.addEventListener("click", async () => {
    state.role = (document.getElementById("role-input") as HTMLInputElement).value.trim();
    state.domain = (document.getElementById("domain-input") as HTMLInputElement).value.trim();
    state.challenge = (document.getElementById("challenge-input") as HTMLInputElement).value.trim();
    state.phase = "lesson";
    state.lessonIndex = 0;
    render();
    if (state.role || state.domain || state.challenge) {
      await sendPersonalizationMessage();
    }
  });

  document.getElementById("skip-btn")!.addEventListener("click", () => {
    state.phase = "lesson";
    state.lessonIndex = 0;
    render();
  });
}

function renderLesson(index: number) {
  const lesson = getLessonContent(index, state);
  const pct = Math.round(((index + 1) / 4) * 100);
  const isLast = index === 3;
  const isFirst = index === 0;

  // Apply lesson histogram params to state for the interactive
  Object.assign(state, lesson.histogramParams);

  appRoot!.innerHTML = `
    <div class="shell">
      <div class="lesson-screen">
        <div class="lesson-header">
          <div class="lesson-progress-label">Lesson ${index + 1} of 4 · ${lesson.title}</div>
          <div class="lesson-progress-track">
            <div class="lesson-progress-fill" style="width:${pct}%"></div>
          </div>
        </div>
        <div class="lesson-body">
          <h2 class="lesson-hook">${lesson.hook}</h2>
          ${lesson.paragraphsBefore.map(p => `<p>${p}</p>`).join("")}
          <div class="lesson-insight">${lesson.insight}</div>
          <div class="lesson-interactive">
            <div class="lesson-interactive-label">Try it</div>
            <p class="lesson-interactive-instruction">${lesson.interactiveInstruction}</p>
            ${renderInteractiveControls(index, state)}
            <div id="chart" class="lesson-chart"></div>
          </div>
          ${lesson.paragraphsAfter.map(p => `<p>${p}</p>`).join("")}
        </div>
        <div class="lesson-footer">
          <button class="lesson-back-btn" id="back-btn">${isFirst ? "← Setup" : "← Previous"}</button>
          <button class="lesson-next-btn ${isLast ? "lesson-finish" : ""}" id="next-btn">
            ${isLast ? "You're upgraded. →" : "Next lesson →"}
          </button>
        </div>
      </div>
    </div>
  `;

  bindLessonControls(index);

  document.getElementById("back-btn")!.addEventListener("click", () => {
    if (isFirst) {
      state.phase = "intake";
    } else {
      state.lessonIndex = index - 1;
    }
    render();
  });

  document.getElementById("next-btn")!.addEventListener("click", async () => {
    if (isLast) {
      await sendCompletionMessage();
      state.phase = "hook";
      render();
    } else {
      state.lessonIndex = index + 1;
      render();
      await sendLessonAdvanceMessage(index);
    }
  });

  currentData = generateData(state);
  void renderHistogram();
}

function renderInteractiveControls(lessonIndex: number, s: CourseState): string {
  switch (lessonIndex) {
    case 0:
      return `<div class="control-row">
        <label class="control-label"><span>Bins</span><span id="ctrl-val">${s.bins}</span></label>
        <input id="ctrl-slider" class="control-slider" type="range" min="2" max="80" step="1" value="${s.bins}" />
      </div>`;
    case 1:
      return `<div class="control-row">
        <label class="control-label"><span>Uncertainty (spread)</span><span id="ctrl-val">${s.std.toFixed(1)}</span></label>
        <input id="ctrl-slider" class="control-slider" type="range" min="0.2" max="4" step="0.1" value="${s.std}" />
      </div>`;
    case 2:
      return `<div class="control-row">
        <label class="control-label"><span>Evidence (sample size)</span><span id="ctrl-val">${s.n}</span></label>
        <input id="ctrl-slider" class="control-slider" type="range" min="20" max="2000" step="20" value="${s.n}" />
      </div>`;
    case 3:
      return `<div class="control-row">
        <label class="control-label"><span>Scenario weight</span><span id="ctrl-val">${s.mean.toFixed(1)}</span></label>
        <input id="ctrl-slider" class="control-slider" type="range" min="-2" max="2" step="0.1" value="${s.mean}" />
      </div>`;
    default:
      return "";
  }
}

function bindLessonControls(lessonIndex: number) {
  const slider = document.getElementById("ctrl-slider") as HTMLInputElement | null;
  const valEl = document.getElementById("ctrl-val");
  if (!slider || !valEl) return;

  slider.addEventListener("input", async () => {
    const v = parseFloat(slider.value);
    switch (lessonIndex) {
      case 0: state.bins = v; valEl.textContent = String(v); break;
      case 1: state.std = v; valEl.textContent = v.toFixed(1); break;
      case 2: state.n = v; valEl.textContent = String(v); break;
      case 3: state.mean = v; valEl.textContent = v.toFixed(1); break;
    }
    currentData = generateData(state);
    await renderHistogram();
  });
}

// ─── HISTOGRAM ────────────────────────────────────────────────────────────────

async function ensurePlotly(): Promise<void> {
  if (window.Plotly) return;
  await new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdn.plot.ly/plotly-2.35.2.min.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load Plotly"));
    document.head.appendChild(s);
  });
}

async function renderHistogram() {
  const chartEl = document.getElementById("chart");
  if (!chartEl) return;
  await ensurePlotly();

  const trace = {
    x: currentData,
    type: "histogram",
    nbinsx: state.bins,
    marker: { color: "#111827", opacity: 0.8 },
    hovertemplate: "Count: %{y}<extra></extra>",
  };

  const layout = {
    margin: { l: 40, r: 12, t: 12, b: 40 },
    xaxis: { title: "", gridcolor: "#f3f4f6", zeroline: false },
    yaxis: { title: "", gridcolor: "#f3f4f6" },
    paper_bgcolor: "#f9fafb",
    plot_bgcolor: "#f9fafb",
    bargap: 0.05,
  };

  const config = { responsive: true, displayModeBar: false };

  if (!plotReady) {
    await window.Plotly.newPlot(chartEl, [trace], layout, config);
    plotReady = true;
  } else {
    await window.Plotly.react(chartEl, [trace], layout, config);
  }
}

// ─── AI MESSAGES ──────────────────────────────────────────────────────────────

async function sendPersonalizationMessage() {
  const { role, domain, challenge } = state;
  await window.openai?.sendFollowUpMessage?.({
    prompt: `The learner just started the Probabilistic Thinking course and shared their context:
- Role: ${role || "not specified"}
- Domain: ${domain || "not specified"}
- Key challenge: ${challenge || "not specified"}

In 2-3 punchy sentences (Derek Sivers style — no fluff, no bullet points), say something specific and insightful about why probabilistic thinking matters for their exact situation. Make it feel personal. Then tell them to dig into Lesson 1.`.trim(),
    scrollToBottom: true,
  });
}

async function sendLessonAdvanceMessage(completedIndex: number) {
  const lessonTitles = ["The Upgrade", "Your Prior", "The Tails", "Saying It Out Loud"];
  await window.openai?.sendFollowUpMessage?.({
    prompt: `The learner (${state.role || "a professional"} in ${state.domain || "their field"}) just finished "${lessonTitles[completedIndex]}" and is moving to "${lessonTitles[completedIndex + 1]}".

One sentence — connect the concept they just learned to their specific challenge: "${state.challenge || "their key decision"}". Make it concrete. No preamble.`.trim(),
    scrollToBottom: true,
  });
}

async function sendCompletionMessage() {
  await window.openai?.sendFollowUpMessage?.({
    prompt: `The learner just completed all 4 lessons of the Probabilistic Thinking course.
Profile: ${state.role || "professional"} in ${state.domain || "their field"}, working on "${state.challenge || "a key decision"}".

Give them one concrete action they can take in the next 24 hours to apply probabilistic thinking to their specific challenge. Two sentences max. Make it specific to their situation, not generic advice.`.trim(),
    scrollToBottom: true,
  });
}

// ─── STATE PERSISTENCE ────────────────────────────────────────────────────────

async function persistState() {
  await window.openai?.setWidgetState?.(state);
}

function loadSavedState(toolContent?: Partial<CourseState>) {
  const saved = window.openai?.widgetState ?? {};
  const initial = toolContent ?? {};
  state = {
    phase: (saved.phase ?? initial.phase ?? DEFAULTS.phase) as Phase,
    role: saved.role ?? initial.role ?? DEFAULTS.role,
    domain: saved.domain ?? initial.domain ?? DEFAULTS.domain,
    challenge: saved.challenge ?? initial.challenge ?? DEFAULTS.challenge,
    lessonIndex: Number(saved.lessonIndex ?? initial.lessonIndex ?? DEFAULTS.lessonIndex),
    distribution: (saved.distribution ?? initial.distribution ?? DEFAULTS.distribution) as Distribution,
    n: Number(saved.n ?? initial.n ?? DEFAULTS.n),
    mean: Number(saved.mean ?? initial.mean ?? DEFAULTS.mean),
    std: Number(saved.std ?? initial.std ?? DEFAULTS.std),
    bins: Number(saved.bins ?? initial.bins ?? DEFAULTS.bins),
    seed: Number(saved.seed ?? initial.seed ?? DEFAULTS.seed),
  };
}

// ─── UTILITIES ────────────────────────────────────────────────────────────────

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ─── INITIALIZATION ───────────────────────────────────────────────────────────

app.ontoolresult = async (result) => {
  loadSavedState(result.structuredContent as Partial<CourseState> | undefined);
  render();
};

loadSavedState();
render();
app.connect();
