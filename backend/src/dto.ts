import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
export class IngredientDto {
  @IsString()
  @Matches(/\S/)
  @MaxLength(100)
  @ApiProperty({ type: String, required: true })
  name: string;
  @IsString()
  @Matches(/\S/)
  @MaxLength(60)
  @ApiProperty({ type: String, required: true })
  category: string;
  @IsIn(["kg", "liter", "unit"])
  @ApiProperty({ type: String, required: true })
  unit: string;
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(0)
  @Max(1000000)
  @ApiProperty({ type: Number, required: true })
  minimum: number;
}
export class MenuDto {
  @IsString()
  @Matches(/\S/)
  @MaxLength(100)
  @ApiProperty({ type: String, required: true })
  name: string;
  @IsString()
  @Matches(/\S/)
  @MaxLength(60)
  @ApiProperty({ type: String, required: true })
  category: string;
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100000000)
  @ApiProperty({ type: Number, required: true })
  price: number;
  @IsOptional()
  @IsString()
  @MaxLength(16)
  @ApiProperty({ type: String, required: false })
  emoji?: string;
  @IsOptional()
  @IsBoolean()
  @ApiProperty({ type: Boolean, required: false })
  active?: boolean;
}
export class RecipeLineDto {
  @IsInt()
  @Min(1)
  @ApiProperty({ type: Number, required: true })
  ingredientId: number;
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(0.000001)
  @Max(1000000)
  @ApiProperty({ type: Number, required: true })
  declare quantity: number;
}
export class RecipeDto {
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => RecipeLineDto)
  @ApiProperty({ type: () => RecipeLineDto, isArray: true, required: true })
  lines: RecipeLineDto[];
}
export class MovementDto {
  @IsInt()
  @Min(1)
  @ApiProperty({ type: Number, required: true })
  ingredientId: number;
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(-1000000)
  @Max(1000000)
  @ApiProperty({ type: Number, required: true })
  quantity: number;
  @IsString()
  @Matches(/\S/)
  @MaxLength(200)
  @ApiProperty({ type: String, required: true })
  reason: string;
  @IsString()
  @MinLength(8)
  @MaxLength(100)
  @ApiProperty({ type: String, required: true })
  idempotencyKey: string;
}
export class WasteDto extends MovementDto {
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(0.000001)
  @Max(1000000)
  @ApiProperty({ type: Number, required: true })
  declare quantity: number;
}
export class PlanItemDto {
  @IsInt()
  @Min(1)
  @ApiProperty({ type: Number, required: true })
  menuId: number;
  @IsInt()
  @Min(0)
  @Max(9999)
  @ApiProperty({ type: Number, required: true })
  portions: number;
}
export class PlanPreviewDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => PlanItemDto)
  @ApiProperty({ type: () => PlanItemDto, isArray: true, required: true })
  items: PlanItemDto[];
}
export class PlanDto extends PlanPreviewDto {
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @ApiProperty({ type: String, required: true })
  businessDate: string;
  @IsString()
  @MinLength(8)
  @MaxLength(100)
  @ApiProperty({ type: String, required: true })
  idempotencyKey: string;
}
export class SaleDto {
  @IsInt()
  @Min(1)
  @ApiProperty({ type: Number, required: true })
  menuId: number;
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @ApiProperty({ type: String, required: true })
  businessDate: string;
  @IsInt()
  @Min(0)
  @Max(1000000)
  @ApiProperty({ type: Number, required: true })
  quantity: number;
  @IsOptional()
  @IsBoolean()
  @ApiProperty({ type: Boolean, required: false })
  stockout?: boolean;
  @IsOptional()
  @IsBoolean()
  @ApiProperty({ type: Boolean, required: false })
  closed?: boolean;
}
