import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  Res,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";
import { AuthService, publicUser } from "./auth.service";
import { Public, AdminOnly } from "./auth.guard";
import { LoginDto, RegisterDto, UserAccessDto } from "./auth.dto";
import { PrismaService } from "../prisma.service";
@ApiTags("accounts")
@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly db: PrismaService,
  ) {}
  @Public() @Post("register") register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
  ) {
    return this.auth.register(dto, req.ip ?? "unknown");
  }
  @Public() @Post("login") login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.auth.login(dto, req.ip ?? "unknown", res, req);
  }
  @Public() @Post("logout") logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.auth.logout(req, res);
  }
  @Get("me") me(@Req() req: Request & { user?: unknown }) {
    return { user: req.user };
  }
  @AdminOnly() @Get("users") users() {
    return this.db.user.findMany({
      select: { id: true, name: true, email: true, role: true, active: true },
      orderBy: { id: "asc" },
    });
  }
  @AdminOnly() @Patch("users/:id/access") access(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UserAccessDto,
  ) {
    return this.db.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id } });
      if (!user) throw new NotFoundException("Account not found");
      if (user.role !== "STAFF")
        throw new ForbiddenException("Akun admin dikelola developer.");
      const updated = await tx.user.update({
        where: { id },
        data: { active: dto.active },
      });
      if (!dto.active) await tx.session.deleteMany({ where: { userId: id } });
      return publicUser(updated);
    });
  }
}
