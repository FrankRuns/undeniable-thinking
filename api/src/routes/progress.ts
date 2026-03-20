import { Router, Request, Response } from "express";
import {
  getUserByToken,
  markLessonComplete,
  jumpToLesson,
  CURRICULUM,
  isModuleUnlocked,
} from "../db";
import { bearerAuth } from "../auth";

const router = Router();

// All progress routes require Bearer auth
router.use(bearerAuth);

function getToken(req: Request): string {
  return (req as Request & { userToken: string }).userToken;
}

// GET /progress — load full session state
router.get("/", async (req: Request, res: Response) => {
  const token = getToken(req);
  const user = await getUserByToken(token);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const completedIds = user.completedLessons.map((l) => l.lessonId);
  const modulesWithStatus = await Promise.all(
    CURRICULUM.map(async (m) => ({
      module: m.module,
      title: m.title,
      unlocked: await isModuleUnlocked(token, m.module),
      lessons: m.lessons.map((id) => ({
        id,
        completed: completedIds.includes(id),
      })),
    }))
  );

  res.json({
    email: user.email,
    currentLesson: user.currentLesson,
    completedCount: completedIds.length,
    totalLessons: 12,
    modules: modulesWithStatus,
  });
});

// POST /progress/complete — mark a lesson done
router.post("/complete", async (req: Request, res: Response) => {
  const token = getToken(req);
  const { lessonId, quizScore } = req.body as { lessonId?: string; quizScore?: number };

  if (!lessonId) {
    res.status(400).json({ error: "lessonId is required" });
    return;
  }

  const updated = await markLessonComplete(token, lessonId, quizScore);
  if (!updated) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json({
    success: true,
    lessonId,
    currentLesson: updated.currentLesson,
    completedCount: updated.completedLessons.length,
  });
});

// POST /progress/jump — jump to a specific lesson
router.post("/jump", async (req: Request, res: Response) => {
  const token = getToken(req);
  const { lessonId } = req.body as { lessonId?: string };

  if (!lessonId) {
    res.status(400).json({ error: "lessonId is required" });
    return;
  }

  const allLessons = CURRICULUM.flatMap((m) => m.lessons);
  if (!allLessons.includes(lessonId)) {
    res.status(400).json({ error: `Unknown lessonId: ${lessonId}` });
    return;
  }

  const updated = await jumpToLesson(token, lessonId);
  if (!updated) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json({ success: true, currentLesson: updated.currentLesson });
});

// GET /progress/curriculum — return the full lesson map
router.get("/curriculum", (_req: Request, res: Response) => {
  res.json({ curriculum: CURRICULUM });
});

export default router;
