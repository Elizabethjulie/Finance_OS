import { auth } from "@/auth";

/**
 * Returns the authenticated user's id, taken only from the verified
 * session — never from any client-supplied field. Every service-layer
 * function that touches user data should get its userId from here, so
 * there is exactly one place in the codebase deciding "who is making
 * this request." This is what makes "every query checks ownership" an
 * enforceable rule rather than a hope.
 */
export async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("UNAUTHENTICATED");
  }
  return session.user.id;
}

export async function getCurrentUser() {
  const session = await auth();
  return session?.user ?? null;
}