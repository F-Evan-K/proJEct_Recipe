import { AdminOnly } from "../auth/auth.guard";
import {
  Body,
  Controller,
  Get,
  Post,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma.service";
import { MovementDto, WasteDto } from "../dto";
@ApiTags("inventory")
@Controller()
export class InventoryController {
  constructor(private readonly db: PrismaService) {}
  @Get("inventory") async inventory() {
    const items = await this.db.ingredient.findMany({ orderBy: { id: "asc" } });
    return items.map((i) => ({ ...i, needsRestock: i.quantity.lt(i.minimum) }));
  }
  @Get("stock-movements") movements() {
    return this.db.stockMovement.findMany({
      take: 200,
      orderBy: { id: "desc" },
      include: { ingredient: true },
    });
  }
  @AdminOnly() @Post("stock-movements") movement(@Body() dto: MovementDto) {
    if (dto.quantity === 0)
      throw new BadRequestException("Movement quantity cannot be zero");
    return this.db.$transaction(
      async (tx) => {
        const existing = await tx.stockMovement.findUnique({
          where: { idempotencyKey: dto.idempotencyKey },
        });
        if (existing) {
          if (
            existing.ingredientId !== dto.ingredientId ||
            !existing.quantity.eq(dto.quantity) ||
            existing.reason !== dto.reason.trim()
          )
            throw new ConflictException(
              "Idempotency key already used for a different movement",
            );
          return existing;
        }
        const ingredient = await tx.ingredient.findUnique({
          where: { id: dto.ingredientId },
        });
        if (!ingredient) throw new NotFoundException("Ingredient not found");
        const updated = await tx.ingredient.updateMany({
          where: {
            id: dto.ingredientId,
            ...(dto.quantity < 0
              ? { quantity: { gte: new Prisma.Decimal(dto.quantity).abs() } }
              : {}),
          },
          data: { quantity: { increment: dto.quantity } },
        });
        if (!updated.count) throw new ConflictException("Insufficient stock");
        return tx.stockMovement.create({
          data: { ...dto, reason: dto.reason.trim() },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
  @Get("waste-records") wastes() {
    return this.db.wasteRecord.findMany({
      take: 200,
      orderBy: { id: "desc" },
      include: { ingredient: true },
    });
  }
  @Post("waste-records") waste(@Body() dto: WasteDto) {
    return this.db.$transaction(
      async (tx) => {
        const existing = await tx.wasteRecord.findUnique({
          where: { idempotencyKey: dto.idempotencyKey },
        });
        if (existing) {
          if (
            existing.ingredientId !== dto.ingredientId ||
            !existing.quantity.eq(dto.quantity) ||
            existing.reason !== dto.reason.trim()
          )
            throw new ConflictException(
              "Idempotency key already used for different waste",
            );
          return existing;
        }
        if (
          !(await tx.ingredient.findUnique({ where: { id: dto.ingredientId } }))
        )
          throw new NotFoundException("Ingredient not found");
        const update = await tx.ingredient.updateMany({
          where: { id: dto.ingredientId, quantity: { gte: dto.quantity } },
          data: { quantity: { decrement: dto.quantity } },
        });
        if (!update.count)
          throw new ConflictException("Waste exceeds available stock");
        await tx.stockMovement.create({
          data: {
            ingredientId: dto.ingredientId,
            quantity: new Prisma.Decimal(dto.quantity).neg(),
            reason: "Waste: " + dto.reason.trim(),
            idempotencyKey: "waste:" + dto.idempotencyKey,
          },
        });
        return tx.wasteRecord.create({
          data: { ...dto, reason: dto.reason.trim() },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
}
