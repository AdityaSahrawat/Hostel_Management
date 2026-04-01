import { Router } from "express";

import { login } from "../controllers/auth.controller";
import { asyncHandler } from "../middleware/asyncHandler";

const router = Router();

router.post("/auth/login", asyncHandler(login));

export default router;
