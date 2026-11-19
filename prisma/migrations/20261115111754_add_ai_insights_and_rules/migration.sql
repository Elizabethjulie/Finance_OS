-- CreateEnum
CREATE TYPE "InsightType" AS ENUM ('SAVINGS_OPPORTUNITY', 'SPENDING_ALERT', 'GOAL_PROGRESS', 'CASH_FLOW_TREND');

-- CreateTable
CREATE TABLE "AIInsight" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'KES',
    "type" "InsightType" NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "actionableStep" TEXT,
    "reasoning" JSONB NOT NULL,
    "isDismissed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIInsight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CategoryCorrectionRule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CategoryCorrectionRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AIInsight_userId_year_month_currency_idx" ON "AIInsight"("userId", "year", "month", "currency");

-- CreateIndex
CREATE INDEX "CategoryCorrectionRule_userId_idx" ON "CategoryCorrectionRule"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CategoryCorrectionRule_userId_keyword_key" ON "CategoryCorrectionRule"("userId", "keyword");

-- AddForeignKey
ALTER TABLE "AIInsight" ADD CONSTRAINT "AIInsight_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryCorrectionRule" ADD CONSTRAINT "CategoryCorrectionRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryCorrectionRule" ADD CONSTRAINT "CategoryCorrectionRule_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;
