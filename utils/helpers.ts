import { ItemStatus, TableStatus, UserRole } from '@/types';

export function formatCurrency(value: number | string | undefined): string {
  const num = Number(value) || 0;
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
}

export function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours}h`;
  return `há ${Math.floor(hours / 24)}d`;
}

export function getItemStatusLabel(status: ItemStatus): string {
  const labels: Record<ItemStatus, string> = {
    pendente: 'Pendente',
    recebido: 'Recebido',
    em_preparo: 'Em Preparo',
    pronto: 'Pronto',
    entregue: 'Entregue',
    cancelado: 'Cancelado',
  };
  return labels[status] || status;
}

export function getTableStatusLabel(status: TableStatus): string {
  const labels: Record<TableStatus, string> = {
    livre: 'Livre',
    ocupada: 'Ocupada',
    reservada: 'Reservada',
    fechando: 'Fechando',
  };
  return labels[status] || status;
}

export function getRoleLabel(role: UserRole): string {
  const labels: Record<UserRole, string> = {
    garcom: 'Garçom',
    administrador: 'Administrador',
    gerente: 'Gerente',
    cozinheiro: 'Cozinheiro',
  };
  return labels[role] || role;
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();
}
