import { Router } from "express";

import { listRooms, exchangeRooms } from "../controllers/room.controller";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

router.get("/rooms", requireAuth, asyncHandler(listRooms));
router.post("/rooms/exchange", requireAuth, asyncHandler(exchangeRooms));

export default router;
