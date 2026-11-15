import {
  Body,
  Controller,
  Get,
  Post,
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma.service";
import { SaleDto } from "../dto";
@ApiTags("records")
@Controller()
export class RecordsController {
  constructor(private readonly db: PrismaService) {}
  @Get("sales") sales() {
    return this.db.dailySale.findMany({
      take: 365,
      orderBy: { businessDate: "desc" },
      include: { menu: true },
    });
  }
  @Post("sales") async sale(@Body() dto: SaleDto) {
    if (dto.closed && dto.quantity !== 0)
      throw new BadRequestException("Closed day must have zero sales");
    if (!(await this.db.menuItem.findUnique({ where: { id: dto.menuId } })))
      throw new NotFoundException("Menu not found");
    const businessDate = new Date(dto.businessDate + "T00:00:00.000Z");
    const data = {
      quantity: dto.quantity,
      stockout: dto.stockout ?? false,
      closed: dto.closed ?? false,
    };
    return this.db.dailySale.upsert({
      where: { menuId_businessDate: { menuId: dto.menuId, businessDate } },
      create: { menuId: dto.menuId, businessDate, ...data },
      update: data,
    });
  }
  @Get("analytics/waste") async wasteSummary() {
    const records = await this.db.wasteRecord.findMany({
      include: { ingredient: true },
    });
    const totals = new Map<string, Prisma.Decimal>();
    for (const row of records)
      totals.set(
        row.ingredient.unit,
        (totals.get(row.ingredient.unit) ?? new Prisma.Decimal(0)).plus(
          row.quantity,
        ),
      );
    return {
      recordCount: records.length,
      totalsByUnit: Object.fromEntries(
        [...totals].map(([unit, value]) => [unit, value.toNumber()]),
      ),
      notice:
        "Different units are never added together. No waste-reduction claim is measured.",
    };
  }
  @Post("forecast-runs") forecast() {
    throw new ServiceUnavailableException(
      "Forecasting model and dataset are not connected yet. No fabricated predictions are returned.",
    );
  }
}
