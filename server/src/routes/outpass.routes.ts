import { Router } from "express";

import {
  createOutPass,
  deleteOutPass,
  getOutPass,
  listOutPasses,
  updateOutPass,
} from "../controllers/outpass.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

router.post("/outpasses", requireAuth, createOutPass);
router.get("/outpasses", requireAuth, listOutPasses);
router.get("/outpasses/:id", requireAuth, getOutPass);
router.patch("/outpasses/:id", requireAuth, updateOutPass);
router.delete("/outpasses/:id", requireAuth, deleteOutPass);

export default router;
