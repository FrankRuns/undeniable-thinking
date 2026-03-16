import { Request, Response, NextFunction } from "express";
import { getUserByToken } from "./db";

export function bearerAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : null;

  if (!token) {
    res.status(401).json({ error: "Missing Bearer token" });
    return;
  }

  const user = getUserByToken(token);
  if (!user) {
    res.status(401).json({ error: "Invalid token" });
    return;
  }

  // Attach user to request for downstream handlers
  (req as Request & { userToken: string }).userToken = token;
  next();
}
