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
@Module({
  controllers: [
    HealthController,
    CatalogController,
    InventoryController,
    PlannerController,
    RecordsController,
  ],
  providers: [PrismaService],
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
    credentials: false,
  });
  app.enableShutdownHooks();
}
