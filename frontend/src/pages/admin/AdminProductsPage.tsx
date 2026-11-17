import {
  useState,
  type CSSProperties,
  type FormEvent,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react';
import { PageHeader } from '../../components/AppShell';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Loading,
  Modal,
  Option,
  Pager,
  Select,
  Textarea,
} from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { catalog, type ProductInput } from '../../lib/api';
import { formatDateTime, formatMoney } from '../../lib/format';
import { ApiError } from '../../lib/session';
import { useResource } from '../../lib/useResource';
import type { Category, Product, ProductKind, StockMovement } from '../../types/api';

const SKU_PATTERN = /^[A-Z0-9-]{4,40}$/;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const KIND_LABELS: Record<ProductKind, string> = { PRODUCT: 'Producto', SERVICE: 'Servicio' };
const KIND_OPTIONS = (['PRODUCT', 'SERVICE'] as ProductKind[]).map((value) => ({
  value,
  label: KIND_LABELS[value],
}));
const KIND_FILTER_OPTIONS = [{ value: '', label: 'Todos' }, ...KIND_OPTIONS];
const MOVEMENT_LABELS: Record<StockMovement['type'], string> = {
  ADJUSTMENT_IN: 'Entrada',
  ADJUSTMENT_OUT: 'Salida',
  SALE: 'Venta',
  CANCELLATION: 'Devolución',
};

const failure = (cause: unknown, fallback: string): string =>
  cause instanceof ApiError ? cause.message : fallback;

const TIGHT_TEXT: CSSProperties = { margin: 0 };
const NAME_INPUT: CSSProperties = { width: '13rem' };
const CATEGORY_HEAD = ['Categoría', 'Acciones'];
const MOVEMENT_HEAD = ['Fecha', 'Tipo', 'Cantidad', 'Saldo', 'Referencia', 'Nota'];
const PRODUCT_HEAD = ['Nombre', 'SKU', 'Categoría', 'Tipo', 'Precio', 'Existencias', 'Estado', 'Acciones'];

type Choice = { value: string; label: string };

function Table({ head, rows }: { head: string[]; rows: { key: string; cells: ReactNode[] }[] }) {
  const headers = head.map((title) => (
    <th key={title} scope="col">
      {title}
    </th>
  ));
  const body = rows.map((row) => (
    <tr key={row.key}>
      {row.cells.map((cell, index) => (
        <td key={index}>{cell}</td>
      ))}
    </tr>
  ));
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>{headers}</tr>
        </thead>
        <tbody>{body}</tbody>
      </table>
    </div>
  );
}

type TextProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'value' | 'onChange'> & {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
};

function TextField({ id, label, value, onChange, error, hint, ...rest }: TextProps) {
  return (
    <Field label={label} htmlFor={id} error={error} hint={hint}>
      <Input id={id} value={value} onChange={(event) => onChange(event.target.value)} {...rest} />
    </Field>
  );
}

function ChoiceField({
  id,
  label,
  value,
  onChange,
  options,
  hint,
  error,
  ...rest
}: Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id' | 'value' | 'onChange'> & Omit<TextProps, 'value'> & {
  value: string;
  options: Choice[];
}) {
  return (
    <Field label={label} htmlFor={id} error={error} hint={hint}>
      <Select id={id} value={value} onChange={(event) => onChange(event.target.value)} {...rest}>
        {options.map((option) => (
          <Option key={option.value} value={option.value}>
            {option.label}
          </Option>
        ))}
      </Select>
    </Field>
  );
}

function Check({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="checkbox" htmlFor={id}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      {label}
    </label>
  );
}

const kindBadge = (kind: ProductKind) => (
  <Badge tone={kind === 'SERVICE' ? 'info' : 'neutral'}>{KIND_LABELS[kind]}</Badge>
);

const stateLabel = (isActive: boolean) => (isActive ? 'Activo' : 'Inactivo');

const activeBadge = (isActive: boolean) => (
  <Badge tone={isActive ? 'success' : 'neutral'}>{stateLabel(isActive)}</Badge>
);

const mutedText = (text: string) => <span className="tiny muted">{text}</span>;
const movementBadge = (movement: StockMovement) => (
  <Badge tone={movement.quantity >= 0 ? 'success' : 'danger'}>{MOVEMENT_LABELS[movement.type]}</Badge>
);

