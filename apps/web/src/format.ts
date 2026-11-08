import { PaymentMethod, RideStatus } from './types';

const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export function money(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function distanceLabel(kilometers: number): string {
  return `${kilometers.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km`;
}

export function whenLabel(iso: string): string {
  const date = new Date(iso);
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${day}/${months[date.getMonth()]}, ${hour}:${minute}`;
}

export function paymentLabel(method: PaymentMethod): string {
  if (method === 'debit_card') {
    return 'Cartão de débito';
  }
  if (method === 'cash') {
    return 'Dinheiro';
  }
  return 'Cartão de crédito';
}

export function paymentMark(method: PaymentMethod): string {
  if (method === 'debit_card') {
    return 'CD';
  }
  if (method === 'cash') {
    return '$';
  }
  return 'CC';
}

export function statusLabel(status: RideStatus): string {
  if (status === 'REQUESTED') {
    return 'Procurando taxista';
  }
  if (status === 'ACCEPTED') {
    return 'Taxista a caminho';
  }
  if (status === 'IN_PROGRESS') {
    return 'Corrida em andamento';
  }
  if (status === 'CANCELLED') {
    return 'Cancelada';
  }
  return 'Finalizada';
}

export const paymentCycle: PaymentMethod[] = ['credit_card', 'debit_card', 'cash'];
