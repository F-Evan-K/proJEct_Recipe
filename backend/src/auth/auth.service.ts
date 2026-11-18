import {
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { createHash, randomBytes } from "node:crypto";
import type { Request, Response } from "express";
import type { User } from "@prisma/client";
import { PrismaService } from "../prisma.service";
import { hashPassword, verifyPassword } from "./password";
import { LoginDto, RegisterDto } from "./auth.dto";
export const cookieName = () =>
  process.env.NODE_ENV === "production"
    ? "__Host-kitchenflow.sid"
    : "kitchenflow.sid";
export function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
  };
}
export const publicUser = (u: User) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  active: u.active,
});
const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");
@Injectable()
export class AuthService {
  constructor(private readonly db: PrismaService) {}
  private readonly dummyHash = hashPassword(randomBytes(32).toString("hex"));
  private readonly attempts = new Map<
    string,
    { count: number; until: number }
  >();
  private limit(key: string, max: number, increment = false) {
    const now = Date.now();
    let item = this.attempts.get(key);
    if (!item || item.until < now) {
      item = { count: 0, until: now + 15 * 60 * 1000 };
      this.attempts.set(key, item);
    }
    if (item.count >= max)
      throw new HttpException(
        "Terlalu banyak percobaan. Coba lagi dalam 15 menit.",
        429,
      );
    if (increment) item.count++;
    if (this.attempts.size > 10000) {
      for (const [k, v] of this.attempts)
        if (v.until < now) this.attempts.delete(k);
      if (this.attempts.size > 10000)
        throw new HttpException("Silakan coba lagi nanti.", 429);
    }
  }
  async register(dto: RegisterDto, ip: string) {
    this.limit("register:" + ip, 10, true);
    try {
      const user = await this.db.user.create({
        data: {
          name: dto.name.trim(),
          email: dto.email,
          passwordHash: await hashPassword(dto.password),
          role: "STAFF",
          active: false,
        },
      });
      return {
        user: publicUser(user),
        message:
          "Pendaftaran berhasil. Tunggu persetujuan pemilik sebelum masuk.",
      };
    } catch (error) {
      if ((error as { code?: string }).code === "P2002")
        throw new ConflictException(
          "Email sudah terdaftar. Silakan masuk atau hubungi pemilik.",
        );
      throw error;
    }
  }
  async login(dto: LoginDto, ip: string, response: Response, request: Request) {
    this.limit("login-ip:" + ip, 60);
    this.limit("login-email:" + dto.email, 10);
    const user = await this.db.user.findUnique({ where: { email: dto.email } });
    const valid = await verifyPassword(
      dto.password,
      user?.passwordHash ?? (await this.dummyHash),
    );
    if (!user || !valid) {
      this.limit("login-ip:" + ip, 60, true);
      this.limit("login-email:" + dto.email, 10, true);
      throw new UnauthorizedException("Email atau password tidak sesuai.");
    }
    if (!user.active)
      throw new ForbiddenException(
        "Akun belum aktif. Hubungi pemilik untuk persetujuan.",
      );
    const token = randomBytes(32).toString("hex"),
      expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000);
    await this.db.session.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    const previous = this.token(request);
    if (previous)
      await this.db.session.deleteMany({
        where: { tokenHash: hashToken(previous) },
      });
    await this.db.session.create({
      data: { userId: user.id, tokenHash: hashToken(token), expiresAt },
    });
    response.cookie(cookieName(), token, {
      ...cookieOptions(),
      maxAge: 12 * 60 * 60 * 1000,
    });
    return { user: publicUser(user) };
  }
  token(req: Request) {
    const raw = req.headers.cookie ?? "";
    const value = raw
      .split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith(cookieName() + "="))
      ?.slice(cookieName().length + 1);
    return value && /^[a-f0-9]{64}$/.test(value) ? value : null;
  }
  async user(req: Request) {
    const token = this.token(req);
    if (!token) return null;
    const session = await this.db.session.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: true },
    });
    if (!session || session.expiresAt <= new Date() || !session.user.active)
      return null;
    return publicUser(session.user);
  }
  async logout(req: Request, res: Response) {
    const token = this.token(req);
    if (token)
      await this.db.session.deleteMany({
        where: { tokenHash: hashToken(token) },
      });
    res.clearCookie(cookieName(), cookieOptions());
    return { message: "Berhasil keluar." };
  }
}
