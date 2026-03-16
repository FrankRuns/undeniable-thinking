import fs from "fs";
import path from "path";

const DB_PATH = path.join(__dirname, "../data/db.json");

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

interface DB {
  users: Record<string, UserRecord>;
}

function readDB(): DB {
  const raw = fs.readFileSync(DB_PATH, "utf-8");
  return JSON.parse(raw) as DB;
}

function writeDB(db: DB): void {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), "utf-8");
}

export function createUser(token: string, email: string): UserRecord {
  const db = readDB();
  const user: UserRecord = {
    token,
    email,
    createdAt: new Date().toISOString(),
    currentLesson: "1.1",
    completedLessons: [],
  };
  db.users[token] = user;
  writeDB(db);
  return user;
}

export function getUserByToken(token: string): UserRecord | null {
  const db = readDB();
  return db.users[token] ?? null;
}

export function markLessonComplete(
  token: string,
  lessonId: string,
  quizScore?: number
): UserRecord | null {
  const db = readDB();
  const user = db.users[token];
  if (!user) return null;

  const alreadyDone = user.completedLessons.some((l) => l.lessonId === lessonId);
  if (!alreadyDone) {
    user.completedLessons.push({
      lessonId,
      completedAt: new Date().toISOString(),
      quizScore,
    });
  }

  const next = getNextLesson(lessonId);
  if (next) user.currentLesson = next;

  db.users[token] = user;
  writeDB(db);
  return user;
}

export function jumpToLesson(token: string, lessonId: string): UserRecord | null {
  const db = readDB();
  const user = db.users[token];
  if (!user) return null;

  user.currentLesson = lessonId;
  db.users[token] = user;
  writeDB(db);
  return user;
}

export function getAllUsers(): UserRecord[] {
  const db = readDB();
  return Object.values(db.users);
}

// ─── Curriculum ───────────────────────────────────────────────────────────────

export const CURRICULUM = [
  { module: 1, title: "Mental Models for Uncertainty", lessons: ["1.1","1.2","1.3","1.4","1.5"] },
  { module: 2, title: "Calibration and Overconfidence",  lessons: ["2.1","2.2","2.3","2.4","2.5","2.6"] },
  { module: 3, title: "Decision Trees and Expected Value", lessons: ["3.1","3.2","3.3","3.4","3.5"] },
  { module: 4, title: "Bayesian Reasoning",               lessons: ["4.1","4.2","4.3","4.4","4.5","4.6"] },
  { module: 5, title: "Reference Class Forecasting",      lessons: ["5.1","5.2","5.3","5.4"] },
  { module: 6, title: "Communicating Probabilistic Thinking", lessons: ["6.1","6.2","6.3","6.4","6.5"] },
];

export function getNextLesson(current: string): string | null {
  const allLessons = CURRICULUM.flatMap((m) => m.lessons);
  const idx = allLessons.indexOf(current);
  if (idx === -1 || idx === allLessons.length - 1) return null;
  return allLessons[idx + 1];
}

export function isModuleUnlocked(token: string, moduleNumber: number): boolean {
  if (moduleNumber === 1) return true;
  const user = getUserByToken(token);
  if (!user) return false;
  const prevModule = CURRICULUM.find((m) => m.module === moduleNumber - 1);
  if (!prevModule) return false;
  const completed = user.completedLessons.map((l) => l.lessonId);
  return prevModule.lessons.every((l) => completed.includes(l));
}
