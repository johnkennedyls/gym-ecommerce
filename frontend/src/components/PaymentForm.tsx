import { useState } from 'react';
import { payments } from '../lib/api';
import { ApiError } from '../lib/session';
import { formatMoney } from '../lib/format';
import type { PaymentResult } from '../types/api';
import { Alert, Button, Field, Input } from './ui';

type CardForm = {
  number: string;
  holderName: string;
  expiryMonth: string;
  expiryYear: string;
  cvv: string;
};

const EMPTY: CardForm = { number: '', holderName: '', expiryMonth: '', expiryYear: '', cvv: '' };

const CURRENT_YEAR = new Date().getFullYear();

/**
 * Tarjeta de prueba del gateway sandbox del backend: termina en 0002 para ver un rechazo.
 * Se muestra en pantalla porque el entorno de desarrollo no usa una pasarela real.
 */
const DEMO_HINT =
  'Ambiente de pruebas: 4242 4242 4242 4242 se aprueba y cualquier tarjeta que termine en 0002 se rechaza.';

export function PaymentForm({
  orderId,
  amount,
  currency = 'COP',
  idempotencyKey,
  onPaid,
}: {
  orderId: string;
  amount: number;
  currency?: string;
  idempotencyKey?: string;
  onPaid: (result: PaymentResult) => void;
}) {
  const [form, setForm] = useState<CardForm>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const set = (key: keyof CardForm) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const month = Number(form.expiryMonth);
    const year = Number(form.expiryYear);
    if (month < 1 || month > 12) {
      setError('El mes de vencimiento debe estar entre 1 y 12.');
      return;
    }
    if (year < CURRENT_YEAR || year > 2099) {
      setError(`El año de vencimiento debe ser ${CURRENT_YEAR} o posterior.`);
      return;
    }

    setBusy(true);
    setError(undefined);
    try {
      const result = await payments.pay({
        orderId,
        idempotencyKey,
        card: {
          number: form.number,
          holderName: form.holderName,
          expiryMonth: month,
          expiryYear: year,
          cvv: form.cvv,
        },
      });
      onPaid(result);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'No fue posible procesar el pago.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="stack" onSubmit={submit}>
      <Alert tone="info">{DEMO_HINT}</Alert>
      <p className="tiny muted">
        Total a pagar: <strong>{formatMoney(amount, currency)}</strong>
      </p>

      <Field label="Número de tarjeta" htmlFor="card-number" hint="13 a 24 dígitos, con espacios o guiones.">
        <Input
          id="card-number"
          name="cardnumber"
          inputMode="numeric"
          autoComplete="cc-number"
          placeholder="4242 4242 4242 4242"
          required
          value={form.number}
          onChange={set('number')}
        />
      </Field>

      <Field label="Titular" htmlFor="card-holder" hint="Nombre tal como aparece en la tarjeta.">
        <Input
          id="card-holder"
          name="cardname"
          autoComplete="cc-name"
          minLength={3}
          maxLength={80}
          required
          value={form.holderName}
          onChange={set('holderName')}
        />
      </Field>

      <div className="form-grid">
        <Field label="Mes" htmlFor="card-month">
          <Input
            id="card-month"
            name="cardexpmonth"
            inputMode="numeric"
            min="1"
            max="12"
            type="number"
            required
            value={form.expiryMonth}
            onChange={set('expiryMonth')}
          />
        </Field>
        <Field label="Año" htmlFor="card-year">
          <Input
            id="card-year"
            name="cardexpyear"
            inputMode="numeric"
            min={CURRENT_YEAR}
            max="2099"
            type="number"
            required
            value={form.expiryYear}
            onChange={set('expiryYear')}
          />
        </Field>
        <Field label="CVV" htmlFor="card-cvv">
          <Input
            id="card-cvv"
            name="cardcvc"
            inputMode="numeric"
            autoComplete="cc-csc"
            pattern="\d{3,4}"
            required
            value={form.cvv}
            onChange={set('cvv')}
          />
        </Field>
      </div>

      {error ? <Alert tone="danger">{error}</Alert> : null}

      <Button type="submit" disabled={busy}>
        {busy ? 'Procesando pago…' : `Pagar ${formatMoney(amount, currency)}`}
      </Button>
    </form>
  );
}
