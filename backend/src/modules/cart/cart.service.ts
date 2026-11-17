import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cart } from './entities/cart.entity';
import { CartItem } from './entities/cart-item.entity';
import { CatalogService } from '../catalog/catalog.service';
import { ProductKind } from '../../common/enums';
import { CartTotals, calculateTotals } from './cart-calculator';

export type CartLineView = {
  id: string;
  productId: string;
  productName: string;
  kind: ProductKind;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  available: boolean;
};

export type CartView = {
  id: string;
  items: CartLineView[];
  totals: CartTotals;
};

@Injectable()
export class CartService {
  constructor(
    @InjectRepository(Cart) private readonly carts: Repository<Cart>,
    @InjectRepository(CartItem) private readonly items: Repository<CartItem>,
    private readonly catalog: CatalogService,
  ) {}

  /** RF-06 Consultar el carrito con totales actualizados. */
  getCart(userId: string): Promise<CartView> {
    return this.findOrCreate(userId).then((cart) => this.toView(cart.id));
  }

  async addItem(userId: string, productId: string, quantity: number): Promise<CartView> {
    if (quantity < 1) throw new BadRequestException('La cantidad debe ser al menos 1');

    const cart = await this.findOrCreate(userId);
    const product = await this.catalog.getProductEntity(productId);
    if (!product.isActive) throw new BadRequestException('El artículo no está disponible para compra');

    const existing = await this.items.findOne({ where: { cartId: cart.id, productId } });
    const nextQuantity = (existing?.quantity ?? 0) + quantity;
    this.assertStock(product, nextQuantity);

    if (existing) {
      existing.quantity = nextQuantity;
      existing.unitPrice = product.price;
      existing.productName = product.name;
      await this.items.save(existing);
    } else {
      await this.items.save(
        this.items.create({
          cartId: cart.id,
          productId,
          quantity,
          productName: product.name,
          unitPrice: product.price,
        }),
      );
    }
    return this.toView(cart.id);
  }

  async updateQuantity(userId: string, itemId: string, quantity: number): Promise<CartView> {
    if (quantity < 1) throw new BadRequestException('La cantidad debe ser al menos 1');
    const cart = await this.findOrCreate(userId);
    const item = await this.items.findOne({ where: { id: itemId, cartId: cart.id } });
    if (!item) throw new NotFoundException('El ítem no está en tu carrito');

    const product = await this.catalog.getProductEntity(item.productId);
    this.assertStock(product, quantity);

    item.quantity = quantity;
    await this.items.save(item);
    return this.toView(cart.id);
  }

  async removeItem(userId: string, itemId: string): Promise<CartView> {
    const cart = await this.findOrCreate(userId);
    const item = await this.items.findOne({ where: { id: itemId, cartId: cart.id } });
    if (!item) throw new NotFoundException('El ítem no está en tu carrito');
    await this.items.remove(item);
    return this.toView(cart.id);
  }

  async clear(userId: string): Promise<CartView> {
    const cart = await this.findOrCreate(userId);
    await this.items.delete({ cartId: cart.id });
    return this.toView(cart.id);
  }

  async loadWithItems(userId: string): Promise<{ cart: Cart; items: CartItem[] }> {
    const cart = await this.findOrCreate(userId);
    return { cart, items: await this.items.find({ where: { cartId: cart.id } }) };
  }

  async emptyCart(cartId: string): Promise<void> {
    await this.items.delete({ cartId });
  }

  private async findOrCreate(userId: string): Promise<Cart> {
    const existing = await this.carts.findOne({ where: { userId } });
    if (existing) return existing;
    return this.carts.save(this.carts.create({ userId }));
  }

  private assertStock(product: { kind: ProductKind; stock: number | null; name: string }, quantity: number): void {
    if (product.kind === ProductKind.PRODUCT && product.stock !== null && quantity > product.stock) {
      throw new BadRequestException(`Solo hay ${product.stock} unidades disponibles de ${product.name}`);
    }
  }

  private async toView(cartId: string): Promise<CartView> {
    const items = await this.items.find({ where: { cartId } });
    const products = items.length
      ? await this.catalog.findProductsByIds([...new Set(items.map((item) => item.productId))])
      : [];
    const byId = new Map(products.map((product) => [product.id, product]));

    const lines: CartLineView[] = items.map((item) => {
      const product = byId.get(item.productId);
      const unitPrice = Number(item.unitPrice);
      return {
        id: item.id,
        productId: item.productId,
        productName: item.productName,
        kind: product?.kind ?? ProductKind.PRODUCT,
        unitPrice,
        quantity: item.quantity,
        lineTotal: Math.round(unitPrice * item.quantity * 100) / 100,
        available: Boolean(product?.isActive) && (product?.stock === null || (product?.stock ?? 0) >= item.quantity),
      };
    });

    return {
      id: cartId,
      items: lines,
      totals: calculateTotals(lines.map((line) => ({ unitPrice: line.unitPrice, quantity: line.quantity }))),
    };
  }
}
