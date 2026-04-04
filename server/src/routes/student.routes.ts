import { Router } from "express";

import {
	bulkCreateStudents,
	bulkDeleteStudents,
	assignRooms,
	createStudent,
	deleteStudent,
	getStudentDetails,
	listStudents,
    moveStudentRoom,
    removeStudentRoom,
} from "../controllers/student.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { asyncHandler } from "../middleware/asyncHandler";

const router = Router();

router.get("/students", requireAuth, asyncHandler(listStudents));
router.get("/students/:id/details", requireAuth, asyncHandler(getStudentDetails));
router.post("/students", requireAuth, asyncHandler(createStudent));
router.post("/students/bulk", requireAuth, asyncHandler(bulkCreateStudents));
router.post("/students/assign-rooms", requireAuth, asyncHandler(assignRooms));
router.delete("/students/:id", requireAuth, asyncHandler(deleteStudent));
router.post("/students/bulk-delete", requireAuth, asyncHandler(bulkDeleteStudents));
router.post("/students/:id/move", requireAuth, asyncHandler(moveStudentRoom));
router.post("/students/:id/remove-room", requireAuth, asyncHandler(removeStudentRoom));

export default router;
