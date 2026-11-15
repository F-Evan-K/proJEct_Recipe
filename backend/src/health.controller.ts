import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { PrismaService } from "./prisma.service";
@ApiTags("health")
@Controller("health")
export class HealthController {
  constructor(private readonly db: PrismaService) {}
  @Get() live() {
    return {
      status: "ok",
      service: "kitchenflow-api",
      mode: "local-development",
      mlConnected: false,
    };
  }
  @Get("ready") async ready() {
    try {
      await this.db.$queryRaw`SELECT 1`;
      return { status: "ready", database: "connected" };
    } catch {
      throw new ServiceUnavailableException("Database unavailable");
    }
  }
}
