import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
@Catch()
export class ApiErrors implements ExceptionFilter {
  private logger = new Logger("API");
  catch(error: unknown, host: ArgumentsHost) {
    let status = 500,
      message: unknown = "Internal server error";
    if (error instanceof HttpException) {
      status = error.getStatus();
      message = error.getResponse();
    } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (["P2002", "P2003", "P2034"].includes(error.code)) {
        status = 409;
        message =
          "Conflict: duplicate data, referenced record, or concurrent update. Retry with the same idempotency key.";
      } else if (error.code === "P2025") {
        status = 404;
        message = "Record not found";
      } else if (["P1001", "P1002"].includes(error.code)) {
        status = 503;
        message = "Database unavailable";
      }
    } else if (error instanceof Prisma.PrismaClientInitializationError) {
      status = 503;
      message = "Database unavailable";
    }
    if (status === 500)
      this.logger.error(
        error instanceof Error ? error.message : "Unknown failure",
      );
    host
      .switchToHttp()
      .getResponse()
      .status(status)
      .json({ statusCode: status, error: message });
  }
}
