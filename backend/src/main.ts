import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule, configureApp } from "./app";
async function bootstrap() {
  if (!process.env.DATABASE_URL)
    throw Error(
      "DATABASE_URL missing. Copy backend/.env.example to backend/.env and configure MySQL.",
    );
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  const config = new DocumentBuilder()
    .setTitle("KitchenFlow API")
    .setDescription(
      "Single-outlet local development API. No authentication yet; do not expose publicly. Forecasting is not connected.",
    )
    .setVersion("0.1.0")
    .build();
  SwaggerModule.setup(
    "api/docs",
    app,
    SwaggerModule.createDocument(app, config),
  );
  const port = Number(process.env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw Error("Invalid PORT");
  await app.listen(port, "127.0.0.1");
  console.log("KitchenFlow API: http://127.0.0.1:" + port + "/api/docs");
}
bootstrap().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
