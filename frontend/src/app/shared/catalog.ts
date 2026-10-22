/** Categorías de evento. `value` es lo que se guarda (compatible con los eventos ya cargados). */
export const CATEGORIES = [
  { value: 'Concert', label: 'Recitales', icon: '🎤' },
  { value: 'Party', label: 'Fiestas', icon: '🎉' },
  { value: 'Theater', label: 'Teatro', icon: '🎭' },
  { value: 'Sports', label: 'Deportes', icon: '⚽' },
  { value: 'Other', label: 'Otros', icon: '✨' },
];

export function categoryLabel(value?: string | null): string {
  return CATEGORIES.find(c => c.value === value)?.label ?? 'Evento';
}

/** Imagen de reemplazo cuando el evento no tiene foto. */
export const EVENT_PLACEHOLDER = '/placeholder-event.svg';
export const AVATAR_PLACEHOLDER = '/placeholder-avatar.svg';

/** Precio más bajo entre los lotes disponibles (para "Desde $ …"). */
export function minPrice(event: { batches?: { price: any; isManualSoldOut?: any; totalQuantity?: number; soldQuantity?: number }[] }): number | null {
  const prices = (event.batches ?? [])
    .filter(b => !b.isManualSoldOut && (b.totalQuantity ?? 0) > (b.soldQuantity ?? 0))
    .map(b => Number(b.price))
    .filter(p => Number.isFinite(p));
  return prices.length ? Math.min(...prices) : null;
}

export function isSoldOut(event: { batches?: any[] }): boolean {
  return (event.batches?.length ?? 0) > 0 && minPrice(event) === null;
}
