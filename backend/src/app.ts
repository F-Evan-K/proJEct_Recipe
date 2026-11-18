import { APP_GUARD } from "@nestjs/core";
import { AuthGuard } from "./auth/auth.guard";
import { AuthService } from "./auth/auth.service";
import { AuthController } from "./auth/auth.controller";
import "reflect-metadata";
import { Module, ValidationPipe } from "@nestjs/common";
import type { INestApplication } from "@nestjs/common";
import { PrismaService } from "./prisma.service";
import { ApiErrors } from "./errors.filter";
import { CatalogController } from "./catalog/catalog.controller";
import { InventoryController } from "./inventory/inventory.controller";
import { PlannerController } from "./planner/planner.controller";
import { RecordsController } from "./records/records.controller";
import { HealthController } from "./health.controller";
import { ForecastController } from "./forecast/forecast.controller";
import { SalesImportController } from "./records/sales-import.controller";
@Module({
  controllers: [
    HealthController,
    AuthController,
    CatalogController,
    InventoryController,
    PlannerController,
    RecordsController,
    SalesImportController,
    ForecastController,
  ],
  providers: [
    PrismaService,
    AuthService,
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AppModule {}
export function configureApp(app: INestApplication) {
  app.setGlobalPrefix("api/v1");
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new ApiErrors());
  const origins = (
    process.env.FRONTEND_ORIGINS ??
    "http://localhost:5173,http://127.0.0.1:5173"
  )
    .split(",")
    .map((s) => s.trim());
  app.enableCors({
    origin: origins,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    credentials: true,
    allowedHeaders: ["Content-Type", "X-KitchenFlow-Request"],
  });
  app.enableShutdownHooks();
}
