-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "locale" TEXT NOT NULL DEFAULT 'en-IN',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "theme" TEXT NOT NULL DEFAULT 'system',
    "emailVerifiedAt" TIMESTAMPTZ(3),
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "profileVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "installationId" TEXT NOT NULL,
    "familyExpiresAt" TIMESTAMPTZ(3) NOT NULL,
    "revokedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshCredential" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "parentId" UUID,
    "consumedAt" TIMESTAMPTZ(3),
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountToken" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "purpose" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "consumedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "iconKey" TEXT NOT NULL,
    "colourToken" TEXT NOT NULL DEFAULT 'primary',
    "defaultKey" TEXT,
    "archivedAt" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "deletedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "type" TEXT NOT NULL,
    "categoryId" UUID NOT NULL,
    "description" TEXT,
    "merchantOrPayee" TEXT,
    "paymentMethod" TEXT NOT NULL,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL,
    "originalExpenseId" UUID,
    "source" TEXT NOT NULL DEFAULT 'MANUAL_APP',
    "version" INTEGER NOT NULL DEFAULT 1,
    "deletedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlyBudget" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "month" DATE NOT NULL,
    "limitMinor" BIGINT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "version" INTEGER NOT NULL DEFAULT 1,
    "deletedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "MonthlyBudget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CategoryBudget" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "monthlyBudgetId" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "limitMinor" BIGINT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "deletedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "CategoryBudget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavingsGoal" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "targetMinor" BIGINT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "targetDate" DATE,
    "iconKey" TEXT NOT NULL DEFAULT 'goal',
    "archivedAt" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "deletedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "SavingsGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoalContribution" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "goalId" UUID NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "contributedAt" TIMESTAMPTZ(3) NOT NULL,
    "note" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "deletedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "GoalContribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncState" (
    "userId" UUID NOT NULL,
    "lastSequence" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "SyncState_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "ChangeEvent" (
    "userId" UUID NOT NULL,
    "sequence" BIGINT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" UUID NOT NULL,
    "entityVersion" INTEGER NOT NULL,
    "operation" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "recordedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChangeEvent_pkey" PRIMARY KEY ("userId","sequence")
);

