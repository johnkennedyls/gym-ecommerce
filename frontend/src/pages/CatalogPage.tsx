import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { catalog, type CatalogFilters } from '../lib/api';
import { formatMoney } from '../lib/format';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { useResource } from '../lib/useResource';
import { ApiError } from '../lib/session';
import type { Category, Paginated, Product } from '../types/api';
import { PageHeader } from '../components/AppShell';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Option,
  Pager,
  Select,
  SkeletonCard,
} from '../components/ui';

const PAGE_SIZE = 12;

const KIND_LABELS: Record<string, string> = { PRODUCT: 'Producto', SERVICE: 'Servicio' };

const CATEGORY_ICONS: Record<string, string> = {
  suplementacion: '💊',
  indumentaria: '👕',
  accesorios: '🎒',
  servicios: '🏋️',
};

function iconFor(product: Product): string {
  return CATEGORY_ICONS[product.category.slug] ?? (product.kind === 'SERVICE' ? '🏋️' : '📦');
}

function ProductCard({ product }: { product: Product }) {
  const { isAuthenticated } = useAuth();
  const { add } = useCart();
  const { notify } = useToast();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const addToCart = async () => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: `/productos/${product.id}` } });
      return;
    }
    setBusy(true);
    try {
      await add(product.id, 1);
      notify(`${product.name} quedó en tu carrito`, 'success');
    } catch (cause) {
      notify(cause instanceof ApiError ? cause.message : 'No fue posible agregar el artículo', 'danger');
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="card card-tight stack" style={{ gap: 'var(--space-3)' }}>
      <div className="thumb" aria-hidden="true">
        {product.imageUrl ? <img src={product.imageUrl} alt="" loading="lazy" /> : iconFor(product)}
      </div>
      <div className="row" style={{ gap: 'var(--space-2)' }}>
        <Badge tone="neutral">{KIND_LABELS[product.kind]}</Badge>
        <Badge tone={product.available ? 'success' : 'danger'}>
          {product.available ? 'Disponible' : 'Agotado'}
        </Badge>
      </div>
      <h3 style={{ fontSize: 'var(--text-md)' }}>
        <Link to={`/productos/${product.id}`}>{product.name}</Link>
      </h3>
      <p className="tiny muted" style={{ margin: 0 }}>
        {product.category.name}
        {product.kind === 'SERVICE' && product.durationMinutes
          ? ` · ${product.durationMinutes} min`
          : product.kind === 'PRODUCT' && product.stock !== null
            ? ` · ${product.stock} en stock`
            : ''}
      </p>
      <div className="row-between">
        <span className="price">{formatMoney(product.price, product.currency)}</span>
        <Button size="sm" onClick={addToCart} disabled={busy || !product.available}>
          {busy ? 'Agregando…' : 'Agregar'}
        </Button>
      </div>
    </article>
  );
}

