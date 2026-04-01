/*
  Warnings:

  - You are about to drop the column `amount` on the `MessConcession` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "MessConcession" DROP COLUMN "amount",
ALTER COLUMN "image_url" DROP NOT NULL;

-- AlterTable
ALTER TABLE "OutPass" ALTER COLUMN "image_url" DROP NOT NULL;
