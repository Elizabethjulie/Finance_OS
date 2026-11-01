import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import dotenv from "dotenv";

dotenv.config();

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const DEFAULT_CATEGORIES = [
  "Food",
  "Transport",
  "Rent",
  "Utilities",
  "Education",
  "Health",
  "Family",
  "Giving",
  "Entertainment",
  "Shopping",
  "Investment",
  "Savings",
  "Other",
];

async function clearDatabase() {
  console.log("🧹 Clearing all user data, transactions, accounts, budgets, and goals...");

  // Truncate tables with CASCADE
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE 
      "GoalContribution",
      "Goal",
      "BudgetCategory",
      "Budget",
      "Transaction",
      "Account",
      "IncomeSource",
      "User"
    CASCADE;
  `);

  // Remove any custom categories created by users
  await prisma.category.deleteMany({
    where: {
      userId: { not: null },
    },
  });

  console.log("🌱 Ensuring default categories are present...");
  for (const name of DEFAULT_CATEGORIES) {
    const existing = await prisma.category.findFirst({
      where: { userId: null, name },
    });
    if (!existing) {
      await prisma.category.create({
        data: { name, isDefault: true, userId: null },
      });
    }
  }

  // Count remaining records to verify
  const [users, accounts, transactions, categories, budgets, goals, contributions, incomeSources] =
    await Promise.all([
      prisma.user.count(),
      prisma.account.count(),
      prisma.transaction.count(),
      prisma.category.count(),
      prisma.budget.count(),
      prisma.goal.count(),
      prisma.goalContribution.count(),
      prisma.incomeSource.count(),
    ]);

  console.log("✨ Database successfully cleared and reset to fresh state!");
  console.log("Current record counts:", {
    users,
    accounts,
    transactions,
    categories, // 13 default global categories
    budgets,
    goals,
    contributions,
    incomeSources,
  });
}

clearDatabase()
  .catch((e) => {
    console.error("❌ Failed to clear database:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