export function CatalogPage() {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get('search') ?? '');
  const categories = useResource(() => catalog.categories(), []);

  const filters: CatalogFilters = {
    page: Number(params.get('page') ?? 1),
    limit: PAGE_SIZE,
    search: params.get('search') ?? undefined,
    categoryId: params.get('categoryId') ?? undefined,
    kind: (params.get('kind') as CatalogFilters['kind']) ?? undefined,
    minPrice: params.get('minPrice') ? Number(params.get('minPrice')) : undefined,
    maxPrice: params.get('maxPrice') ? Number(params.get('maxPrice')) : undefined,
    availableOnly: params.get('availableOnly') === 'true' ? true : undefined,
    sortBy: (params.get('sortBy') as CatalogFilters['sortBy']) ?? undefined,
  };

  const products = useResource(() => catalog.products(filters), [
    params.toString(),
  ]);

  const apply = (next: Record<string, string | undefined>) => {
    const merged = new URLSearchParams(params);
    for (const [key, value] of Object.entries(next)) {
      if (value === undefined || value === '') merged.delete(key);
      else merged.set(key, value);
    }
    if (!('page' in next)) merged.delete('page');
    setParams(merged, { replace: true });
  };

  const submitFilters = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    apply({
      search: (data.get('search') as string) || undefined,
      categoryId: (data.get('categoryId') as string) || undefined,
      kind: (data.get('kind') as string) || undefined,
      minPrice: (data.get('minPrice') as string) || undefined,
      maxPrice: (data.get('maxPrice') as string) || undefined,
      availableOnly: data.get('availableOnly') ? 'true' : undefined,
      sortBy: (data.get('sortBy') as string) || undefined,
      page: undefined,
    });
  };

  const list: Paginated<Product> | undefined = products.data;

  return (
    <div className="stack">
      <section className="hero">
        <div>
          <h1>Todo tu gimnasio, en un solo carrito</h1>
          <p className="muted">
            Compra suplementos e indumentaria, activa tu membresía y reserva clases. Pagos probados en
            ambiente seguro de prácticas.
          </p>
        </div>
        <div className="row">
          <Link className="btn btn-primary" to="/membresias">
            Ver membresías
          </Link>
          <Link className="btn btn-secondary" to="/clases">
            Reservar clases
          </Link>
        </div>
      </section>

      <PageHeader
        title="Catálogo"
        subtitle={
          list ? `${list.total} artículos disponibles` : 'Productos y servicios del gimnasio'
        }
      />

      <Card tight>
        <form className="stack" onSubmit={submitFilters}>
          <div className="form-grid">
            <Field label="Buscar" htmlFor="search">
              <Input
                id="search"
                name="search"
                placeholder="whey, camiseta, entrenador…"
                maxLength={80}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </Field>
            <Field label="Categoría" htmlFor="categoryId">
              <Select id="categoryId" name="categoryId" defaultValue={params.get('categoryId') ?? ''}>
                <Option value="">Todas</Option>
                {(categories.data ?? []).map((category: Category) => (
                  <Option key={category.id} value={category.id}>
                    {category.name}
                  </Option>
                ))}
              </Select>
            </Field>
            <Field label="Tipo" htmlFor="kind">
              <Select id="kind" name="kind" defaultValue={params.get('kind') ?? ''}>
                <Option value="">Productos y servicios</Option>
                <Option value="PRODUCT">Solo productos</Option>
                <Option value="SERVICE">Solo servicios</Option>
              </Select>
            </Field>
            <Field label="Ordenar por" htmlFor="sortBy">
              <Select id="sortBy" name="sortBy" defaultValue={params.get('sortBy') ?? ''}>
                <Option value="">Novedades</Option>
                <Option value="price_asc">Precio: menor a mayor</Option>
                <Option value="price_desc">Precio: mayor a menor</Option>
                <Option value="name">Nombre (A-Z)</Option>
              </Select>
            </Field>
            <Field label="Precio mínimo" htmlFor="minPrice">
              <Input
                id="minPrice"
                name="minPrice"
                type="number"
                min={0}
                placeholder="0"
                defaultValue={params.get('minPrice') ?? ''}
              />
            </Field>
            <Field label="Precio máximo" htmlFor="maxPrice">
              <Input
                id="maxPrice"
                name="maxPrice"
                type="number"
                min={0}
                placeholder="1000000"
                defaultValue={params.get('maxPrice') ?? ''}
              />
            </Field>
          </div>
          <div className="row-between">
            <label className="checkbox">
              <input
                type="checkbox"
                name="availableOnly"
                defaultChecked={params.get('availableOnly') === 'true'}
              />
              Mostrar solo disponibles
            </label>
            <div className="row">
              <Button
                variant="ghost"
                size="sm"
                type="button"
                onClick={() => {
                  setSearch('');
                  apply({
                    search: undefined,
                    categoryId: undefined,
                    kind: undefined,
                    minPrice: undefined,
                    maxPrice: undefined,
                    availableOnly: undefined,
                    sortBy: undefined,
                    page: undefined,
                  });
                }}
              >
                Limpiar
              </Button>
              <Button type="submit" size="sm">
                Aplicar filtros
              </Button>
            </div>
          </div>
        </form>
      </Card>

      {products.loading ? (
        <div className="grid grid-cards" aria-hidden="true">
          {Array.from({ length: 6 }, (_, index) => (
            <SkeletonCard key={index} />
          ))}
        </div>
      ) : products.error ? (
        <ErrorState message={products.error} onRetry={products.reload} />
      ) : list && list.items.length > 0 ? (
        <>
          <div className="grid grid-cards">
            {list.items.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
          <Pager
            page={list.page}
            totalPages={list.totalPages}
            label="productos"
            onChange={(page) => apply({ page: String(page) })}
          />
        </>
      ) : (
        <EmptyState
          title="Sin resultados"
          description="Ajusta la búsqueda o quita algunos filtros para ver más artículos."
        />
      )}
    </div>
  );
}
