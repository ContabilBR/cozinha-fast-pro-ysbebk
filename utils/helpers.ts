import { ItemStatus, TableStatus, UserRole, PedidoStatus, Mesa } from '@/types';

export function formatCurrency(value: number | string | undefined): string {
  const num = Number(value) || 0;
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
}

export function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
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

export function formatElapsed(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}min`;
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

export function getPedidoStatusLabel(status: PedidoStatus): string {
  const labels: Record<PedidoStatus, string> = {
    pendente: 'Pendente',
    recebido: 'Recebido',
    em_preparacao: 'Em Preparo',
    pronto: 'Pronto',
    entregue: 'Entregue',
    cancelado: 'Cancelado',
  };
  return labels[status] || status;
}

export function getPedidoStatusColor(status: PedidoStatus): string {
  const map: Record<PedidoStatus, string> = {
    pendente: '#94A3B8',
    recebido: '#3B82F6',
    em_preparacao: '#F59E0B',
    pronto: '#22C55E',
    entregue: '#0D9488',
    cancelado: '#EF4444',
  };
  return map[status] || '#94A3B8';
}

export function getMesaStatusLabel(status: Mesa['status']): string {
  const labels: Record<Mesa['status'], string> = {
    livre: 'Livre',
    ocupada: 'Ocupada',
    aguardando_pedido: 'Aguardando',
    em_preparacao: 'Em Preparo',
    pedido_pronto: 'Pronto',
    finalizada: 'Finalizada',
  };
  return labels[status] || status;
}

export function getMesaStatusColor(status: Mesa['status']): string {
  const map: Record<Mesa['status'], string> = {
    livre: '#22C55E',
    ocupada: '#E8521A',
    aguardando_pedido: '#F59E0B',
    em_preparacao: '#3B82F6',
    pedido_pronto: '#8B5CF6',
    finalizada: '#94A3B8',
  };
  return map[status] || '#94A3B8';
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

export function isAdmin(role: UserRole): boolean {
  return role === 'gerente' || role === 'administrador';
}
