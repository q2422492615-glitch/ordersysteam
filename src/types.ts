export type ViewType = 'dashboard' | 'calendar' | 'rooms' | 'menu';
export type Period = 'lunch' | 'dinner';

export interface Dish {
  id: string;
  name: string;
  price: number;
  category: string;
  tags: string[];
}

export interface CategoryProportion {
  category: string;
  percentage: number;
}

export interface Reservation {
  id: string;
  roomId: string;
  customerName: string;
  phone: string;
  pax: number;
  standardPrice: number; // Price per person
  totalPrice: number;
  period: Period;
  date: string; // YYYY-MM-DD
  notes: string;
  status: 'pending' | 'checked-in' | 'cancelled';
  menu?: Dish[];
}

export interface Room {
  id: string;
  name: string;
  capacity: number;
}

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}
