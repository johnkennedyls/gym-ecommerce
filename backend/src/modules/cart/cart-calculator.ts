export type LineInput = {
  unitPrice: number;
  quantity: number;
};

export type CartTotals = {
  subtotal: number;
  total: number;
  units: number;
};

const round = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

/**
 * Cálculo determinista de totales del carrito (RF-06 / RF-07).
 * Se mantiene como función pura para poder probarla sin base de datos (ISO/IEC 25010 mantenibilidad).
 */
export function calculateTotals(lines: LineInput[]): CartTotals {
  let subtotal = 0;
  let units = 0;

  for (const line of lines) {
    if (!Number.isFinite(line.unitPrice) || line.unitPrice < 0) {
      throw new Error('El precio unitario debe ser un número no negativo');
    }
    if (!Number.isInteger(line.quantity) || line.quantity < 1) {
      throw new Error('La cantidad debe ser un entero positivo');
    }
    subtotal = round(subtotal + round(line.unitPrice * line.quantity));
    units += line.quantity;
  }

  return { subtotal, total: subtotal, units };
}

export { round as roundMoney };
