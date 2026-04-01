import { Router } from "express";

import {
  createMessConcession,
  deleteMessConcession,
  getMessConcession,
  listMessConcessions,
  updateMessConcession,
} from "../controllers/messConcession.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { asyncHandler } from "../middleware/asyncHandler";

const router = Router();

router.post("/messconcessions", requireAuth, asyncHandler(createMessConcession));
router.get("/messconcessions", requireAuth, asyncHandler(listMessConcessions));
router.get("/messconcessions/:id", requireAuth, asyncHandler(getMessConcession));
router.patch("/messconcessions/:id", requireAuth, asyncHandler(updateMessConcession));
router.delete("/messconcessions/:id", requireAuth, asyncHandler(deleteMessConcession));

export default router;
