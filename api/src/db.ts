import { Pool } from "pg";

// ─── Connection ───────────────────────────────────────────────────────────────

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("localhost")
    ? false
    : { rejectUnauthorized: false },
});

export async function initDB(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      token           TEXT        PRIMARY KEY,
      email           TEXT        NOT NULL,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      current_lesson  TEXT        NOT NULL DEFAULT '1.1',
      completed_lessons JSONB     NOT NULL DEFAULT '[]'
    )
  `);
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LessonRecord {
  lessonId: string;
  completedAt: string;
  quizScore?: number;
}

export interface UserRecord {
  token: string;
  email: string;
  createdAt: string;
  currentLesson: string;
  completedLessons: LessonRecord[];
}

function rowToUser(row: Record<string, unknown>): UserRecord {
  return {
    token: row.token as string,
    email: row.email as string,
    createdAt: (row.created_at as Date).toISOString(),
    currentLesson: row.current_lesson as string,
    completedLessons: row.completed_lessons as LessonRecord[],
  };
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function createUser(token: string, email: string): Promise<UserRecord> {
  const res = await pool.query(
    `INSERT INTO users (token, email) VALUES ($1, $2)
     ON CONFLICT (token) DO UPDATE SET email = EXCLUDED.email
     RETURNING *`,
    [token, email]
  );
  return rowToUser(res.rows[0]);
}

export async function getUserByToken(token: string): Promise<UserRecord | null> {
  const res = await pool.query(`SELECT * FROM users WHERE token = $1`, [token]);
  return res.rows.length ? rowToUser(res.rows[0]) : null;
}

export async function markLessonComplete(
  token: string,
  lessonId: string,
  quizScore?: number
): Promise<UserRecord | null> {
  const user = await getUserByToken(token);
  if (!user) return null;

  const alreadyDone = user.completedLessons.some((l) => l.lessonId === lessonId);
  const newRecord: LessonRecord = {
    lessonId,
    completedAt: new Date().toISOString(),
    ...(quizScore !== undefined && { quizScore }),
  };

  const updatedLessons = alreadyDone
    ? user.completedLessons
    : [...user.completedLessons, newRecord];

  const next = getNextLesson(lessonId);
  const res = await pool.query(
    `UPDATE users
     SET completed_lessons = $1, current_lesson = $2
     WHERE token = $3
     RETURNING *`,
    [JSON.stringify(updatedLessons), next ?? user.currentLesson, token]
  );
  return rowToUser(res.rows[0]);
}

export async function jumpToLesson(token: string, lessonId: string): Promise<UserRecord | null> {
  const res = await pool.query(
    `UPDATE users SET current_lesson = $1 WHERE token = $2 RETURNING *`,
    [lessonId, token]
  );
  return res.rows.length ? rowToUser(res.rows[0]) : null;
}

export async function getAllUsers(): Promise<UserRecord[]> {
  const res = await pool.query(`SELECT * FROM users ORDER BY created_at DESC`);
  return res.rows.map(rowToUser);
}

// ─── Curriculum ───────────────────────────────────────────────────────────────

export const CURRICULUM = [
  { module: 1, title: "Mental Models for Uncertainty",        lessons: ["1.1","1.2","1.3","1.4","1.5"] },
  { module: 2, title: "Calibration and Overconfidence",       lessons: ["2.1","2.2","2.3","2.4","2.5","2.6"] },
  { module: 3, title: "Decision Trees and Expected Value",    lessons: ["3.1","3.2","3.3","3.4","3.5"] },
  { module: 4, title: "Bayesian Reasoning",                   lessons: ["4.1","4.2","4.3","4.4","4.5","4.6"] },
  { module: 5, title: "Reference Class Forecasting",          lessons: ["5.1","5.2","5.3","5.4"] },
  { module: 6, title: "Communicating Probabilistic Thinking", lessons: ["6.1","6.2","6.3","6.4","6.5"] },
];

export function getNextLesson(current: string): string | null {
  const allLessons = CURRICULUM.flatMap((m) => m.lessons);
  const idx = allLessons.indexOf(current);
  if (idx === -1 || idx === allLessons.length - 1) return null;
  return allLessons[idx + 1];
}

export async function isModuleUnlocked(token: string, moduleNumber: number): Promise<boolean> {
  if (moduleNumber === 1) return true;
  const user = await getUserByToken(token);
  if (!user) return false;
  const prevModule = CURRICULUM.find((m) => m.module === moduleNumber - 1);
  if (!prevModule) return false;
  const completed = user.completedLessons.map((l) => l.lessonId);
  return prevModule.lessons.every((l) => completed.includes(l));
}
