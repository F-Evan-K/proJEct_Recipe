import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuthService } from "./auth.service";
export const Public = () => SetMetadata("auth:public", true);
export const AdminOnly = () => SetMetadata("auth:admin", true);
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      if (req.headers["x-kitchenflow-request"] !== "1")
        throw new ForbiddenException("Missing request protection header.");
      const origins = (
        process.env.FRONTEND_ORIGINS ??
        "http://localhost:5173,http://127.0.0.1:5173"
      )
        .split(",")
        .map((s) => s.trim());
      if (req.headers.origin && !origins.includes(req.headers.origin))
        throw new ForbiddenException("Origin not allowed.");
    }
    if (
      this.reflector.getAllAndOverride("auth:public", [
        context.getHandler(),
        context.getClass(),
      ])
    )
      return true;
    const user = await this.auth.user(req);
    if (!user)
      throw new UnauthorizedException("Silakan masuk terlebih dahulu.");
    req.user = user;
    if (
      this.reflector.getAllAndOverride("auth:admin", [
        context.getHandler(),
        context.getClass(),
      ]) &&
      user.role !== "ADMIN"
    )
      throw new ForbiddenException(
        "Hanya pemilik/admin yang dapat melakukan tindakan ini.",
      );
    return true;
  }
}
