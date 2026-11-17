import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { Category } from './entities/category.entity';
import { Product } from './entities/product.entity';
import { StockMovement } from './entities/stock-movement.entity';
import {
  AdjustStockDto,
  CatalogQueryDto,
  CreateCategoryDto,
  UpdateCategoryDto,
  UpdateProductDto,
  UpsertProductDto,
} from './dto/catalog.dto';
import { ProductKind, StockMovementType } from '../../common/enums';
import { PaginatedResult, paginate } from '../../common/dto/pagination';

export type ProductView = {
  id: string;
  name: string;
  sku: string;
  description: string | null;
  price: number;
  currency: string;
  imageUrl: string | null;
  kind: ProductKind;
  stock: number | null;
  durationMinutes: number | null;
  isActive: boolean;
  available: boolean;
  category: { id: string; name: string; slug: string };
};

export const toProductView = (product: Product): ProductView => ({
  id: product.id,
  name: product.name,
  sku: product.sku,
  description: product.description ?? null,
  price: Number(product.price),
  currency: product.currency,
  imageUrl: product.imageUrl ?? null,
  kind: product.kind,
  stock: product.stock,
  durationMinutes: product.durationMinutes ?? null,
  isActive: product.isActive,
  available: product.isActive && (product.stock === null || product.stock > 0),
  category: {
    id: product.category?.id ?? product.categoryId,
    name: product.category?.name ?? '',
    slug: product.category?.slug ?? '',
  },
});

const slugify = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

@Injectable()
export class CatalogService {
  constructor(
    @InjectRepository(Category) private readonly categories: Repository<Category>,
    @InjectRepository(Product) private readonly products: Repository<Product>,
    @InjectRepository(StockMovement) private readonly movements: Repository<StockMovement>,
  ) {}

  // ---------------------------------------------------------------- RF-04 / RF-05 catálogo

  async search(query: CatalogQueryDto): Promise<PaginatedResult<ProductView>> {
    const builder = this.products
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.category', 'category');

    if (!query.includeInactive) builder.andWhere('product.isActive = true');
    if (query.search) {
      builder.andWhere(
        '(lower(product.name) LIKE :term OR lower(product.sku) LIKE :term OR lower(product.description) LIKE :term)',
        { term: `%${query.search.toLowerCase()}%` },
      );
    }
    if (query.categoryId) builder.andWhere('product.categoryId = :categoryId', { categoryId: query.categoryId });
    if (query.kind) builder.andWhere('product.kind = :kind', { kind: query.kind });
    if (query.minPrice !== undefined) builder.andWhere('product.price >= :minPrice', { minPrice: query.minPrice });
    if (query.maxPrice !== undefined) builder.andWhere('product.price <= :maxPrice', { maxPrice: query.maxPrice });
    if (query.availableOnly) builder.andWhere('(product.stock IS NULL OR product.stock > 0)');

    switch (query.sortBy) {
      case 'price_asc':
        builder.orderBy('product.price', 'ASC');
        break;
      case 'price_desc':
        builder.orderBy('product.price', 'DESC');
        break;
      case 'name':
        builder.orderBy('product.name', 'ASC');
        break;
      default:
        builder.orderBy('product.createdAt', 'DESC');
    }

    const [items, total] = await builder
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();

    return paginate(items.map(toProductView), total, query.page, query.limit);
  }

  async findProduct(id: string): Promise<ProductView> {
    return toProductView(await this.getProductEntity(id));
  }

  async getProductEntity(id: string): Promise<Product> {
    const product = await this.products.findOne({ where: { id }, relations: { category: true } });
    if (!product) throw new NotFoundException('El producto o servicio no existe');
    return product;
  }

  findProductsByIds(ids: string[]): Promise<Product[]> {
    return this.products.find({ where: { id: In(ids) }, relations: { category: true } });
  }

  listCategories(onlyActive = true): Promise<Category[]> {
    return this.categories.find({
      where: onlyActive ? { isActive: true } : {},
      order: { name: 'ASC' },
    });
  }

  // ---------------------------------------------------------------- RF-12 administración

  async createCategory(dto: CreateCategoryDto): Promise<Category> {
    const slug = dto.slug ?? slugify(dto.name);
    if (await this.categories.findOne({ where: { slug } })) {
      throw new ConflictException('Ya existe una categoría con ese identificador');
    }
    return this.categories.save(
      this.categories.create({ name: dto.name, slug, description: dto.description ?? null }),
    );
  }

  async updateCategory(id: string, dto: UpdateCategoryDto): Promise<Category> {
    const category = await this.categories.findOne({ where: { id } });
    if (!category) throw new NotFoundException('La categoría no existe');
    category.name = dto.name ?? category.name;
    category.slug = dto.slug ?? slugify(category.name);
    category.description = dto.description ?? category.description;
    category.isActive = dto.isActive ?? category.isActive;
    return this.categories.save(category);
  }

  async createProduct(dto: UpsertProductDto): Promise<ProductView> {
    const category = await this.categories.findOne({ where: { id: dto.categoryId } });
    if (!category) throw new NotFoundException('La categoría no existe');
    if (await this.products.findOne({ where: { sku: dto.sku } })) {
      throw new ConflictException('Ya existe un artículo con ese sku');
    }

    const isProduct = dto.kind === ProductKind.PRODUCT;
    const saved = await this.products.save(
      this.products.create({
        name: dto.name,
        sku: dto.sku,
        description: dto.description ?? null,
        price: dto.price.toFixed(2),
        currency: dto.currency ?? 'COP',
        imageUrl: dto.imageUrl ?? null,
        kind: dto.kind,
        stock: isProduct ? (dto.stock ?? 0) : null,
        durationMinutes: isProduct ? null : (dto.durationMinutes ?? 60),
        isActive: dto.isActive ?? true,
        categoryId: category.id,
      }),
    );
    return this.findProduct(saved.id);
  }

