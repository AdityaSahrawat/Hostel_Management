-- DropForeignKey
ALTER TABLE "Student" DROP CONSTRAINT "Student_room_no_fkey";

-- AlterTable
ALTER TABLE "Student" ALTER COLUMN "room_no" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_room_no_fkey" FOREIGN KEY ("room_no") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;
