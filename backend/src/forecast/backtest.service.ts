import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { createHash, randomUUID } from "node:crypto";
import { PrismaService } from "../prisma.service";
import { jakartaBusinessDate } from "../records/sale-rules";

const protocol = "walk-forward-v1";
const modelVersion = "daily-sales-v1";
const maxAttempts = 3;
const dayMs = 86_400_000;
const runFields = {
  id: true, protocol: true, sourceHash: true, startDate: true, endDate: true,
  menuCount: true, status: true, attempts: true, error: true, createdAt: true, completedAt: true,
} satisfies Prisma.ForecastBacktestSelect;

type Period = { startDate: string; endDate: string; menuIds: number[] };

class BacktestFailure extends Error {
  constructor(message: string, readonly retryable = false) {
    super(message);
  }
}

@Injectable()
export class BacktestService implements OnModuleDestroy {
  private readonly logger = new Logger(BacktestService.name);
  private readonly shutdown = new AbortController();
  private timer?: NodeJS.Timeout;
  private processing = false;

  constructor(private readonly db: PrismaService) {}

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => void this.processNext(), 2000);
    this.timer.unref();
  }

  onModuleDestroy() {
    clearInterval(this.timer);
    this.shutdown.abort();
  }

  async create(period: Period, startedById: number) {
    const first = new Date(period.startDate + "T00:00:00Z");
    const last = new Date(period.endDate + "T00:00:00Z");
    const days = (last.getTime() - first.getTime()) / dayMs + 1;
    if (period.startDate < "1001-01-01" || days < 7 || days > 42)
      throw new BadRequestException("Pilih periode 7 hingga 42 hari.");
    if (period.endDate >= jakartaBusinessDate())
      throw new BadRequestException("Tanggal akhir maksimal kemarin (WIB).");

    const snapshot = await this.db.$transaction(async (tx) => {
      const menus = await tx.menuItem.findMany({
        where: { id: { in: period.menuIds } },
        orderBy: { id: "asc" },
        select: { id: true, name: true },
      });
      if (menus.length !== period.menuIds.length)
        throw new BadRequestException("Ada menu yang tidak ditemukan.");
      const sales = await tx.dailySale.findMany({
        where: {
          menuId: { in: period.menuIds },
          businessDate: { gte: new Date(first.getTime() - 84 * dayMs), lte: last },
        },
        orderBy: [{ menuId: "asc" }, { businessDate: "asc" }],
        select: { menuId: true, businessDate: true, quantity: true, closed: true, stockout: true },
      });
      return {
        startDate: period.startDate,
        endDate: period.endDate,
        menus,
        sales: sales.map(sale => ({ ...sale, businessDate: sale.businessDate.toISOString().slice(0, 10) })),
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });

    const sourceHash = createHash("sha256").update(JSON.stringify({ protocol, modelVersion, snapshot })).digest("hex");
    const existing = await this.db.forecastBacktest.findUnique({ where: { sourceHash }, select: runFields });
    if (existing) return existing;
    try {
      return await this.db.forecastBacktest.create({
        data: { sourceHash, protocol, startDate: first, endDate: last, menuCount: snapshot.menus.length, startedById, snapshot },
        select: runFields,
      });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
      // Another request may have registered exactly the same snapshot.
      return this.db.forecastBacktest.findUniqueOrThrow({ where: { sourceHash }, select: runFields });
    }
  }

  async list(before?: number) {
    const runs = await this.db.forecastBacktest.findMany({
      where: before === undefined ? {} : { id: { lt: before } },
      orderBy: { id: "desc" },
      take: 21,
      select: runFields,
    });
    const items = runs.slice(0, 20);
    return { items, next: runs.length > 20 ? items.at(-1)!.id : null };
  }

  async get(id: number) {
    const run = await this.db.forecastBacktest.findUnique({
      where: { id },
      select: { ...runFields, result: true },
    });
    if (!run) throw new NotFoundException("Riwayat evaluasi tidak ditemukan.");
    return run;
  }

  async retry(id: number) {
    await this.db.forecastBacktest.updateMany({
      where: { id, status: "FAILED" },
      data: { status: "QUEUED", attempts: 0, availableAt: new Date(), error: null, completedAt: null },
    });
    return this.get(id);
  }

  private async processNext() {
    if (this.processing || this.shutdown.signal.aborted) return;
    this.processing = true;
    try {
      const now = new Date();
      const store = this.db.forecastBacktest;
      await store.updateMany({
        where: { status: "RUNNING", leaseUntil: { lte: now }, attempts: { gte: maxAttempts } },
        data: {
          status: "FAILED", completedAt: now, leaseUntil: null, leaseToken: null,
          error: "Pemrosesan terputus. Jalankan ulang dari riwayat evaluasi.",
        },
      });
      const eligible: Prisma.ForecastBacktestWhereInput = {
        attempts: { lt: maxAttempts },
        OR: [
          { status: "QUEUED", availableAt: { lte: now } },
          { status: "RUNNING", leaseUntil: { lte: now } },
        ],
      };
      const job = await store.findFirst({
        where: eligible,
        orderBy: { id: "asc" },
        select: { id: true, attempts: true, snapshot: true },
      });
      if (!job || this.shutdown.signal.aborted) return;
      const leaseToken = randomUUID();
      const claim = await store.updateMany({
        where: { id: job.id, ...eligible },
        data: { status: "RUNNING", attempts: { increment: 1 }, leaseToken, leaseUntil: new Date(now.getTime() + 120_000), error: null },
      });
      if (!claim.count) return;
      const owner = { id: job.id, leaseToken };

      try {
        const result = await this.callPython(job.snapshot);
        await store.updateMany({
          where: owner,
          data: { status: "COMPLETED", result, completedAt: new Date(), leaseUntil: null, leaseToken: null },
        });
      } catch (error) {
        // On shutdown, the persisted lease lets a later worker recover this job.
        if (this.shutdown.signal.aborted) return;
        const failure = error instanceof BacktestFailure
          ? error
          : new BacktestFailure("Evaluasi belum bisa disimpan. Silakan coba lagi.", true);
        const attempts = job.attempts + 1;
        const retry = failure.retryable && attempts < maxAttempts;
        await store.updateMany({
          where: owner,
          data: {
            status: retry ? "QUEUED" : "FAILED", error: failure.message,
            availableAt: new Date(Date.now() + attempts * 5000),
            completedAt: retry ? null : new Date(), leaseUntil: null, leaseToken: null,
          },
        });
      }
    } catch {
      if (!this.shutdown.signal.aborted) this.logger.warn("Antrean backtesting belum dapat diproses; akan dicoba lagi.");
    } finally {
      this.processing = false;
    }
  }

  private async callPython(snapshot: Prisma.JsonValue): Promise<Prisma.InputJsonObject> {
    const key = process.env.ML_SERVICE_KEY;
    if (!key) throw new BacktestFailure("Isi ML_SERVICE_KEY dan nyalakan layanan Python.");
    const url = process.env.ML_SERVICE_URL ?? "http://127.0.0.1:8000";
    let response: Response;
    try {
      response = await fetch(url + "/backtest", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-ML-Key": key },
        body: JSON.stringify(snapshot),
        signal: AbortSignal.any([this.shutdown.signal, AbortSignal.timeout(90_000)]),
      });
    } catch {
      throw new BacktestFailure("Layanan Python belum merespons. Pastikan layanan berjalan.", true);
    }
    if (response.status === 429 || response.status >= 500)
      throw new BacktestFailure("Layanan Python sedang sibuk atau belum siap.", true);
    if (response.status === 404)
      throw new BacktestFailure("Mulai ulang layanan Python agar mendukung backtesting.");
    if (!response.ok)
      throw new BacktestFailure("Layanan Python menolak permintaan. Periksa kunci layanan dan riwayat penjualan.");
    try {
      const result = await response.json();
      const input = snapshot as Prisma.JsonObject;
      if (result?.protocol !== protocol || result.startDate !== input.startDate || result.endDate !== input.endDate ||
        result.modelVersion !== modelVersion || !result.summary || !Array.isArray(result.menus) ||
        result.menus.length !== (input.menus as Prisma.JsonArray).length)
        throw new Error("Invalid backtest result");
      return result;
    } catch {
      throw new BacktestFailure("Format hasil layanan Python tidak sesuai dengan versi backtesting.");
    }
  }
}
