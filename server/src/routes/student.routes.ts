import { Router } from "express";

import {
	bulkCreateStudents,
	bulkDeleteStudents,
	createStudent,
	deleteStudent,
	listStudents,
} from "../controllers/student.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

router.get("/students", requireAuth, listStudents);
router.post("/students", requireAuth, createStudent);
router.post("/students/bulk", requireAuth, bulkCreateStudents);
router.delete("/students/:id", requireAuth, deleteStudent);
router.post("/students/bulk-delete", requireAuth, bulkDeleteStudents);

export default router;