const movementRows = (movements: StockMovement[]) =>
  movements.map((movement) => ({
    key: movement.id,
    cells: [
      formatDateTime(movement.createdAt),
      movementBadge(movement),
      movement.quantity > 0 ? `+${movement.quantity}` : movement.quantity,
      movement.resultingStock,
      movement.referenceCode ?? '—',
      movement.note ?? '—',
    ],
  }));

type FormState = {
  name: string;
  sku: string;
  description: string;
  price: string;
  kind: ProductKind;
  categoryId: string;
  stock: string;
  durationMinutes: string;
  imageUrl: string;
  isActive: boolean;
};

type Errors = Partial<Record<keyof FormState, string>>;

const EMPTY_FORM: FormState = {
  name: '',
  sku: '',
  description: '',
  price: '',
  kind: 'PRODUCT',
  categoryId: '',
  stock: '',
  durationMinutes: '',
  imageUrl: '',
  isActive: true,
};

const toFormState = (product: Product): FormState => ({
  name: product.name,
  sku: product.sku,
  description: product.description ?? '',
  price: String(product.price),
  kind: product.kind,
  categoryId: product.category.id,
  stock: product.stock === null ? '' : String(product.stock),
  durationMinutes: product.durationMinutes === null ? '' : String(product.durationMinutes),
  imageUrl: product.imageUrl ?? '',
  isActive: product.isActive,
});

function validate(form: FormState): Errors {
  const errors: Errors = {};
  const name = form.name.trim();
  if (name.length < 2 || name.length > 140) {
    errors.name = 'El nombre debe tener entre 2 y 140 caracteres.';
  }
  if (!SKU_PATTERN.test(form.sku.trim().toUpperCase())) {
    errors.sku = 'Usa de 4 a 40 caracteres entre mayúsculas, números y guiones.';
  }
  if (form.description.trim().length > 2000) errors.description = 'Máximo 2000 caracteres.';
  const price = Number(form.price);
  if (form.price.trim() === '' || !Number.isFinite(price) || price < 0) {
    errors.price = 'Ingresa un precio mayor o igual a 0.';
  } else if (Math.round(price * 100) !== price * 100) {
    errors.price = 'El precio admite máximo 2 decimales.';
  }
  if (!form.categoryId) errors.categoryId = 'Selecciona una categoría.';
  if (form.imageUrl.trim().length > 300) errors.imageUrl = 'La URL admite máximo 300 caracteres.';
  if (form.kind === 'PRODUCT' && form.stock.trim() !== '') {
    const stock = Number(form.stock);
    if (!Number.isInteger(stock) || stock < 0) {
      errors.stock = 'El stock debe ser un entero mayor o igual a 0.';
    }
  }
  if (form.kind === 'SERVICE' && form.durationMinutes.trim() !== '') {
    const minutes = Number(form.durationMinutes);
    if (!Number.isInteger(minutes) || minutes < 5 || minutes > 600) {
      errors.durationMinutes = 'La duración debe ser un entero entre 5 y 600 minutos.';
    }
  }
  return errors;
}

