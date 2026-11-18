import { BadRequestException, Body, Controller, Post, ServiceUnavailableException, HttpException } from "@nestjs/common";
import { IsDateString, Matches } from "class-validator";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma.service";

export class ForecastDto {
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  targetDate: string;
}

@Controller("forecast-runs")
export class ForecastController {
  private running = false;
  constructor(private readonly db: PrismaService) {}

  @Post()
  async run(@Body() dto: ForecastDto) {
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());
    const tomorrow = new Date(today + "T00:00:00Z");
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    if (dto.targetDate !== tomorrow.toISOString().slice(0, 10))
      throw new BadRequestException("Versi ini hanya mengestimasi besok (Asia/Jakarta), setelah pencatatan hari ini selesai.");
    if (this.running) throw new HttpException("Forecast sedang diproses. Coba lagi nanti.", 429);
    this.running = true;
    try {
      const start = new Date(dto.targetDate + "T00:00:00Z");
      start.setUTCDate(start.getUTCDate() - 84);
      const { menus, sales } = await this.db.$transaction(async tx => {
        const menus = await tx.menuItem.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { id: "asc" } });
        if (menus.length > 20) throw new BadRequestException("Versi ini mendukung maksimal 20 menu aktif.");
        const sales = await tx.dailySale.findMany({
          where: { menuId: { in: menus.map(m => m.id) }, businessDate: { gte: start, lt: new Date(dto.targetDate + "T00:00:00Z") } },
          orderBy: [{ menuId: "asc" }, { businessDate: "asc" }],
          select: { menuId: true, businessDate: true, quantity: true, closed: true, stockout: true },
        });
        return { menus, sales };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
      const payload = { targetDate: dto.targetDate, menus, sales: sales.map(s => ({ ...s, businessDate: s.businessDate.toISOString().slice(0, 10) })) };
      const key = process.env.ML_SERVICE_KEY;
      if (!key) throw new ServiceUnavailableException("Isi ML_SERVICE_KEY di backend/.env dan ml-service/.env, lalu nyalakan layanan ML.");
      let response: Response;
      try {
        response = await fetch((process.env.ML_SERVICE_URL ?? "http://127.0.0.1:8000") + "/forecast", {
          method: "POST", headers: { "Content-Type": "application/json", "X-ML-Key": key },
          body: JSON.stringify(payload), signal: AbortSignal.timeout(30000),
        });
      } catch {
        throw new ServiceUnavailableException("Layanan forecasting belum berjalan atau melewati batas waktu. Data penjualan tetap tersimpan.");
      }
      if (response.status === 429)
        throw new HttpException("Layanan Python sedang menghitung evaluasi atau forecast lain. Coba lagi sebentar.", 429);
      if (!response.ok) throw new ServiceUnavailableException("Layanan forecasting gagal memproses data. Periksa layanan ML dan kunci koneksinya.");
      return response.json();
    } finally {
      this.running = false;
    }
  }
}
