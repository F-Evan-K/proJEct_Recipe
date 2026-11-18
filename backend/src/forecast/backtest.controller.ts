import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, Req } from "@nestjs/common";
import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsDateString, IsInt, Matches, Min } from "class-validator";
import type { Request } from "express";
import { BacktestService } from "./backtest.service";

class BacktestDto {
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  startDate: string;

  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  endDate: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  menuIds: number[];
}

@Controller("forecast-backtests")
export class BacktestController {
  constructor(private readonly backtests: BacktestService) {}

  @Post()
  create(@Body() dto: BacktestDto, @Req() request: Request & { user: { id: number } }) {
    return this.backtests.create(dto, request.user.id);
  }

  @Get()
  list(@Query("before", new ParseIntPipe({ optional: true })) before?: number) {
    return this.backtests.list(before);
  }

  @Get(":id")
  get(@Param("id", ParseIntPipe) id: number) {
    return this.backtests.get(id);
  }

  @Post(":id/retry")
  retry(@Param("id", ParseIntPipe) id: number) {
    return this.backtests.retry(id);
  }
}
