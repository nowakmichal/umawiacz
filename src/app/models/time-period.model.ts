export type SelectionColor = 'green' | 'orange' | 'red';

export interface ColorOption {
  value: SelectionColor;
  label: string;
  hex: string;
}

export const SELECTION_COLORS: ColorOption[] = [
  { value: 'green', label: 'Zielony', hex: '#22c55e' },
  { value: 'orange', label: 'Pomarańczowy', hex: '#f97316' },
  { value: 'red', label: 'Czerwony', hex: '#ef4444' },
];

export interface TimePeriod {
  id: string;
  eventId: string;
  start: string; // ISO date YYYY-MM-DD
  end: string; // ISO date YYYY-MM-DD
  color: SelectionColor;
  userName: string;
}

export interface CreateTimePeriodRequest {
  start: string;
  end: string;
  color: SelectionColor;
  userName: string;
}

export interface CreateTimePeriodResponse {
  id: string;
  start: string;
  end: string;
  color: SelectionColor;
  userName: string;
}
