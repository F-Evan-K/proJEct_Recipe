import { BadRequestException, Body, ConflictException, Controller, Post } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { IsString, Matches, MaxLength } from "class-validator";
import { createHash } from "node:crypto";
import { PrismaService } from "../prisma.service";
import { jakartaBusinessDate } from "./sale-rules";
import { parseSalesCsv, type CsvIssue, type CsvSale } from "./sales-csv";

class PreviewDto {
  @IsString()
  @MaxLength(60000)
  csv: string;
}

class ImportDto extends PreviewDto {
  @IsString()
  @Matches(/^[a-f0-9]{64}$/)
  fingerprint: string;
}

@Controller("sales/import")
export class SalesImportController {
  constructor(private readonly db: PrismaService) {}

  @Post("preview")
  preview(@Body() dto: PreviewDto) {
    const parsed = parseSalesCsv(dto.csv, jakartaBusinessDate());
    return this.db.$transaction(tx => this.inspect(tx, parsed), {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
    });
  }

  @Post()
  importSales(@Body() dto: ImportDto) {
    const parsed = parseSalesCsv(dto.csv, jakartaBusinessDate());
    return this.db.$transaction(async tx => {
      const preview = await this.inspect(tx, parsed);
      if (!preview.fingerprint)
        throw new BadRequestException("Perbaiki baris yang bermasalah sebelum menyimpan.");
      if (preview.fingerprint !== dto.fingerprint)
        throw new ConflictException("File atau riwayat penjualan berubah. Periksa pratinjau terbaru sebelum menyimpan.");

      const additions = preview.rows.filter(row => row.action === "create");
      if (additions.length) {
        await tx.dailySale.createMany({ data: additions.map(row => ({
          menuId: row.menuId,
          businessDate: this.date(row.businessDate),
          quantity: row.quantity,
          closed: row.closed,
          stockout: row.stockout,
        })) });
      }
      for (const row of preview.rows) {
        if (row.action !== "update") continue;
        await tx.dailySale.update({
          where: { menuId_businessDate: { menuId: row.menuId, businessDate: this.date(row.businessDate) } },
          data: { quantity: row.quantity, closed: row.closed, stockout: row.stockout },
        });
      }
      return preview.counts;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30000 });
  }

  private date(day: string) {
    return new Date(day + "T00:00:00Z");
  }

  private async inspect(tx: Prisma.TransactionClient, parsed: { sales: CsvSale[]; issues: CsvIssue[] }) {
    const datesByMenu = new Map<number, Date[]>();
    for (const sale of parsed.sales) {
      const dates = datesByMenu.get(sale.menuId) ?? [];
      dates.push(this.date(sale.businessDate));
      datesByMenu.set(sale.menuId, dates);
    }
    const menus = await tx.menuItem.findMany({
      where: { id: { in: [...datesByMenu.keys()] } },
      select: { id: true, name: true },
    });
    const menuNames = new Map(menus.map(menu => [menu.id, menu.name]));
    const existing = menus.length ? await tx.dailySale.findMany({
      where: { OR: menus.map(menu => ({
        menuId: menu.id,
        businessDate: { in: datesByMenu.get(menu.id)! },
      })) },
      select: { menuId: true, businessDate: true, quantity: true, closed: true, stockout: true },
    }) : [];
    const saved = new Map(existing.map(sale => [
      `${sale.menuId}:${sale.businessDate.toISOString().slice(0, 10)}`,
      {
        quantity: sale.quantity,
        condition: sale.closed ? "tutup" : sale.stockout ? "stockout" : "normal",
        closed: sale.closed,
        stockout: sale.stockout,
      },
    ]));
    const counts = { create: 0, update: 0, unchanged: 0 };
    const issues = [...parsed.issues];
    const rows = [];
    for (const sale of parsed.sales) {
      const menuName = menuNames.get(sale.menuId);
      if (menuName === undefined) {
        issues.push({ line: sale.line, message: `Menu ID ${sale.menuId} tidak ditemukan.` });
        continue;
      }
      const previous = saved.get(`${sale.menuId}:${sale.businessDate}`) ?? null;
      let action: keyof typeof counts = "create";
      if (previous) {
        action = previous.quantity === sale.quantity && previous.closed === sale.closed && previous.stockout === sale.stockout
          ? "unchanged"
          : "update";
      }
      counts[action]++;
      rows.push({ ...sale, menuName, previous, action });
    }
    issues.sort((a, b) => a.line - b.line);
    const fingerprint = issues.length ? null : createHash("sha256").update(JSON.stringify(rows)).digest("hex");
    return { rows, issues, counts, fingerprint };
  }
}
