import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/auth/password";
import { isEmail } from "class-validator";
const db = new PrismaClient();
async function main() {
  const name = process.env.BOOTSTRAP_ADMIN_NAME?.trim(),
    email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase(),
    password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  if (
    !name ||
    name.length > 100 ||
    !email ||
    !isEmail(email) ||
    email.length > 254 ||
    !password ||
    password.length < 12 ||
    password.length > 128
  )
    throw Error(
      "Isi BOOTSTRAP_ADMIN_NAME, BOOTSTRAP_ADMIN_EMAIL dan BOOTSTRAP_ADMIN_PASSWORD (12–128 karakter) di backend/.env.",
    );
  if (await db.user.findUnique({ where: { email } }))
    throw Error(
      "Email sudah terdaftar. Script tidak menimpa atau menaikkan role akun yang sudah ada.",
    );
  await db.user.create({
    data: {
      name,
      email,
      passwordHash: await hashPassword(password),
      role: "ADMIN",
      active: true,
    },
  });
  console.log(
    "Akun pemilik dibuat. Hapus BOOTSTRAP_ADMIN_PASSWORD dari .env sesudahnya.",
  );
}
main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
