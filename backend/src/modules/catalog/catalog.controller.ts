import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { CatalogService } from './catalog.service';
import {
  AdjustStockDto,
  CatalogQueryDto,
  CreateCategoryDto,
  UpdateCategoryDto,
  UpdateProductDto,
  UpsertProductDto,
} from './dto/catalog.dto';
import { CurrentUser, Roles } from '../../common/decorators/auth.decorators';
import { JwtAuthGuard, RolesGuard } from '../../common/guards/auth.guard';
import { Role } from '../../common/enums';
import { AuditService } from '../../common/services/audit.service';
import { User } from '../users/entities/user.entity';

@ApiTags('catalog')
@Controller('catalog')
export class CatalogController {
  constructor(
    private readonly catalog: CatalogService,
    private readonly audit: AuditService,
  ) {}

  @Get('products')
  @ApiOperation({ summary: 'RF-04 / RF-05 Catálogo con búsqueda, filtros y ordenamiento' })
  search(@Query() query: CatalogQueryDto) {
    return this.catalog.search(query);
  }

  @Get('products/:id')
  @ApiOperation({ summary: 'RF-04 Detalle de producto o servicio' })
  product(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalog.findProduct(id);
  }

  @Get('categories')
  @ApiOperation({ summary: 'RF-04 / RF-05 Categorías para filtros del catálogo' })
  categories() {
    return this.catalog.listCategories(true);
  }

  @Post('categories')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'RF-12 Crear categoría' })
  async createCategory(
    @Body() dto: CreateCategoryDto,
    @CurrentUser() actor: User,
    @Req() req: Request,
  ) {
    const created = await this.catalog.createCategory(dto);
    await this.audit.record({
      userId: actor.id,
      action: 'CATEGORY_CREATED',
      entityName: 'categories',
      entityId: created.id,
      details: { name: created.name },
      ipAddress: req.ip ?? null,
    });
    return created;
  }

  @Patch('categories/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'RF-12 Modificar o desactivar categoría' })
  async updateCategory(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCategoryDto,
    @CurrentUser() actor: User,
    @Req() req: Request,
  ) {
    const updated = await this.catalog.updateCategory(id, dto);
    await this.audit.record({
      userId: actor.id,
      action: 'CATEGORY_UPDATED',
      entityName: 'categories',
      entityId: id,
      ipAddress: req.ip ?? null,
    });
    return updated;
  }

  @Post('products')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'RF-12 Crear producto o servicio' })
  async createProduct(
    @Body() dto: UpsertProductDto,
    @CurrentUser() actor: User,
    @Req() req: Request,
  ) {
    const created = await this.catalog.createProduct(dto);
    await this.audit.record({
      userId: actor.id,
      action: 'PRODUCT_CREATED',
      entityName: 'products',
      entityId: created.id,
      details: { sku: created.sku },
      ipAddress: req.ip ?? null,
    });
    return created;
  }

  @Patch('products/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'RF-12 Modificar o desactivar producto' })
  async updateProduct(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
    @CurrentUser() actor: User,
    @Req() req: Request,
  ) {
    const updated = await this.catalog.updateProduct(id, dto);
    await this.audit.record({
      userId: actor.id,
      action: 'PRODUCT_UPDATED',
      entityName: 'products',
      entityId: id,
      ipAddress: req.ip ?? null,
    });
    return updated;
  }

  @Post('products/:id/stock')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'RF-13 Ajustar inventario' })
  adjustStock(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdjustStockDto,
    @CurrentUser() actor: User,
  ) {
    return this.catalog.adjustStock(id, dto, actor.id);
  }

  @Get('products/:id/movements')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: 'RF-13 Movimientos de inventario' })
  movements(@Param('id', ParseUUIDPipe) id: string, @Query('limit') limit?: string) {
    return this.catalog.listMovements(id, limit ? Number(limit) : 50);
  }
}