  async updateProduct(id: string, dto: UpdateProductDto): Promise<ProductView> {
    const product = await this.getProductEntity(id);

    if (dto.categoryId) {
      const category = await this.categories.findOne({ where: { id: dto.categoryId } });
      if (!category) throw new NotFoundException('La categoría no existe');
      product.categoryId = category.id;
    }
    if (dto.name !== undefined) product.name = dto.name;
    if (dto.description !== undefined) product.description = dto.description;
    if (dto.price !== undefined) product.price = dto.price.toFixed(2);
    if (dto.imageUrl !== undefined) product.imageUrl = dto.imageUrl;
    if (dto.isActive !== undefined) product.isActive = dto.isActive;
    if (dto.durationMinutes !== undefined && product.kind === ProductKind.SERVICE) {
      product.durationMinutes = dto.durationMinutes;
    }

    // Un cambio de stock desde el panel se registra como movimiento de inventario.
    if (dto.stock !== undefined && product.kind === ProductKind.PRODUCT && dto.stock !== product.stock) {
      const delta = dto.stock - (product.stock ?? 0);
      product.stock = dto.stock;
      await this.movements.save(
        this.movements.create({
          productId: product.id,
          type: delta > 0 ? StockMovementType.ADJUSTMENT_IN : StockMovementType.ADJUSTMENT_OUT,
          quantity: delta,
          resultingStock: dto.stock,
          note: 'Actualización desde el panel administrativo',
        }),
      );
    }

    await this.products.save(product);
    return toProductView(product);
  }

  /** RF-13 Ajuste manual de inventario con trazabilidad. */
  async adjustStock(id: string, dto: AdjustStockDto, userId: string): Promise<ProductView> {
    const product = await this.getProductEntity(id);
    if (product.kind !== ProductKind.PRODUCT) {
      throw new BadRequestException('Los servicios no administran stock');
    }

    const resulting = (product.stock ?? 0) + dto.quantity;
    if (resulting < 0) throw new BadRequestException('El inventario resultante no puede ser negativo');

    product.stock = resulting;
    await this.products.save(product);
    await this.movements.save(
      this.movements.create({
        productId: product.id,
        userId,
        type: dto.quantity >= 0 ? StockMovementType.ADJUSTMENT_IN : StockMovementType.ADJUSTMENT_OUT,
        quantity: dto.quantity,
        resultingStock: resulting,
        note: dto.note ?? 'Ajuste manual desde el panel administrativo',
      }),
    );
    return toProductView(product);
  }

  listMovements(productId: string, limit = 50): Promise<StockMovement[]> {
    return this.movements.find({
      where: { productId },
      order: { createdAt: 'DESC' },
      take: Math.min(limit, 200),
    });
  }

  // ---------------------------------------------------------------- apoya a pedidos (RNF-08 integridad)

  /** Descuenta stock dentro de la transacción del pedido, con bloqueo de fila. */
  async consumeStock(
    manager: EntityManager,
    args: { productId: string; quantity: number; orderCode: string; userId: string },
  ): Promise<Product> {
    const product = await manager
      .createQueryBuilder(Product, 'product')
      .setLock('pessimistic_write')
      .where('product.id = :id', { id: args.productId })
      .getOne();

    if (!product || !product.isActive) throw new NotFoundException('El artículo no está disponible');
    if (product.kind === ProductKind.PRODUCT) {
      if ((product.stock ?? 0) < args.quantity) {
        throw new BadRequestException(`Solo hay ${product.stock ?? 0} unidades de ${product.name}`);
      }
      product.stock = (product.stock ?? 0) - args.quantity;
      await manager.save(product);
      await manager.save(
        manager.create(StockMovement, {
          productId: product.id,
          userId: args.userId,
          type: StockMovementType.SALE,
          quantity: -args.quantity,
          resultingStock: product.stock,
          referenceCode: args.orderCode,
          note: 'Venta mediante checkout',
        }),
      );
    }
    return product;
  }

  /** Devuelve el stock cuando un pedido se cancela. */
  async restoreStock(
    manager: EntityManager,
    args: { productId: string; quantity: number; orderCode: string; userId: string | null },
  ): Promise<void> {
    const product = await manager.findOne(Product, { where: { id: args.productId } });
    if (!product || product.kind !== ProductKind.PRODUCT) return;

    product.stock = (product.stock ?? 0) + args.quantity;
    await manager.save(product);
    await manager.save(
      manager.create(StockMovement, {
        productId: product.id,
        userId: args.userId,
        type: StockMovementType.CANCELLATION,
        quantity: args.quantity,
        resultingStock: product.stock,
        referenceCode: args.orderCode,
        note: 'Devolución por cancelación de pedido',
      }),
    );
  }

  /** RF-14 Productos con inventario crítico para los reportes de la administración. */
  async findLowStock(threshold: number, limit = 20): Promise<ProductView[]> {
    const rows = await this.products
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.category', 'category')
      .where('product.kind = :kind', { kind: ProductKind.PRODUCT })
      .andWhere('product.isActive = true')
      .andWhere('product.stock <= :threshold', { threshold })
      .orderBy('product.stock', 'ASC')
      .take(limit)
      .getMany();
    return rows.map(toProductView);
  }

  countActiveProducts(): Promise<number> {
    return this.products.count({ where: { isActive: true } });
  }
}
