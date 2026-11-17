import { Transform } from 'class-transformer';

/** Interpreta "true"/"1"/"yes" como verdadero; el resto como falso. Evita que "false" pase a true. */
export const ToBoolean = () =>
  Transform(({ value }) => {
    if (typeof value === 'boolean') return value;
    if (value === undefined || value === null || value === '') return undefined;
    return ['true', '1', 'yes', 'on'].includes(String(value).toLowerCase());
  });
