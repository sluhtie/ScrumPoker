export const DECKS = {
  fibonacci: {
    values: ['0', '1', '2', '3', '5', '8', '13', '21', '34', '?', '☕'],
  },
  modified: {
    values: [
      '0',
      '0.5',
      '1',
      '2',
      '3',
      '5',
      '8',
      '13',
      '20',
      '40',
      '100',
      '?',
      '☕',
    ],
  },
  powers: { values: ['0', '1', '2', '4', '8', '16', '32', '64', '?', '☕'] },
  sequential: {
    values: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '?', '☕'],
  },
  tshirt: { values: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '?', '☕'] },
};
export type Settings = {
  deck: keyof typeof DECKS | 'custom';
  customDeck?: string[];
  autoReveal: boolean;
  showAverage: boolean;
};
export const DEFAULT_SETTINGS: Settings = {
  deck: 'fibonacci',
  autoReveal: false,
  showAverage: true,
};
export const CUSTOM_DECK_START = ['1', '2', '3', '5', '8', '?', '☕'];
export function getDeck(settings: Settings): string[] {
  return settings.deck === 'custom'
    ? (settings.customDeck ?? [])
    : DECKS[settings.deck].values;
}
export const estimateValues = (settings: Settings) =>
  getDeck(settings).filter((v) => v !== '?' && v !== '☕');
export function isValidCustomDeck(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    value.length <= 16 &&
    value.every(
      (v) =>
        typeof v === 'string' &&
        v.trim().length > 0 &&
        Array.from(v.trim().normalize('NFC')).length <= 8 &&
        !/[\x00-\x1f\x7f,;]/.test(v),
    ) &&
    new Set(value.map((v) => v.trim().normalize('NFC'))).size ===
      value.length &&
    value.some((v) => v.trim() !== '?' && v.trim() !== '☕')
  );
}
export function deckChanged(a: Settings, b: Settings) {
  return (
    a.deck !== b.deck ||
    JSON.stringify(getDeck(a)) !== JSON.stringify(getDeck(b))
  );
}
export function numericCard(value: string): number | null {
  return /^-?\d+(\.\d+)?$/.test(value) && Number.isFinite(Number(value))
    ? Number(value)
    : null;
}
export const isNumericDeck = (settings: Settings) =>
  estimateValues(settings).length > 0 &&
  estimateValues(settings).every((v) => numericCard(v) !== null);
