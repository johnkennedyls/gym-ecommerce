import { useState, type FormEvent } from 'react';
import { PageHeader } from '../../components/AppShell';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Loading,
  Option,
  Pager,
  Select,
} from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { users } from '../../lib/api';
import { formatDate, initials } from '../../lib/format';
import { ApiError } from '../../lib/session';
import { useResource } from '../../lib/useResource';
import type { PublicUser, Role } from '../../types/api';

const ROLE_KEYS: Role[] = ['CLIENT', 'STAFF', 'ADMIN'];

const ROLE_LABELS: Record<Role, string> = { CLIENT: 'Cliente', STAFF: 'Personal', ADMIN: 'Administrador' };

export function AdminUsersPage() {
  const { user } = useAuth();
  const { notify } = useToast();
  const [page, setPage] = useState(1);
  const [role, setRole] = useState<'' | Role>('');
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState('');

  const { data, loading, error, reload } = useResource(
    () =>
      users.list({
        page,
        limit: 15,
        role: role === '' ? undefined : role,
        search: search === '' ? undefined : search,
      }),
    [page, role, search],
  );

  const submitFilters = (event: FormEvent) => {
    event.preventDefault();
    setPage(1);
    setSearch(searchDraft.trim());
  };

  const resetFilters = () => {
    setSearchDraft('');
    setSearch('');
    setRole('');
    setPage(1);
  };

  const run = async (id: string, action: () => Promise<unknown>, message: string) => {
    setBusy(id);
    try {
      await action();
      notify(message, 'success');
      reload();
    } catch (cause) {
      notify(cause instanceof ApiError ? cause.message : 'No fue posible actualizar la cuenta.', 'danger');
    } finally {
      setBusy('');
    }
  };

  const changeRole = (target: PublicUser, next: Role) =>
    run(target.id, () => users.setRole(target.id, next), `Rol de ${target.email}: ${ROLE_LABELS[next]}.`);

  const toggleStatus = (target: PublicUser) => {
    if (target.isActive) {
      if (!window.confirm(`¿Desactivar la cuenta de ${target.email}? Sus sesiones activas dejarán de funcionar de inmediato.`)) return;
    }
    void run(
      target.id,
      () => users.setStatus(target.id, !target.isActive),
      target.isActive ? 'Cuenta desactivada.' : 'Cuenta reactivada.',
    );
  };

  return (
    <div className="stack">
      <PageHeader
        title="Usuarios y roles"
        subtitle="RNF-01 · Control de acceso: asignación de roles y activación de cuentas."
      />

      <Alert tone="info">
        Desactivar una cuenta invalida de inmediato sus sesiones activas: el usuario deberá autenticarse otra
        vez y perderá el acceso al panel mientras permanezca inactiva.
      </Alert>

      <Card tight>
        <form className="row" onSubmit={submitFilters}>
          <Field label="Buscar" htmlFor="u-search">
            <Input id="u-search" value={searchDraft} maxLength={80} placeholder="Nombre o correo" onChange={(event) => setSearchDraft(event.target.value)} />
          </Field>
          <Field label="Rol" htmlFor="u-filter-role">
            <Select id="u-filter-role" value={role} onChange={(event) => { setRole(event.target.value as '' | Role); setPage(1); }}>
              <Option value="">Todos</Option>
              {ROLE_KEYS.map((key) => (
                <Option key={key} value={key}>{ROLE_LABELS[key]}</Option>
              ))}
            </Select>
          </Field>
          <Button type="submit" variant="secondary">Aplicar</Button>
          <Button type="button" variant="ghost" onClick={resetFilters}>Limpiar</Button>
        </form>
      </Card>

      <Card>
        {loading ? <Loading rows={5} /> : null}
        {error ? <ErrorState message={error} onRetry={reload} /> : null}
        {data && data.items.length === 0 ? (
          <EmptyState title="Sin usuarios" description="Ninguna cuenta coincide con el filtro aplicado." />
        ) : null}
        {data && data.items.length > 0 ? (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Nombre</th>
                    <th scope="col">Correo</th>
                    <th scope="col">Rol</th>
                    <th scope="col">Estado</th>
                    <th scope="col">Registrado</th>
                    <th scope="col">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((account) => {
                    const isSelf = user?.id === account.id;
                    return (
                      <tr key={account.id}>
                        <td>
                          <div className="row" style={{ gap: 'var(--space-2)', flexWrap: 'nowrap' }}>
                            <Badge tone="accent">{initials(account.firstName, account.lastName)}</Badge>
                            <span>
                              {account.firstName} {account.lastName}
                            </span>
                          </div>
                        </td>
                        <td>{account.email}</td>
                        <td>
                          <Select
                            id={`role-${account.id}`}
                            aria-label={`Rol de ${account.firstName} ${account.lastName}`}
                            value={account.role}
                            disabled={isSelf || busy === account.id}
                            title={
                              isSelf ? 'No puedes cambiar tu propio rol' : `Rol actual: ${ROLE_LABELS[account.role]}`
                            }
                            onChange={(event) => changeRole(account, event.target.value as Role)}
                          >
                            {ROLE_KEYS.map((key) => (
                              <Option key={key} value={key}>
                                {ROLE_LABELS[key]}
                              </Option>
                            ))}
                          </Select>
                        </td>
                        <td>
                          <Badge tone={account.isActive ? 'success' : 'danger'}>
                            {account.isActive ? 'Activa' : 'Inactiva'}
                          </Badge>
                        </td>
                        <td>{formatDate(account.createdAt)}</td>
                        <td>
                          <Button
                            size="sm"
                            variant={account.isActive ? 'danger' : 'secondary'}
                            disabled={isSelf || busy === account.id}
                            title={isSelf ? 'No puedes desactivar tu propia cuenta' : undefined}
                            onClick={() => toggleStatus(account)}
                          >
                            {busy === account.id
                              ? 'Guardando…'
                              : account.isActive
                                ? 'Desactivar'
                                : 'Reactivar'}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pager page={data.page} totalPages={data.totalPages} onChange={setPage} label="usuarios" />
          </>
        ) : null}
      </Card>
    </div>
  );
}
