import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/prisma";
import { signupSchema, type SignupInput } from "@/lib/validation/auth";

export class EmailAlreadyExistsError extends Error {
  constructor() {
    super("An account with this email already exists.");
    this.name = "EmailAlreadyExistsError";
  }
}

const BCRYPT_COST_FACTOR = 12;

export async function signupUser(input: SignupInput) {
  const data = signupSchema.parse(input);

  const existing = await prisma.user.findUnique({
    where: { email: data.email },
    select: { id: true },
  });
  if (existing) {
    throw new EmailAlreadyExistsError();
  }

  const passwordHash = await bcrypt.hash(data.password, BCRYPT_COST_FACTOR);

  const user = await prisma.user.create({
    data: {
      email: data.email,
      name: data.name,
      passwordHash,
    },
    select: { id: true, email: true, name: true },
  });

  return user;
}