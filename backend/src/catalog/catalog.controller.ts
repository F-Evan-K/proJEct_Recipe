import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Delete,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { PrismaService } from "../prisma.service";
import { IngredientDto, MenuDto, RecipeDto, MenuDetailsDto } from "../dto";
@ApiTags("catalog")
@Controller()
export class CatalogController {
  constructor(private readonly db: PrismaService) {}
  @Get("ingredients") ingredients() {
    return this.db.ingredient.findMany({ orderBy: { id: "asc" } });
  }
  @Post("ingredients") ingredient(@Body() dto: IngredientDto) {
    return this.db.ingredient.create({
      data: { ...dto, name: dto.name.trim(), category: dto.category.trim() },
    });
  }
  @Put("ingredients/:id") updateIngredient(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: IngredientDto,
  ) {
    return this.db.$transaction(async (tx) => {
      const existing = await tx.ingredient.findUnique({ where: { id } });
      if (!existing) throw new NotFoundException("Ingredient not found");
      // Unit is immutable once created: changing it silently would corrupt stock and recipes.
      if (existing.unit !== dto.unit)
        throw new BadRequestException(
          "Unit cannot be changed. Create a new ingredient with the correct unit.",
        );
      return tx.ingredient.update({
        where: { id },
        data: {
          name: dto.name.trim(),
          category: dto.category.trim(),
          minimum: dto.minimum,
        },
      });
    });
  }
  @Get("menus") menus() {
    return this.db.menuItem.findMany({
      include: { recipe: { include: { ingredient: true } } },
      orderBy: { id: "asc" },
    });
  }
  @Get("menus/:id") async menu(@Param("id", ParseIntPipe) id: number) {
    const menu = await this.db.menuItem.findUnique({
      where: { id },
      include: { recipe: { include: { ingredient: true } } },
    });
    if (!menu) throw new NotFoundException("Menu not found");
    return menu;
  }
  @Post("menus") createMenu(@Body() dto: MenuDto) {
    return this.db.menuItem.create({
      data: { ...dto, name: dto.name.trim(), category: dto.category.trim() },
    });
  }
  @Put("menus/:id") updateMenu(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: MenuDto,
  ) {
    return this.db.menuItem.update({
      where: { id },
      data: { ...dto, name: dto.name.trim(), category: dto.category.trim() },
    });
  }
  @Put("menus/:id/details") saveDetails(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: MenuDetailsDto,
  ) {
    const { recipe, ...metadata } = dto;
    if (
      new Set(recipe.lines.map((l) => l.ingredientId)).size !==
      recipe.lines.length
    )
      throw new BadRequestException("Duplicate ingredient in recipe");
    return this.db.$transaction(async (tx) => {
      if (!(await tx.menuItem.findUnique({ where: { id } })))
        throw new NotFoundException("Menu not found");
      const count = await tx.ingredient.count({
        where: { id: { in: recipe.lines.map((l) => l.ingredientId) } },
      });
      if (count !== recipe.lines.length)
        throw new BadRequestException("Unknown ingredient");
      await tx.menuItem.update({
        where: { id },
        data: {
          ...metadata,
          name: metadata.name.trim(),
          category: metadata.category.trim(),
        },
      });
      await tx.recipeLine.deleteMany({ where: { menuId: id } });
      if (recipe.lines.length)
        await tx.recipeLine.createMany({
          data: recipe.lines.map((l) => ({ ...l, menuId: id })),
        });
      return tx.menuItem.findUnique({
        where: { id },
        include: { recipe: { include: { ingredient: true } } },
      });
    });
  }
  @Delete("menus/:id") archive(@Param("id", ParseIntPipe) id: number) {
    return this.db.menuItem.update({ where: { id }, data: { active: false } });
  }
  @Put("menus/:id/recipe") replaceRecipe(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: RecipeDto,
  ) {
    if (new Set(dto.lines.map((l) => l.ingredientId)).size !== dto.lines.length)
      throw new BadRequestException("Duplicate ingredient in recipe");
    return this.db.$transaction(async (tx) => {
      if (!(await tx.menuItem.findUnique({ where: { id } })))
        throw new NotFoundException("Menu not found");
      const ingredients = await tx.ingredient.count({
        where: { id: { in: dto.lines.map((l) => l.ingredientId) } },
      });
      if (ingredients !== dto.lines.length)
        throw new BadRequestException("Unknown ingredient");
      await tx.recipeLine.deleteMany({ where: { menuId: id } });
      if (dto.lines.length)
        await tx.recipeLine.createMany({
          data: dto.lines.map((l) => ({ ...l, menuId: id })),
        });
      return tx.menuItem.findUnique({
        where: { id },
        include: { recipe: { include: { ingredient: true } } },
      });
    });
  }
}