-- CreateTable
CREATE TABLE "MutationReceipt" (
    "userId" UUID NOT NULL,
    "operationId" UUID NOT NULL,
    "requestHash" TEXT NOT NULL,
    "entityId" UUID,
    "result" JSONB NOT NULL,
    "status" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MutationReceipt_pkey" PRIMARY KEY ("userId","operationId")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedUntil" TIMESTAMPTZ(3),
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertDelivery" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "month" TEXT NOT NULL,
    "categoryId" UUID,
    "threshold" INTEGER NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlertDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshCredential_tokenHash_key" ON "RefreshCredential"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshCredential_sessionId_idx" ON "RefreshCredential"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "AccountToken_tokenHash_key" ON "AccountToken"("tokenHash");

-- CreateIndex
CREATE INDEX "AccountToken_userId_purpose_idx" ON "AccountToken"("userId", "purpose");

-- CreateIndex
CREATE UNIQUE INDEX "Category_userId_id_key" ON "Category"("userId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Category_userId_kind_normalizedName_key" ON "Category"("userId", "kind", "normalizedName");

-- CreateIndex
CREATE UNIQUE INDEX "Category_userId_defaultKey_key" ON "Category"("userId", "defaultKey");

-- CreateIndex
CREATE INDEX "Transaction_userId_occurredAt_id_idx" ON "Transaction"("userId", "occurredAt", "id");

-- CreateIndex
CREATE INDEX "Transaction_userId_categoryId_occurredAt_id_idx" ON "Transaction"("userId", "categoryId", "occurredAt", "id");

-- CreateIndex
CREATE INDEX "Transaction_userId_type_occurredAt_id_idx" ON "Transaction"("userId", "type", "occurredAt", "id");

-- CreateIndex
CREATE INDEX "Transaction_userId_originalExpenseId_idx" ON "Transaction"("userId", "originalExpenseId");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_userId_id_key" ON "Transaction"("userId", "id");

-- CreateIndex
CREATE INDEX "MonthlyBudget_userId_month_idx" ON "MonthlyBudget"("userId", "month");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyBudget_userId_id_key" ON "MonthlyBudget"("userId", "id");

-- CreateIndex
CREATE INDEX "CategoryBudget_userId_monthlyBudgetId_idx" ON "CategoryBudget"("userId", "monthlyBudgetId");

-- CreateIndex
CREATE INDEX "CategoryBudget_userId_categoryId_idx" ON "CategoryBudget"("userId", "categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "CategoryBudget_userId_id_key" ON "CategoryBudget"("userId", "id");

-- CreateIndex
CREATE INDEX "SavingsGoal_userId_createdAt_id_idx" ON "SavingsGoal"("userId", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "SavingsGoal_userId_id_key" ON "SavingsGoal"("userId", "id");

-- CreateIndex
CREATE INDEX "GoalContribution_userId_goalId_contributedAt_id_idx" ON "GoalContribution"("userId", "goalId", "contributedAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "GoalContribution_userId_id_key" ON "GoalContribution"("userId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Job_dedupeKey_key" ON "Job"("dedupeKey");

-- CreateIndex
CREATE INDEX "Job_status_nextAttemptAt_idx" ON "Job"("status", "nextAttemptAt");

-- CreateIndex
CREATE UNIQUE INDEX "AlertDelivery_dedupeKey_key" ON "AlertDelivery"("dedupeKey");

-- CreateIndex
CREATE INDEX "AlertDelivery_userId_month_idx" ON "AlertDelivery"("userId", "month");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshCredential" ADD CONSTRAINT "RefreshCredential_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountToken" ADD CONSTRAINT "AccountToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userId_categoryId_fkey" FOREIGN KEY ("userId", "categoryId") REFERENCES "Category"("userId", "id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userId_originalExpenseId_fkey" FOREIGN KEY ("userId", "originalExpenseId") REFERENCES "Transaction"("userId", "id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "MonthlyBudget" ADD CONSTRAINT "MonthlyBudget_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryBudget" ADD CONSTRAINT "CategoryBudget_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryBudget" ADD CONSTRAINT "CategoryBudget_userId_monthlyBudgetId_fkey" FOREIGN KEY ("userId", "monthlyBudgetId") REFERENCES "MonthlyBudget"("userId", "id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "CategoryBudget" ADD CONSTRAINT "CategoryBudget_userId_categoryId_fkey" FOREIGN KEY ("userId", "categoryId") REFERENCES "Category"("userId", "id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "SavingsGoal" ADD CONSTRAINT "SavingsGoal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoalContribution" ADD CONSTRAINT "GoalContribution_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoalContribution" ADD CONSTRAINT "GoalContribution_userId_goalId_fkey" FOREIGN KEY ("userId", "goalId") REFERENCES "SavingsGoal"("userId", "id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "SyncState" ADD CONSTRAINT "SyncState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeEvent" ADD CONSTRAINT "ChangeEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MutationReceipt" ADD CONSTRAINT "MutationReceipt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertDelivery" ADD CONSTRAINT "AlertDelivery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Additional financial/ownership invariants not expressible in Prisma schema.
ALTER TABLE "Category" ADD CONSTRAINT "Category_version_positive" CHECK (version >= 1);
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_version_positive" CHECK (version >= 1);
ALTER TABLE "MonthlyBudget" ADD CONSTRAINT "MonthlyBudget_version_positive" CHECK (version >= 1);
ALTER TABLE "CategoryBudget" ADD CONSTRAINT "CategoryBudget_version_positive" CHECK (version >= 1);
ALTER TABLE "SavingsGoal" ADD CONSTRAINT "SavingsGoal_version_positive" CHECK (version >= 1);
ALTER TABLE "GoalContribution" ADD CONSTRAINT "GoalContribution_version_positive" CHECK (version >= 1);
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_money_range" CHECK ("amountMinor" > 0 AND "amountMinor" <= 999999999999);
ALTER TABLE "MonthlyBudget" ADD CONSTRAINT "MonthlyBudget_money_range" CHECK ("limitMinor" >= 0 AND "limitMinor" <= 999999999999);
ALTER TABLE "CategoryBudget" ADD CONSTRAINT "CategoryBudget_money_range" CHECK ("limitMinor" >= 0 AND "limitMinor" <= 999999999999);
ALTER TABLE "SavingsGoal" ADD CONSTRAINT "SavingsGoal_money_range" CHECK ("targetMinor" > 0 AND "targetMinor" <= 999999999999);
ALTER TABLE "GoalContribution" ADD CONSTRAINT "GoalContribution_money_range" CHECK ("amountMinor" > 0 AND "amountMinor" <= 999999999999);
ALTER TABLE "User" ADD CONSTRAINT "User_inr_only" CHECK (currency = 'INR');
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_inr_only" CHECK (currency = 'INR');
ALTER TABLE "MonthlyBudget" ADD CONSTRAINT "MonthlyBudget_inr_only" CHECK (currency = 'INR');
ALTER TABLE "SavingsGoal" ADD CONSTRAINT "SavingsGoal_inr_only" CHECK (currency = 'INR');
ALTER TABLE "User" ADD CONSTRAINT "User_valid_profile" CHECK ("profileVersion">=1 AND email=lower(btrim(email)) AND char_length(email)<=254 AND char_length("displayName") BETWEEN 1 AND 80 AND locale='en-IN' AND theme IN ('system','light','dark') AND status IN ('ACTIVE','DELETION_PENDING'));
ALTER TABLE "Category" ADD CONSTRAINT "Category_valid_fields" CHECK (kind IN ('EXPENSE','INCOME') AND char_length(name) BETWEEN 1 AND 60 AND char_length("normalizedName") BETWEEN 1 AND 120);
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_valid_fields" CHECK (type IN ('EXPENSE','INCOME','REFUND') AND "paymentMethod" IN ('UPI','CASH','DEBIT_CARD','CREDIT_CARD','NET_BANKING','OTHER') AND source IN ('MANUAL_APP','MANUAL_WIDGET') AND char_length(coalesce(description,''))<=500 AND char_length(coalesce("merchantOrPayee",''))<=120 AND isfinite("occurredAt"));
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_refund_shape" CHECK ((type='REFUND' AND "originalExpenseId" IS NOT NULL AND "originalExpenseId"<>id) OR (type IN ('EXPENSE','INCOME') AND "originalExpenseId" IS NULL));
ALTER TABLE "MonthlyBudget" ADD CONSTRAINT "MonthlyBudget_first_day" CHECK (extract(day from month)=1 AND isfinite(month));
ALTER TABLE "SavingsGoal" ADD CONSTRAINT "SavingsGoal_valid_name" CHECK (char_length(name) BETWEEN 1 AND 80);
ALTER TABLE "GoalContribution" ADD CONSTRAINT "Contribution_valid_fields" CHECK (char_length(coalesce(note,''))<=500 AND isfinite("contributedAt"));
ALTER TABLE "AccountToken" ADD CONSTRAINT "AccountToken_purpose" CHECK (purpose IN ('VERIFY_EMAIL','RESET_PASSWORD'));
ALTER TABLE "ChangeEvent" ADD CONSTRAINT "ChangeEvent_valid_sequence" CHECK (sequence>0 AND "entityVersion">=1 AND operation IN ('UPSERT','DELETE'));
ALTER TABLE "MutationReceipt" ADD CONSTRAINT "MutationReceipt_status" CHECK (status BETWEEN 200 AND 499);
ALTER TABLE "Job" ADD CONSTRAINT "Job_status" CHECK (status IN ('PENDING','RETRY','DELIVERED','FAILED','CANCELLED') AND attempts>=0);
CREATE UNIQUE INDEX "MonthlyBudget_live_month" ON "MonthlyBudget"("userId",month) WHERE "deletedAt" IS NULL;
CREATE UNIQUE INDEX "CategoryBudget_live_allocation" ON "CategoryBudget"("userId","monthlyBudgetId","categoryId") WHERE "deletedAt" IS NULL;
CREATE INDEX "Transaction_live_date" ON "Transaction"("userId","occurredAt" DESC,id DESC) WHERE "deletedAt" IS NULL;
