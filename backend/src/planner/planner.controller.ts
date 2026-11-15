import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
import { PrismaService } from "../prisma.service";
import { PlanDto, PlanPreviewDto } from "../dto";
import { calculatePlan } from "./calculate";
@ApiTags("planner")
@Controller("kitchen-plans")
export class PlannerController {
  constructor(private readonly db: PrismaService) {}
  private async calculate(tx: Prisma.TransactionClient, dto: PlanPreviewDto) {
    const menus = await tx.menuItem.findMany({
      where: { id: { in: dto.items.map((i) => i.menuId) } },
      include: { recipe: { include: { ingredient: true } } },
    });
    return calculatePlan(dto.items, menus);
  }
  @Post("preview") preview(@Body() dto: PlanPreviewDto) {
    return this.db.$transaction((tx) => this.calculate(tx, dto), {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
    });
  }
  @Get() list() {
    return this.db.kitchenPlan.findMany({ take: 100, orderBy: { id: "desc" } });
  }
  @Get(":id") async get(@Param("id", ParseIntPipe) id: number) {
    const plan = await this.db.kitchenPlan.findUnique({ where: { id } });
    if (!plan) throw new NotFoundException("Plan not found");
    return plan;
  }
  @Post() create(@Body() dto: PlanDto) {
    const requestHash = createHash("sha256")
      .update(
        JSON.stringify({
          businessDate: dto.businessDate,
          items: [...dto.items].sort((a, b) => a.menuId - b.menuId),
        }),
      )
      .digest("hex");
    return this.db.$transaction(
      async (tx) => {
        const existing = await tx.kitchenPlan.findUnique({
          where: { idempotencyKey: dto.idempotencyKey },
        });
        if (existing) {
          if (existing.requestHash !== requestHash)
            throw new ConflictException(
              "Idempotency key already used for a different plan",
            );
          return existing;
        }
        const snapshot = await this.calculate(tx, dto);
        return tx.kitchenPlan.create({
          data: {
            businessDate: new Date(dto.businessDate + "T00:00:00.000Z"),
            idempotencyKey: dto.idempotencyKey,
            requestHash,
            snapshot: snapshot as unknown as Prisma.InputJsonValue,
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
  @Post(":id/approve") approve(@Param("id", ParseIntPipe) id: number) {
    return this.db.$transaction(async (tx) => {
      const plan = await tx.kitchenPlan.findUnique({ where: { id } });
      if (!plan) throw new NotFoundException("Plan not found");
      if (plan.status === "APPROVED") return plan;
      return tx.kitchenPlan.update({
        where: { id },
        data: { status: "APPROVED", approvedAt: new Date() },
      });
    });
  }
}
