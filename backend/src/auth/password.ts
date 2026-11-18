import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
function derive(password: string, salt: string) {
  return new Promise<Buffer>((resolve, reject) =>
    scrypt(
      password,
      salt,
      64,
      { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 },
      (error, key) => (error ? reject(error) : resolve(key)),
    ),
  );
}
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const key = await derive(password, salt);
  return "scrypt32768r8p3$" + salt + "$" + key.toString("hex");
}
export async function verifyPassword(password: string, hash: string) {
  const [version, salt, key] = hash.split("$");
  if (
    version !== "scrypt32768r8p3" ||
    !salt ||
    !key ||
    !/^[a-f0-9]{128}$/.test(key)
  )
    return false;
  const candidate = await derive(password, salt);
  return timingSafeEqual(Buffer.from(key, "hex"), candidate);
}