function StockDialog({
  product,
  onClose,
  onSaved,
}: {
  product: Product;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { notify } = useToast();
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const delta = Number(quantity);
    if (quantity.trim() === '' || !Number.isInteger(delta) || delta === 0 || Math.abs(delta) > 100000) {
      notify('Ingresa un entero distinto de 0, entre -100000 y 100000.', 'danger');
      return;
    }
    setSaving(true);
    try {
      const trimmed = note.trim();
      await catalog.adjustStock(product.id, delta, trimmed === '' ? undefined : trimmed);
      notify('Existencias ajustadas.', 'success');
      onSaved();
    } catch (cause) {
      notify(failure(cause, 'No fue posible ajustar las existencias.'), 'danger');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={`Ajustar stock · ${product.name}`} onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <p className="tiny muted" style={TIGHT_TEXT}>
          Stock actual: {product.stock ?? 0} unidades.
        </p>
        <TextField
          id="stock-quantity"
          label="Cantidad"
          type="number"
          min={-100000}
          max={100000}
          step={1}
          value={quantity}
          required
          onChange={setQuantity}
          hint="Positivo suma existencias (entrada); negativo las resta (salida)."
        />
        <TextField
          id="stock-note"
          label="Nota"
          value={note}
          maxLength={240}
          onChange={setNote}
          hint="Opcional, máximo 240 caracteres."
        />
        <div className="row">
          <Button type="submit" disabled={saving}>
            {saving ? 'Guardando…' : 'Registrar movimiento'}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function MovementsDialog({ product, onClose }: { product: Product; onClose: () => void }) {
  const { data, loading, error, reload } = useResource(() => catalog.movements(product.id), [product.id]);
  return (
    <Modal title={`Movimientos · ${product.name}`} onClose={onClose}>
      <div className="stack">
        {loading ? <Loading rows={3} /> : null}
        {error ? <ErrorState message={error} onRetry={reload} /> : null}
        {data && data.length === 0 ? (
          <EmptyState
            title="Sin movimientos"
            description="Este artículo no tiene ajustes ni ventas registrados."
          />
        ) : null}
        {data && data.length > 0 ? (
          <Table head={MOVEMENT_HEAD} rows={movementRows(data)} />
        ) : null}
      </div>
    </Modal>
  );
}

function CategoriesPanel({
  categories,
  loading,
  error,
  onReload,
}: {
  categories: Category[];
  loading: boolean;
  error: string | undefined;
  onReload: () => void;
}) {
  const { notify } = useToast();
  const [draft, setDraft] = useState({ name: '', slug: '', description: '' });
  const [editingId, setEditingId] = useState('');
  const [editName, setEditName] = useState('');

  const patch = async (id: string, body: { name: string; isActive?: boolean }) => {
    try {
      await catalog.updateCategory(id, body);
      notify('Categoría actualizada.', 'success');
      setEditingId('');
      onReload();
    } catch (cause) {
      notify(failure(cause, 'No fue posible actualizar la categoría.'), 'danger');
    }
  };

  const create = async (event: FormEvent) => {
    event.preventDefault();
    const name = draft.name.trim();
    const slug = draft.slug.trim();
    const description = draft.description.trim();
    if (name.length < 2 || name.length > 80) {
      notify('El nombre debe tener entre 2 y 80 caracteres.', 'danger');
      return;
    }
    if (slug !== '' && !SLUG_PATTERN.test(slug)) {
      notify('El slug debe usar minúsculas, números y guiones.', 'danger');
      return;
    }
    if (description.length > 240) {
      notify('La descripción admite máximo 240 caracteres.', 'danger');
      return;
    }
    const body: { name: string; slug?: string; description?: string } = { name };
    if (slug !== '') body.slug = slug;
    if (description !== '') body.description = description;
    try {
      await catalog.createCategory(body);
      notify('Categoría creada.', 'success');
      setDraft({ name: '', slug: '', description: '' });
      onReload();
    } catch (cause) {
      notify(failure(cause, 'No fue posible crear la categoría.'), 'danger');
    }
  };

  const saveName = (category: Category) => {
    const name = editName.trim();
    if (name.length < 2 || name.length > 80) {
      notify('El nombre debe tener entre 2 y 80 caracteres.', 'danger');
      return;
    }
    void patch(category.id, { name });
  };

  const categoryCell = (category: Category) => {
    if (editingId === category.id) {
      return (
        <div className="row">
          <Input
            aria-label={`Nombre de ${category.name}`}
            value={editName}
            maxLength={80}
            onChange={(event) => setEditName(event.target.value)}
            style={NAME_INPUT}
          />
          <Button size="sm" onClick={() => saveName(category)}>Guardar</Button>
          <Button size="sm" variant="ghost" onClick={() => setEditingId('')}>Cancelar</Button>
        </div>
      );
    }
    return (
      <div>
        <strong>{category.name}</strong>
        <p className="tiny muted" style={TIGHT_TEXT}>
          /{category.slug}
          {category.description ? ` · ${category.description}` : ''}
        </p>
      </div>
    );
  };

  const categoryActions = (category: Category) => {
    const toggleLabel = category.isActive ? 'Desactivar' : 'Reactivar';
    const openEditor = () => {
      setEditingId(category.id);
      setEditName(category.name);
    };
    return (
      <div className="row">
        <Button size="sm" variant="secondary" onClick={openEditor}>Editar</Button>
        <Button size="sm" variant="ghost" title="UpdateCategoryDto exige name: se reenvía el nombre actual"
          onClick={() => void patch(category.id, { name: category.name, isActive: !category.isActive })}
        >
          {toggleLabel}
        </Button>
      </div>
    );
  };

  const categoryRows = categories.map((category) => ({
    key: category.id,
    cells: [categoryCell(category), categoryActions(category)],
  }));

  return (
    <Card title="Categorías">
      <div className="stack">
        {loading ? <Loading rows={3} /> : null}
        {error ? <ErrorState message={error} onRetry={onReload} /> : null}
        <form className="stack" onSubmit={create}>
          <div className="form-grid">
            <TextField id="cat-name" label="Nombre" value={draft.name} maxLength={80} required
              placeholder="Pesas libres" hint="Entre 2 y 80 caracteres."
              onChange={(value) => setDraft({ ...draft, name: value })}
            />
            <TextField id="cat-slug" label="Slug" value={draft.slug} maxLength={90}
              hint="Opcional: minúsculas, números y guiones."
              onChange={(value) => setDraft({ ...draft, slug: value })}
            />
            <TextField id="cat-description" label="Descripción" value={draft.description} maxLength={240}
              hint="Opcional, máximo 240 caracteres."
              onChange={(value) => setDraft({ ...draft, description: value })}
            />
          </div>
          <Button type="submit">Nueva categoría</Button>
        </form>
        {categories.length === 0 && !loading ? (
          <EmptyState
            title="Sin categorías activas"
            description="Crea la primera para poder publicar productos."
          />
        ) : (
          <Table head={CATEGORY_HEAD} rows={categoryRows} />
        )}
        <p className="tiny muted" style={TIGHT_TEXT}>
          La API devuelve solo categorías activas: al desactivarla deja de aparecer aquí y del formulario de productos.
        </p>
      </div>
    </Card>
  );
}

function ProductFormDialog({
  editing,
  form,
  errors,
  saving,
  categoryOptions,
  onField,
  onSubmit,
  onClose,
}: {
  editing: Product | null;
  form: FormState;
  errors: Errors;
  saving: boolean;
  categoryOptions: Choice[];
  onField: (patch: Partial<FormState>) => void;
  onSubmit: (event: FormEvent) => void;
  onClose: () => void;
}) {
  const title = editing ? `Editar ${editing.name}` : 'Nuevo producto';
  let submitLabel = editing ? 'Guardar cambios' : 'Crear producto';
  if (saving) submitLabel = 'Guardando…';
  return (
    <Modal title={title} onClose={onClose}>
      <form className="stack" onSubmit={onSubmit}>
        <div className="form-grid">
          <TextField id="p-name" label="Nombre" value={form.name} error={errors.name} maxLength={140}
            required onChange={(value) => onField({ name: value })}
          />
          <TextField id="p-sku" label="SKU" value={form.sku} error={errors.sku} maxLength={40} required
            disabled={Boolean(editing)} hint="Mayúsculas, números y guiones. La API no lo cambia al editar."
            onChange={(value) => onField({ sku: value.toUpperCase() })}
          />
          <TextField id="p-price" label="Precio (COP)" type="number" min={0} step="0.01" value={form.price}
            error={errors.price} required onChange={(value) => onField({ price: value })}
          />
          <ChoiceField id="p-kind" label="Tipo" value={form.kind} options={KIND_OPTIONS}
            disabled={Boolean(editing)} hint="No se puede cambiar al editar."
            onChange={(value) => onField({ kind: value as ProductKind })}
          />
          <ChoiceField id="p-category" label="Categoría" value={form.categoryId} options={categoryOptions}
            error={errors.categoryId} required onChange={(value) => onField({ categoryId: value })}
          />
          {form.kind === 'SERVICE' ? (
            <TextField id="p-duration" label="Duración (minutos)" type="number" min={5} max={600}
              value={form.durationMinutes} error={errors.durationMinutes} hint="Entero entre 5 y 600."
              onChange={(value) => onField({ durationMinutes: value })}
            />
          ) : (
            <TextField id="p-stock" label="Stock" type="number" min={0} value={form.stock} error={errors.stock}
              hint="Entero mayor o igual a 0." onChange={(value) => onField({ stock: value })}
            />
          )}
        </div>
        <Field label="Descripción" htmlFor="p-description" error={errors.description}
          hint="Opcional, máximo 2000 caracteres."
        >
          <Textarea id="p-description" rows={4} value={form.description} maxLength={2000}
            onChange={(event) => onField({ description: event.target.value })}
          />
        </Field>
        <TextField id="p-image" label="URL de imagen" value={form.imageUrl} error={errors.imageUrl}
          maxLength={300} hint="Opcional, máximo 300 caracteres."
          onChange={(value) => onField({ imageUrl: value })}
        />
        <Check id="p-active" label="Artículo activo (visible en el catálogo)" checked={form.isActive}
          onChange={(value) => onField({ isActive: value })}
        />
        <div className="row">
          <Button type="submit" disabled={saving}>{submitLabel}</Button>
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
        </div>
      </form>
    </Modal>
  );
}

export function AdminProductsPage() {
  const { notify } = useToast();
  const [page, setPage] = useState(1);
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [kind, setKind] = useState<'' | ProductKind>('');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [dialog, setDialog] = useState<'form' | 'stock' | 'moves' | null>(null);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);

  const categories = useResource(() => catalog.categories(), []);
  const list = useResource(
    () =>
      catalog.products({
        page,
        limit: 10,
        search: search === '' ? undefined : search,
        categoryId: categoryId === '' ? undefined : categoryId,
        kind: kind === '' ? undefined : kind,
        includeInactive,
      }),
    [page, search, categoryId, kind, includeInactive],
  );

  const categoryList = categories.data ?? [];
  const categoryOptions: Choice[] = [
    { value: '', label: categoryList.length === 0 ? 'Sin categorías' : 'Todas' },
    ...categoryList.map((category) => ({ value: category.id, label: category.name })),
  ];
  const target = dialog === 'stock' || dialog === 'moves' ? editing : null;

  const set = (patch: Partial<FormState>) => setForm((current) => ({ ...current, ...patch }));

  const openForm = (product: Product | null) => {
    setEditing(product);
    setForm(product ? toFormState(product) : EMPTY_FORM);
    setErrors({});
    setDialog('form');
  };

  const openDialog = (product: Product, mode: 'stock' | 'moves') => {
    setEditing(product);
    setDialog(mode);
  };

  const rowActions = (product: Product) => (
    <div className="row">
      <Button size="sm" variant="secondary" onClick={() => openForm(product)}>
        Editar
      </Button>
      <Button
        size="sm"
        variant="secondary"
        disabled={product.kind === 'SERVICE'}
        onClick={() => openDialog(product, 'stock')}
      >
        Stock
      </Button>
      <Button size="sm" variant="ghost" onClick={() => openDialog(product, 'moves')}>
        Movimientos
      </Button>
    </div>
  );

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const description = form.description.trim();
    const imageUrl = form.imageUrl.trim();
    const stock = form.kind === 'PRODUCT' && form.stock.trim() !== '' ? Number(form.stock) : undefined;
    const minutes = form.durationMinutes.trim();
    const duration = form.kind === 'SERVICE' && minutes !== '' ? Number(minutes) : undefined;
    setSaving(true);
    try {
      if (editing) {
        // UpdateProductDto no admite sku, kind ni currency: se envían solo los campos aceptados.
        const changes: Partial<ProductInput> = {
          name: form.name.trim(),
          price: Number(form.price),
          categoryId: form.categoryId,
          isActive: form.isActive,
        };
        if (description !== '') changes.description = description;
        if (imageUrl !== '') changes.imageUrl = imageUrl;
        if (stock !== undefined) changes.stock = stock;
        if (duration !== undefined) changes.durationMinutes = duration;
        await catalog.updateProduct(editing.id, changes);
        notify('Producto actualizado.', 'success');
      } else {
        const body: ProductInput = {
          name: form.name.trim(),
          sku: form.sku.trim().toUpperCase(),
          price: Number(form.price),
          kind: form.kind,
          categoryId: form.categoryId,
          isActive: form.isActive,
        };
        if (description !== '') body.description = description;
        if (imageUrl !== '') body.imageUrl = imageUrl;
        if (stock !== undefined) body.stock = stock;
        if (duration !== undefined) body.durationMinutes = duration;
        await catalog.createProduct(body);
        notify('Producto creado.', 'success');
      }
      setDialog(null);
      list.reload();
    } catch (cause) {
      notify(failure(cause, 'No fue posible guardar el producto.'), 'danger');
    } finally {
      setSaving(false);
    }
  };

  const applyFilters = (event: FormEvent) => {
    event.preventDefault();
    setPage(1);
    setSearch(searchDraft.trim());
  };

  const clearFilters = () => {
    setSearchDraft('');
    setSearch('');
    setCategoryId('');
    setKind('');
    setIncludeInactive(false);
    setPage(1);
  };

  const stockCell = (product: Product) => {
    if (product.kind === 'SERVICE') return `${product.durationMinutes ?? 0} min`;
    return product.stock ?? 0;
  };

  const afterStock = () => {
    setDialog(null);
    list.reload();
  };

  const productRows = (list.data?.items ?? []).map((product) => ({
    key: product.id,
    cells: [
      product.name,
      mutedText(product.sku),
      product.category.name,
      kindBadge(product.kind),
      formatMoney(product.price, product.currency),
      stockCell(product),
      activeBadge(product.isActive),
      rowActions(product),
    ],
  }));

  const newProductButton = (
    <Button onClick={() => openForm(null)} disabled={categoryList.length === 0}>Nuevo producto</Button>
  );

  const closeDialog = () => setDialog(null);

  return (
    <div className="stack">
      <PageHeader title="Productos y categorías"
        subtitle="RF-12 y RF-13 · Inventario, servicios y niveles de existencias."
        actions={newProductButton}
      />

      <Card tight>
        <form className="row" onSubmit={applyFilters}>
          <TextField id="p-search" label="Buscar" value={searchDraft} maxLength={80}
            placeholder="Nombre o SKU" onChange={setSearchDraft}
          />
          <ChoiceField id="p-category-filter" label="Categoría" value={categoryId}
            options={categoryOptions} onChange={(value) => { setCategoryId(value); setPage(1); }}
          />
          <ChoiceField id="p-kind-filter" label="Tipo" value={kind} options={KIND_FILTER_OPTIONS}
            onChange={(value) => { setKind(value as '' | ProductKind); setPage(1); }}
          />
          <Check id="p-include-inactive" label="Incluir inactivos" checked={includeInactive}
            onChange={(value) => { setIncludeInactive(value); setPage(1); }}
          />
          <Button type="submit" variant="secondary">Aplicar</Button>
          <Button type="button" variant="ghost" onClick={clearFilters}>Limpiar</Button>
        </form>
      </Card>

      <Card>
        {list.loading ? <Loading rows={5} /> : null}
        {list.error ? <ErrorState message={list.error} onRetry={list.reload} /> : null}
        {list.data && list.data.items.length === 0 ? (
          <EmptyState title="Sin resultados"
            description="Ajusta los filtros o crea el primer producto del catálogo."
            action={newProductButton}
          />
        ) : null}
        {list.data && list.data.items.length > 0 ? (
          <>
            <Table head={PRODUCT_HEAD} rows={productRows} />
            <Pager page={list.data.page} totalPages={list.data.totalPages}
              onChange={setPage} label="productos"
            />
          </>
        ) : null}
      </Card>

      <CategoriesPanel categories={categoryList} loading={categories.loading}
        error={categories.error} onReload={categories.reload}
      />

      {dialog === 'form' ? (
        <ProductFormDialog editing={editing} form={form} errors={errors} saving={saving}
          categoryOptions={categoryOptions} onField={set} onSubmit={save} onClose={closeDialog}
        />
      ) : null}

      {target && dialog === 'stock' ? (
        <StockDialog product={target} onClose={closeDialog} onSaved={afterStock} />
      ) : null}

      {target && dialog === 'moves' ? (
        <MovementsDialog product={target} onClose={closeDialog} />
      ) : null}
    </div>
  );
}
