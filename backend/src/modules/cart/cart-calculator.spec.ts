import { calculateTotals, roundMoney } from './cart-calculator';

describe('calculateTotals (RF-06 / RF-07)', () => {
  it('suma líneas y totaliza unidades', () => {
    const totals = calculateTotals([
      { unitPrice: 189_900, quantity: 2 },
      { unitPrice: 42_500.5, quantity: 3 },
    ]);

    expect(totals.subtotal).toBe(189_900 * 2 + roundMoney(42_500.5 * 3));
    expect(totals.total).toBe(totals.subtotal);
    expect(totals.units).toBe(5);
  });

  it('devuelve ceros cuando el carrito está vacío', () => {
    expect(calculateTotals([])).toEqual({ subtotal: 0, total: 0, units: 0 });
  });

  it('redondea a dos decimales evitando el error de punto flotante', () => {
    const totals = calculateTotals([
      { unitPrice: 0.1, quantity: 1 },
      { unitPrice: 0.2, quantity: 1 },
    ]);
    expect(totals.subtotal).toBe(0.3);
  });

  it('rechaza precios negativos (RNF-08 integridad)', () => {
    expect(() => calculateTotals([{ unitPrice: -1, quantity: 1 }])).toThrow(/no negativo/);
  });

  it('rechaza cantidades no enteras o menores a uno', () => {
    expect(() => calculateTotals([{ unitPrice: 10, quantity: 0 }])).toThrow(/entero positivo/);
    expect(() => calculateTotals([{ unitPrice: 10, quantity: 1.5 }])).toThrow(/entero positivo/);
  });
});
