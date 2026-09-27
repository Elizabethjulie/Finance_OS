import { signupUser } from "@/services/auth/signup";

signupUser({ name: "Test User", email: "test@example.com", password: "test1234" })
  .then((u) => {
    console.log("SUCCESS:", u);
    process.exit(0);
  })
  .catch((e) => {
    console.error("ERROR:", e);
    process.exit(1);
  });