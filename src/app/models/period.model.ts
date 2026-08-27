export type SelectionColor = 'green' | 'red';

export interface ColorOption {
  value: SelectionColor;
  label: string;
  hex: string;
}

export const SELECTION_COLORS: ColorOption[] = [
  { value: 'green', label: 'Wolny', hex: '#22c55e' },
  { value: 'red', label: 'Zajęty', hex: '#ef4444' },
];

export interface Period {
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
