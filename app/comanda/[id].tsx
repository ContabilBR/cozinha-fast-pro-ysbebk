import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiGet, apiPost } from '@/utils/api';
import { useAuth } from '@/contexts/AuthContext';
import { useColors } from '@/hooks/useColors';

type Prato = {
  id: string;
  nome: string;
  descricao?: string;
  preco: number | string;
  imagem_url?: string;
  disponivel?: boolean;
  categoria?: { id?: string; nome: string };
  categoria_id?: string;
};

type StagedItem = {
  pratoId: string;
  pratoNome: string;
  pratoPreco: number;
  quantidade: number;
  observacao: string;
};

type Pedido = {
  id: string;
  comanda_id: string;
  prato_id: string;
  quantidade: number;
  preco_unitario: number | string;
  observacao?: string;
  status: string;
};

type Comanda = {
  id: string;
  mesa_id: string;
  mesa_numero: number;
  mesa_capacidade?: number;
  status: string;
  total: number | string;
};

// Brazilian currency formatter: 1234.5 → "R$ 1.234,50"
function formatBRL(value: number): string {
  const fixed = value.toFixed(2);
  const [intPart, decPart] = fixed.split('.');
  const intFormatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `R$ ${intFormatted},${decPart}`;
}

// ─── Fechar Comanda Modal ────────────────────────────────────────────────────

type FechamentoModalProps = {
  visible: boolean;
  onClose: () => void;
  onSuccess: (result: any) => void;
  comandaId: string;
  subtotal: number;
  mesaCapacidade?: number;
};

function FechamentoModal({
  visible,
  onClose,
  onSuccess,
  comandaId,
  subtotal,
  mesaCapacidade,
}: FechamentoModalProps) {
  const insets = useSafeAreaInsets();

  const [tipMode, setTipMode] = useState<'none' | '10' | 'custom'>('none');
  const [gorjetaInput, setGorjetaInput] = useState('0');
  const [numPessoasInput, setNumPessoasInput] = useState(
    String(mesaCapacidade && mesaCapacidade > 0 ? mesaCapacidade : 1)
  );
  const [confirming, setConfirming] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setTipMode('none');
      setGorjetaInput('0');
      setNumPessoasInput(String(mesaCapacidade && mesaCapacidade > 0 ? mesaCapacidade : 1));
      setConfirming(false);
    }
  }, [visible, mesaCapacidade]);

  const gorjetaValue = Math.max(0, parseFloat(gorjetaInput.replace(',', '.')) || 0);
  const numPessoas = Math.max(1, parseInt(numPessoasInput, 10) || 1);
  const totalFinal = subtotal + gorjetaValue;
  const valorPorPessoa = numPessoas > 0 ? totalFinal / numPessoas : totalFinal;

  const subtotalDisplay = formatBRL(subtotal);
  const gorjetaDisplay = formatBRL(gorjetaValue);
  const totalDisplay = formatBRL(totalFinal);
  const porPessoaDisplay = formatBRL(valorPorPessoa);

  const handleSelectNone = () => {
    console.log('[FechamentoModal] gorjeta mode selected: none');
    setTipMode('none');
    setGorjetaInput('0');
  };

  const handleSelect10 = () => {
    console.log('[FechamentoModal] gorjeta mode selected: 10%');
    const tip10 = subtotal * 0.1;
    setTipMode('10');
    setGorjetaInput(tip10.toFixed(2).replace('.', ','));
  };

  const handleGorjetaChange = (text: string) => {
    setTipMode('custom');
    // Allow digits, comma and dot
    const cleaned = text.replace(/[^0-9.,]/g, '');
    setGorjetaInput(cleaned);
  };

  const handleConfirm = async () => {
    console.log('[FechamentoModal] Confirmar Fechamento pressed', {
      comandaId,
      gorjeta: gorjetaValue,
      num_pessoas: numPessoas,
    });
    setConfirming(true);
    try {
      console.log(`[FechamentoModal] POST /api/comandas/${comandaId}/fechar`, {
        gorjeta: gorjetaValue,
        num_pessoas: numPessoas,
      });
      const res = await apiPost(`/api/comandas/${comandaId}/fechar`, {
        gorjeta: gorjetaValue,
        num_pessoas: numPessoas,
      });
      console.log('[FechamentoModal] fechar response:', JSON.stringify(res));
      onSuccess(res);
    } catch (e: any) {
      console.error('[FechamentoModal] fechar error:', e?.message);
      Alert.alert('Erro', e?.message || 'Não foi possível fechar a comanda. Tente novamente.');
    } finally {
      setConfirming(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <Pressable style={modalStyles.backdrop} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={modalStyles.kvWrapper}
        pointerEvents="box-none"
      >
        <View style={[modalStyles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          {/* Handle */}
          <View style={modalStyles.handle} />

          {/* Header */}
          <View style={modalStyles.sheetHeader}>
            <Text style={modalStyles.sheetTitle}>Fechar Comanda</Text>
            <Pressable onPress={() => { console.log('[FechamentoModal] close pressed'); onClose(); }} hitSlop={8}>
              <Ionicons name="close" size={24} color="#6b7280" />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Resumo */}
            <View style={modalStyles.section}>
              <Text style={modalStyles.sectionLabel}>Resumo da conta</Text>
              <View style={modalStyles.summaryRow}>
                <Text style={modalStyles.summaryKey}>Subtotal</Text>
                <Text style={modalStyles.summaryVal}>{subtotalDisplay}</Text>
              </View>
            </View>

            <View style={modalStyles.divider} />

            {/* Gorjeta */}
            <View style={modalStyles.section}>
              <Text style={modalStyles.sectionLabel}>Gorjeta</Text>
              <View style={modalStyles.tipBtnRow}>
                <Pressable
                  style={[modalStyles.tipBtn, tipMode === 'none' && modalStyles.tipBtnActive]}
                  onPress={handleSelectNone}
                >
                  <Text style={[modalStyles.tipBtnText, tipMode === 'none' && modalStyles.tipBtnTextActive]}>
                    Sem gorjeta
                  </Text>
                </Pressable>
                <Pressable
                  style={[modalStyles.tipBtn, tipMode === '10' && modalStyles.tipBtnActive]}
                  onPress={handleSelect10}
                >
                  <Text style={[modalStyles.tipBtnText, tipMode === '10' && modalStyles.tipBtnTextActive]}>
                    10%
                  </Text>
                </Pressable>
              </View>
              <Text style={modalStyles.inputLabel}>Outro valor (R$)</Text>
              <TextInput
                style={modalStyles.input}
                value={gorjetaInput}
                onChangeText={handleGorjetaChange}
                keyboardType="decimal-pad"
                placeholder="0,00"
                placeholderTextColor="#9ca3af"
                selectTextOnFocus
              />
              <View style={modalStyles.summaryRow}>
                <Text style={modalStyles.summaryKey}>Gorjeta</Text>
                <Text style={[modalStyles.summaryVal, { color: '#f59e0b' }]}>{gorjetaDisplay}</Text>
              </View>
            </View>

            <View style={modalStyles.divider} />

            {/* Número de pessoas */}
            <View style={modalStyles.section}>
              <Text style={modalStyles.sectionLabel}>Divisão da conta</Text>
              <Text style={modalStyles.inputLabel}>Nº de pessoas</Text>
              <TextInput
                style={[modalStyles.input, { width: 100 }]}
                value={numPessoasInput}
                onChangeText={(t) => {
                  console.log('[FechamentoModal] num_pessoas changed:', t);
                  setNumPessoasInput(t.replace(/[^0-9]/g, ''));
                }}
                keyboardType="number-pad"
                placeholder="1"
                placeholderTextColor="#9ca3af"
                selectTextOnFocus
              />
              <View style={modalStyles.summaryRow}>
                <Text style={modalStyles.summaryKey}>Valor por pessoa</Text>
                <Text style={[modalStyles.summaryVal, { color: '#007AFF' }]}>{porPessoaDisplay}</Text>
              </View>
            </View>

            <View style={modalStyles.divider} />

            {/* Total final */}
            <View style={[modalStyles.section, modalStyles.totalSection]}>
              <Text style={modalStyles.totalLabel}>Total Final</Text>
              <Text style={modalStyles.totalValue}>{totalDisplay}</Text>
            </View>

            {/* Buttons */}
            <View style={modalStyles.btnRow}>
              <Pressable
                style={modalStyles.cancelBtn}
                onPress={() => { console.log('[FechamentoModal] Cancelar pressed'); onClose(); }}
              >
                <Text style={modalStyles.cancelBtnText}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={[modalStyles.confirmBtn, confirming && modalStyles.confirmBtnDisabled]}
                onPress={handleConfirm}
                disabled={confirming}
              >
                {confirming ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={modalStyles.confirmBtnText}>Confirmar Fechamento</Text>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function ComandaDetailScreen() {
  const { id, mesa_numero: mesaNumeroParam, mesa_id: mesaIdParam } = useLocalSearchParams<{ id: string; mesa_numero?: string; mesa_id?: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const isManager = user?.role === 'gerente' || user?.role === 'admin' || user?.role === 'administrador';

  const COLORS = useColors();
  const [comanda, setComanda] = useState<Comanda | null>(null);
  const [pratos, setPratos] = useState<Prato[]>([]);
  const [pedidosEnviados, setPedidosEnviados] = useState<Pedido[]>([]);
  const [stagedItems, setStagedItems] = useState<StagedItem[]>([]);
  const [activeTab, setActiveTab] = useState<'cardapio' | 'pedido'>('cardapio');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [fechamentoVisible, setFechamentoVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');

  // Resolved mesa number — seeded immediately from route param so the title
  // shows the correct number even before the API call completes.
  const seedNum = mesaNumeroParam ? Number(mesaNumeroParam) : null;
  const [mesaNumero, setMesaNumero] = useState<number | null>(
    seedNum != null && !isNaN(seedNum) ? seedNum : null
  );

  const fetchData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      console.log('[ComandaDetail] GET /api/comandas/' + id);
      const [comandaRes, pratosRes, pedidosRes] = await Promise.all([
        apiGet<any>(`/api/comandas/${id}`),
        apiGet<any>('/api/pratos'),
        apiGet<any>('/api/pedidos'),
      ]);

      // Support both direct object and wrapped { comanda: ... }
      const raw: any = comandaRes?.id ? comandaRes : comandaRes?.comanda ?? null;
      console.log('[ComandaDetail] comanda raw response:', JSON.stringify(comandaRes));

      // Attempt 1: field directly on the comanda object
      let resolvedMesaNumero: number | undefined =
        raw?.mesa_numero != null ? Number(raw.mesa_numero) :
        raw?.mesa?.numero != null ? Number(raw.mesa?.numero) :
        mesaNumeroParam ? Number(mesaNumeroParam) :
        undefined;

      // Determine the best mesa_id to use for fallback lookups
      const fallbackMesaId = raw?.mesa_id ?? mesaIdParam ?? null;

      // Attempt 2: if still missing and we have mesa_id, fetch the mesa directly
      if ((resolvedMesaNumero === undefined || isNaN(resolvedMesaNumero)) && fallbackMesaId) {
        console.log('[ComandaDetail] mesa_numero missing — fetching GET /api/mesas/' + fallbackMesaId);
        try {
          const mesaRes = await apiGet<any>(`/api/mesas/${fallbackMesaId}`);
          const mesaRaw: any = mesaRes?.mesa ?? mesaRes;
          const num = mesaRaw?.numero ?? mesaRaw?.mesa_numero;
          if (num != null) {
            resolvedMesaNumero = Number(num);
            console.log('[ComandaDetail] mesa_numero resolved from /api/mesas/:id:', resolvedMesaNumero);
          }
        } catch (mesaErr) {
          console.warn('[ComandaDetail] Could not fetch mesa for mesa_numero:', mesaErr);
        }
      }

      // Attempt 3: scan /api/mesas list as last resort
      if ((resolvedMesaNumero === undefined || isNaN(resolvedMesaNumero)) && fallbackMesaId) {
        console.log('[ComandaDetail] mesa_numero still missing — scanning GET /api/mesas');
        try {
          const mesasRes = await apiGet<any>('/api/mesas');
          const mesasList: any[] = Array.isArray(mesasRes) ? mesasRes : mesasRes?.mesas ?? [];
          const found = mesasList.find((m: any) => String(m.id) === String(fallbackMesaId));
          if (found?.numero != null) {
            resolvedMesaNumero = Number(found.numero);
            console.log('[ComandaDetail] mesa_numero resolved from /api/mesas list:', resolvedMesaNumero);
          }
        } catch (listErr) {
          console.warn('[ComandaDetail] Could not scan mesas list:', listErr);
        }
      }

      const found: Comanda | null = raw
        ? { ...raw, mesa_numero: resolvedMesaNumero }
        : null;

      console.log('[ComandaDetail] comanda loaded:', found?.id, 'mesa_numero:', found?.mesa_numero, '(raw mesa_numero:', raw?.mesa_numero, ', mesa.numero:', raw?.mesa?.numero, ', param:', mesaNumeroParam, ')');
      setComanda(found);
      if (resolvedMesaNumero != null && !isNaN(resolvedMesaNumero)) {
        setMesaNumero(resolvedMesaNumero);
      }

      const allPratos: Prato[] = Array.isArray(pratosRes)
        ? pratosRes
        : pratosRes?.pratos ?? [];
      setPratos(allPratos.filter((p) => p.disponivel !== false));

      const allPedidos: Pedido[] = Array.isArray(pedidosRes)
        ? pedidosRes
        : pedidosRes?.pedidos ?? [];
      setPedidosEnviados(allPedidos.filter((p) => p.comanda_id === id));
    } catch (e: any) {
      setError('Não foi possível carregar a comanda.');
    } finally {
      setLoading(false);
    }
  }, [id, mesaNumeroParam, mesaIdParam]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const addToStaging = (prato: Prato) => {
    console.log('[ComandaDetail] addToStaging pressed', { pratoId: prato.id, pratoNome: prato.nome });
    setStagedItems((prev) => {
      const existing = prev.find((i) => i.pratoId === prato.id);
      if (existing) {
        return prev.map((i) =>
          i.pratoId === prato.id ? { ...i, quantidade: i.quantidade + 1 } : i
        );
      }
      return [
        ...prev,
        {
          pratoId: prato.id,
          pratoNome: prato.nome,
          pratoPreco: Number(prato.preco),
          quantidade: 1,
          observacao: '',
        },
      ];
    });
  };

  const increaseQty = (pratoId: string) =>
    setStagedItems((prev) =>
      prev.map((i) => (i.pratoId === pratoId ? { ...i, quantidade: i.quantidade + 1 } : i))
    );

  const decreaseQty = (pratoId: string) =>
    setStagedItems((prev) => {
      const item = prev.find((i) => i.pratoId === pratoId);
      if (!item) return prev;
      if (item.quantidade <= 1) return prev.filter((i) => i.pratoId !== pratoId);
      return prev.map((i) =>
        i.pratoId === pratoId ? { ...i, quantidade: i.quantidade - 1 } : i
      );
    });

  const removeFromStaging = (pratoId: string) =>
    setStagedItems((prev) => prev.filter((i) => i.pratoId !== pratoId));

  const updateObservacao = (pratoId: string, text: string) =>
    setStagedItems((prev) =>
      prev.map((i) => (i.pratoId === pratoId ? { ...i, observacao: text } : i))
    );

  const handleEnviarPedido = async () => {
    if (stagedItems.length === 0 || !id) return;
    console.log('[ComandaDetail] handleEnviarPedido pressed', { comandaId: id, itemCount: stagedItems.length });
    setSending(true);
    try {
      console.log('[ComandaDetail] POST /api/pedidos (batch)', stagedItems.length, 'items');
      await Promise.all(
        stagedItems.map((item) =>
          apiPost('/api/pedidos', {
            comanda_id: id,
            prato_id: item.pratoId,
            quantidade: item.quantidade,
            preco_unitario: item.pratoPreco,
            observacao: item.observacao || null,
            status: 'pendente',
          })
        )
      );
      setStagedItems([]);
      console.log('[ComandaDetail] GET /api/pedidos (refresh after send)');
      const pedidosRes = await apiGet<any>('/api/pedidos');
      const allPedidos: Pedido[] = Array.isArray(pedidosRes)
        ? pedidosRes
        : pedidosRes?.pedidos ?? [];
      setPedidosEnviados(allPedidos.filter((p) => p.comanda_id === id));
      Alert.alert('Sucesso', 'Pedido enviado para a cozinha!');
      setActiveTab('pedido');
    } catch (e: any) {
      Alert.alert('Erro', 'Não foi possível enviar o pedido. Tente novamente.');
    } finally {
      setSending(false);
    }
  };

  const handleFecharComanda = () => {
    console.log('[ComandaDetail] Fechar Comanda button pressed', { comandaId: id });
    setFechamentoVisible(true);
  };

  const handleFechamentoSuccess = (result: any) => {
    console.log('[ComandaDetail] fechamento success — navigating to comprovante', result);
    setFechamentoVisible(false);
    router.replace({
      pathname: '/comanda/comprovante',
      params: {
        mesa_numero: String(result?.mesa_numero ?? ''),
        subtotal: String(result?.subtotal ?? 0),
        gorjeta: String(result?.gorjeta ?? 0),
        total_final: String(result?.total_final ?? 0),
        num_pessoas: String(result?.num_pessoas ?? 1),
        valor_por_pessoa: String(result?.valor_por_pessoa ?? 0),
        created_at: result?.created_at ?? '',
        closed_at: result?.closed_at ?? '',
        itens: JSON.stringify(result?.itens ?? []),
      },
    });
  };

  const formatPrice = (price: number | string) =>
    `R$ ${Number(price).toFixed(2).replace('.', ',')}`;

  const statusColor = (status: string) => {
    switch (status) {
      case 'pendente': return '#f59e0b';
      case 'em_preparo': return '#f97316';
      case 'pronto': return '#22c55e';
      case 'entregue': return '#9ca3af';
      default: return '#6b7280';
    }
  };

  const total = pedidosEnviados.reduce(
    (sum, p) => sum + p.quantidade * Number(p.preco_unitario),
    0
  );
  const totalDisplay = `R$ ${total.toFixed(2).replace(".", ",")}`;
  console.log("[ComandaDetail] total calculado:", totalDisplay, "— pedidos:", pedidosEnviados.length);

  const mesaNum = mesaNumero ?? '?';
  const headerTitle = `Comanda — Mesa ${mesaNum}`;

  const canFechar = comanda?.status === 'aberta' && pedidosEnviados.length > 0;

  const pratoCategories = useMemo(() => {
    const names = new Set<string>();
    pratos.forEach((p) => {
      if (p.categoria?.nome) names.add(p.categoria.nome);
    });
    return ['Todos', ...Array.from(names).sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }))];
  }, [pratos]);

  const filteredPratos = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return pratos.filter((p) => {
      const matchesSearch = !q || p.nome.toLowerCase().includes(q);
      const matchesCategory =
        selectedCategory === 'Todos' ||
        (p.categoria?.nome ?? '') === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [pratos, searchQuery, selectedCategory]);

  // Always use the live computed total from pedidosEnviados — comanda.total in the DB
  // is only updated on close and does not reflect newly added orders.
  const subtotalForModal = total;

  const NavBar = ({ title }: { title: string }) => (
    <View style={styles.navBar}>
      <Pressable onPress={() => { console.log('[ComandaDetail] back pressed'); router.back(); }} style={styles.backBtn}>
        <Ionicons name="arrow-back" size={22} color="#007AFF" />
        <Text style={styles.backText}>Voltar</Text>
      </Pressable>
      <Text style={styles.navTitle} numberOfLines={1}>{title}</Text>
      {canFechar ? (
        <Pressable onPress={handleFecharComanda} style={styles.fecharHeaderBtn}>
          <Text style={styles.fecharHeaderBtnText}>Fechar</Text>
        </Pressable>
      ) : (
        <View style={{ width: 60 }} />
      )}
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.centered} edges={['top', 'left', 'right']}>
        <NavBar title={headerTitle} />
        <ActivityIndicator size="large" color="#007AFF" style={{ marginTop: 40 }} />
        <Text style={{ marginTop: 12, color: '#6b7280' }}>Carregando...</Text>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.centered} edges={['top', 'left', 'right']}>
        <NavBar title={headerTitle} />
        <Text style={{ color: '#ef4444', marginTop: 40, marginBottom: 16, textAlign: 'center' }}>{error}</Text>
        <Pressable onPress={fetchData} style={styles.retryBtn}>
          <Text style={{ color: 'white', fontWeight: '600' }}>Tentar novamente</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  // ─── Manager status helpers ────────────────────────────────────────────────

  const comandaStatusColor = (status: string) => {
    switch (status) {
      case 'aberta': return '#22c55e';
      case 'fechada': return '#9ca3af';
      case 'cancelada': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const comandaStatusLabel = (status: string) => {
    switch (status) {
      case 'aberta': return 'Aberta';
      case 'fechada': return 'Fechada';
      case 'cancelada': return 'Cancelada';
      default: return status;
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const rawComanda = comanda as any;
  const garcomNome: string = rawComanda?.garcom_nome ?? rawComanda?.garcom?.nome ?? '';
  const abertoEm: string = formatDate(rawComanda?.created_at ?? rawComanda?.aberto_em ?? rawComanda?.data_abertura);
  const comandaStatus: string = comanda?.status ?? '';
  const comandaStatusColorValue = comandaStatusColor(comandaStatus);
  const comandaStatusLabelValue = comandaStatusLabel(comandaStatus);

  // ─── Manager view ──────────────────────────────────────────────────────────

  if (isManager) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <NavBar title={headerTitle} />

        <ScrollView contentContainerStyle={mgStyles.scrollContent}>
          {/* Header card */}
          <View style={mgStyles.headerCard}>
            <View style={mgStyles.headerRow}>
              <View style={[mgStyles.statusBadge, { backgroundColor: comandaStatusColorValue }]}>
                <Text style={mgStyles.statusBadgeText}>{comandaStatusLabelValue}</Text>
              </View>
              <Text style={mgStyles.mesaLabel}>
                Mesa
              </Text>
              <Text style={mgStyles.mesaNumber}>
                {mesaNum}
              </Text>
            </View>

            <View style={mgStyles.metaRow}>
              <Ionicons name="time-outline" size={15} color="#6b7280" />
              <Text style={mgStyles.metaText}>
                Aberta em:
              </Text>
              <Text style={mgStyles.metaValue}>
                {abertoEm}
              </Text>
            </View>

            {garcomNome ? (
              <View style={mgStyles.metaRow}>
                <Ionicons name="person-outline" size={15} color="#6b7280" />
                <Text style={mgStyles.metaText}>
                  Garçom:
                </Text>
                <Text style={mgStyles.metaValue}>
                  {garcomNome}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Pedidos section */}
          <Text style={mgStyles.sectionTitle}>Pedidos</Text>

          {pedidosEnviados.length === 0 ? (
            <View style={mgStyles.emptyBox}>
              <Ionicons name="receipt-outline" size={40} color="#d1d5db" />
              <Text style={mgStyles.emptyText}>Nenhum pedido nesta comanda</Text>
            </View>
          ) : (
            pedidosEnviados.map((p) => {
              const pratoNome = pratos.find((pr) => pr.id === p.prato_id)?.nome ?? p.prato_id;
              const precoUnit = Number(p.preco_unitario);
              const precoUnitDisplay = formatBRL(precoUnit);
              const linhaPreco = `${p.quantidade} × ${precoUnitDisplay}`;
              const pedidoStatusColor = statusColor(p.status);
              const pedidoStatusLabel = p.status;
              return (
                <View key={p.id} style={mgStyles.pedidoCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={mgStyles.pedidoNome}>{pratoNome}</Text>
                    <Text style={mgStyles.pedidoQty}>{linhaPreco}</Text>
                    {p.observacao ? (
                      <Text style={mgStyles.pedidoObs}>{p.observacao}</Text>
                    ) : null}
                  </View>
                  <View style={[mgStyles.pedidoStatusBadge, { backgroundColor: pedidoStatusColor }]}>
                    <Text style={mgStyles.pedidoStatusText}>{pedidoStatusLabel}</Text>
                  </View>
                </View>
              );
            })
          )}

          {/* Spacer for fixed footer */}
          <View style={{ height: 120 }} />
        </ScrollView>

        {/* Fixed footer */}
        <View style={mgStyles.footer}>
          <View style={mgStyles.footerTotalRow}>
            <Text style={mgStyles.footerTotalLabel}>Total da comanda</Text>
            <Text style={mgStyles.footerTotalValue}>{totalDisplay}</Text>
          </View>

          {canFechar ? (
            <>
              <View style={{ paddingHorizontal: 0, marginBottom: 8 }}>
                <Pressable onPress={() => router.push({ pathname: "/comanda/fechar-conta", params: { id } })} style={{ backgroundColor: "#E8521A", borderRadius: 12, padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <Ionicons name="receipt-outline" size={20} color="white" />
                  <Text style={{ color: "white", fontSize: 16, fontWeight: "600" }}>Fechar conta</Text>
                </Pressable>
              </View>
            </>
          ) : null}
        </View>

        {/* Fechamento Modal */}
        <FechamentoModal
          visible={fechamentoVisible}
          onClose={() => { console.log('[ComandaDetail] fechamento modal closed'); setFechamentoVisible(false); }}
          onSuccess={handleFechamentoSuccess}
          comandaId={id ?? ''}
          subtotal={subtotalForModal}
          mesaCapacidade={comanda?.mesa_capacidade}
        />
      </SafeAreaView>
    );
  }

  // ─── Waiter view (unchanged) ───────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <NavBar title={headerTitle} />

      {/* Tab bar */}
      <View style={styles.tabBar}>
        <Pressable
          style={[styles.tab, activeTab === 'cardapio' && styles.tabActive]}
          onPress={() => { console.log('[ComandaDetail] tab pressed: cardapio'); setActiveTab('cardapio'); }}
        >
          <Text style={[styles.tabText, activeTab === 'cardapio' && styles.tabTextActive]}>
            Cardápio
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === 'pedido' && styles.tabActive]}
          onPress={() => { console.log('[ComandaDetail] tab pressed: pedido'); setActiveTab('pedido'); }}
        >
          <Text style={[styles.tabText, activeTab === 'pedido' && styles.tabTextActive]}>
            {stagedItems.length > 0 ? `Meu Pedido (${stagedItems.length})` : 'Meu Pedido'}
          </Text>
        </Pressable>
      </View>

      {/* Content area */}
      <View style={{ flex: 1 }}>
        {activeTab === 'cardapio' ? (
          <FlatList
            data={filteredPratos}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 12, paddingTop: 0 }}
            ListHeaderComponent={
              <View style={{ paddingTop: 12 }}>
                {/* Search field */}
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginBottom: 10,
                    backgroundColor: COLORS.surfaceSecondary,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: COLORS.border,
                    paddingHorizontal: 12,
                    paddingVertical: 9,
                    gap: 8,
                  }}
                >
                  <Ionicons name="search-outline" size={16} color={COLORS.textTertiary} />
                  <TextInput
                    value={searchQuery}
                    onChangeText={(text) => {
                      console.log('[ComandaDetail] Busca alterada:', text);
                      setSearchQuery(text);
                    }}
                    placeholder="Buscar prato..."
                    placeholderTextColor={COLORS.textTertiary}
                    style={{
                      flex: 1,
                      fontFamily: 'Outfit_400Regular',
                      fontSize: 14,
                      color: COLORS.text,
                      padding: 0,
                    }}
                    returnKeyType="search"
                    clearButtonMode="while-editing"
                  />
                </View>

                {/* Category filter chips */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingBottom: 10, gap: 8 }}
                >
                  {pratoCategories.map((cat) => {
                    const isSelected = selectedCategory === cat;
                    return (
                      <Pressable
                        key={cat}
                        onPress={() => {
                          console.log('[ComandaDetail] Categoria selecionada:', cat);
                          setSelectedCategory(cat);
                        }}
                        style={{
                          paddingHorizontal: 14,
                          paddingVertical: 7,
                          borderRadius: 20,
                          backgroundColor: isSelected ? COLORS.primary : COLORS.surfaceSecondary,
                          borderWidth: 1,
                          borderColor: isSelected ? COLORS.primary : COLORS.border,
                        }}
                      >
                        <Text
                          style={{
                            fontFamily: isSelected ? 'Outfit_600SemiBold' : 'Outfit_400Regular',
                            fontSize: 13,
                            color: isSelected ? '#fff' : COLORS.textSecondary,
                          }}
                        >
                          {cat}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            }
            renderItem={({ item }) => {
              const staged = stagedItems.find((s) => s.pratoId === item.id);
              return (
                <View style={styles.pratoCard}>
                  {item.imagem_url ? (
                    <Image
                      source={{ uri: item.imagem_url }}
                      style={styles.pratoImage}
                      contentFit="cover"
                    />
                  ) : (
                    <View style={styles.pratoImagePlaceholder}>
                      <Ionicons name="restaurant-outline" size={28} color="#9ca3af" />
                    </View>
                  )}
                  <View style={{ flex: 1, marginHorizontal: 10 }}>
                    <Text style={styles.pratoNome}>{item.nome}</Text>
                    {item.descricao ? (
                      <Text style={styles.pratoDesc} numberOfLines={2}>
                        {item.descricao}
                      </Text>
                    ) : null}
                    <Text style={styles.pratoPreco}>{formatPrice(item.preco)}</Text>
                  </View>
                  <Pressable onPress={() => addToStaging(item)} style={styles.addBtn}>
                    <Text style={styles.addBtnText}>
                      {staged ? `✓ ${staged.quantidade}` : '+ Adicionar'}
                    </Text>
                  </Pressable>
                </View>
              );
            }}
            ListEmptyComponent={
              <View style={{ alignItems: 'center', paddingVertical: 32, gap: 8 }}>
                <Ionicons name="search-outline" size={32} color="#d1d5db" />
                <Text style={styles.emptyText}>
                  {searchQuery || selectedCategory !== 'Todos'
                    ? 'Nenhum prato encontrado'
                    : 'Nenhum prato disponível no momento'}
                </Text>
              </View>
            }
          />
        ) : (
          <ScrollView contentContainerStyle={{ padding: 12 }}>
            <Text style={styles.sectionTitle}>Itens a enviar</Text>
            {stagedItems.length === 0 ? (
              <View style={styles.emptyBox}>
                <Ionicons name="cart-outline" size={40} color="#d1d5db" />
                <Text style={styles.emptyText}>Nenhum item adicionado ainda</Text>
                <Pressable onPress={() => { console.log('[ComandaDetail] go to cardapio pressed'); setActiveTab('cardapio'); }} style={styles.goMenuBtn}>
                  <Text style={styles.goMenuBtnText}>Ver Cardápio</Text>
                </Pressable>
              </View>
            ) : (
              stagedItems.map((item) => (
                <View key={item.pratoId} style={styles.stagedCard}>
                  <View style={styles.stagedHeader}>
                    <Text style={styles.stagedNome} numberOfLines={1}>
                      {item.pratoNome}
                    </Text>
                    <Pressable onPress={() => { console.log('[ComandaDetail] remove staged item', item.pratoId); removeFromStaging(item.pratoId); }} hitSlop={8}>
                      <Ionicons name="trash-outline" size={20} color="#ef4444" />
                    </Pressable>
                  </View>
                  <View style={styles.qtyRow}>
                    <Pressable onPress={() => { console.log('[ComandaDetail] decreaseQty', item.pratoId); decreaseQty(item.pratoId); }} style={styles.qtyBtn}>
                      <Text style={styles.qtyBtnText}>−</Text>
                    </Pressable>
                    <Text style={styles.qtyText}>{item.quantidade}</Text>
                    <Pressable onPress={() => { console.log('[ComandaDetail] increaseQty', item.pratoId); increaseQty(item.pratoId); }} style={styles.qtyBtn}>
                      <Text style={styles.qtyBtnText}>+</Text>
                    </Pressable>
                    <Text style={styles.subtotal}>
                      {formatPrice(item.quantidade * item.pratoPreco)}
                    </Text>
                  </View>
                  <TextInput
                    style={styles.obsInput}
                    value={item.observacao}
                    onChangeText={(text) => updateObservacao(item.pratoId, text)}
                    placeholder="Observação (opcional)"
                    placeholderTextColor="#9ca3af"
                  />
                </View>
              ))
            )}

            <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Pedidos Enviados</Text>
            {pedidosEnviados.length === 0 ? (
              <Text style={styles.emptyText}>Nenhum pedido enviado ainda</Text>
            ) : (
              pedidosEnviados.map((p) => {
                const pratoNome = pratos.find((pr) => pr.id === p.prato_id)?.nome ?? p.prato_id;
                const precoUnit = `R$ ${Number(p.preco_unitario).toFixed(2).replace('.', ',')}`;
                const qtyPreco = `Qtd: ${p.quantidade} × ${precoUnit}`;
                return (
                  <View key={p.id} style={styles.pedidoCard}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.pedidoNome, { fontWeight: '700' }]}>
                        {pratoNome}
                      </Text>
                      <Text style={styles.pedidoObs}>{qtyPreco}</Text>
                      {p.observacao ? (
                        <Text style={[styles.pedidoObs, { fontStyle: 'italic' }]}>{p.observacao}</Text>
                      ) : null}
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: statusColor(p.status) }]}>
                      <Text style={styles.statusText}>{p.status}</Text>
                    </View>
                  </View>
                );
              })
            )}

            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total:</Text>
              <Text style={styles.totalValue}>{totalDisplay}</Text>
            </View>

            {/* Fechar Comanda button inside pedido tab */}
            {canFechar ? (
              <>
                <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
                  <Pressable onPress={() => router.push({ pathname: "/comanda/fechar-conta", params: { id } })} style={{ backgroundColor: "#E8521A", borderRadius: 12, padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}>
                    <Ionicons name="receipt-outline" size={20} color="white" />
                    <Text style={{ color: "white", fontSize: 16, fontWeight: "600" }}>Fechar conta</Text>
                  </Pressable>
                </View>
              </>
            ) : null}
          </ScrollView>
        )}
      </View>

      {/* Fixed send button */}
      <Pressable
        onPress={handleEnviarPedido}
        disabled={stagedItems.length === 0 || sending}
        style={[
          styles.sendBtn,
          { backgroundColor: stagedItems.length === 0 ? '#d1d5db' : '#22c55e' },
        ]}
      >
        <Text style={styles.sendBtnText}>
          {sending
            ? 'Enviando...'
            : stagedItems.length > 0
            ? `Salvar e Enviar Pedido (${stagedItems.length} item${stagedItems.length > 1 ? 's' : ''})`
            : 'Salvar e Enviar Pedido'}
        </Text>
      </Pressable>

      {/* Fechamento Modal */}
      <FechamentoModal
        visible={fechamentoVisible}
        onClose={() => { console.log('[ComandaDetail] fechamento modal closed'); setFechamentoVisible(false); }}
        onSuccess={handleFechamentoSuccess}
        comandaId={id ?? ''}
        subtotal={subtotalForModal}
        mesaCapacidade={comanda?.mesa_capacidade}
      />
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  centered: { flex: 1, backgroundColor: '#f9fafb', alignItems: 'center' },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', marginRight: 12 },
  backText: { color: '#007AFF', fontSize: 16, marginLeft: 4 },
  navTitle: { fontSize: 17, fontWeight: '700', color: '#111827', flex: 1 },
  fecharHeaderBtn: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  fecharHeaderBtnText: { color: 'white', fontWeight: '700', fontSize: 13 },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#007AFF' },
  tabText: { fontSize: 15, color: '#6b7280' },
  tabTextActive: { color: '#007AFF', fontWeight: '600' },
  pratoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  pratoImage: { width: 72, height: 72, borderRadius: 8 },
  pratoImagePlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pratoNome: { fontWeight: '700', fontSize: 15, color: '#111827' },
  pratoDesc: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  pratoPreco: { fontSize: 14, color: '#22c55e', fontWeight: '600', marginTop: 4 },
  addBtn: {
    backgroundColor: '#22c55e',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 90,
    alignItems: 'center',
  },
  addBtnText: { color: 'white', fontWeight: '600', fontSize: 13 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 10 },
  emptyText: { color: '#9ca3af', textAlign: 'center', marginVertical: 12, fontSize: 14 },
  emptyBox: { alignItems: 'center', paddingVertical: 32 },
  goMenuBtn: {
    marginTop: 12,
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  goMenuBtnText: { color: 'white', fontWeight: '600' },
  stagedCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  stagedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  stagedNome: { fontWeight: '600', fontSize: 15, color: '#111827', flex: 1, marginRight: 8 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  qtyBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyBtnText: { fontSize: 18, color: '#374151', fontWeight: '600' },
  qtyText: { marginHorizontal: 16, fontSize: 16, fontWeight: '600', color: '#111827' },
  subtotal: { marginLeft: 'auto', fontSize: 14, color: '#22c55e', fontWeight: '600' },
  obsInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 8,
    fontSize: 14,
    color: '#374151',
    backgroundColor: '#fafafa',
  },
  pedidoCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  pedidoNome: { fontSize: 14, color: '#374151', fontWeight: '500' },
  pedidoObs: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { color: 'white', fontSize: 12, fontWeight: '600' },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  totalLabel: { fontSize: 16, fontWeight: '700', color: '#111827' },
  totalValue: { fontSize: 16, fontWeight: '700', color: '#22c55e' },
  fecharBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ef4444',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    marginBottom: 8,
  },
  fecharBtnText: { color: 'white', fontWeight: '700', fontSize: 16 },
  sendBtn: { margin: 16, padding: 16, borderRadius: 12, alignItems: 'center' },
  sendBtnText: { color: 'white', fontWeight: '700', fontSize: 16 },
  retryBtn: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
});

// ─── Manager View Styles ─────────────────────────────────────────────────────

const mgStyles = StyleSheet.create({
  scrollContent: {
    padding: 16,
    paddingBottom: 24,
  },
  headerCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  statusBadgeText: {
    color: 'white',
    fontSize: 13,
    fontFamily: 'Outfit_700Bold',
  },
  mesaLabel: {
    fontSize: 15,
    color: '#6b7280',
    fontFamily: 'Outfit_400Regular',
    marginLeft: 4,
  },
  mesaNumber: {
    fontSize: 22,
    color: '#111827',
    fontFamily: 'Outfit_700Bold',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  metaText: {
    fontSize: 13,
    color: '#6b7280',
    fontFamily: 'Outfit_400Regular',
  },
  metaValue: {
    fontSize: 13,
    color: '#374151',
    fontFamily: 'Outfit_600SemiBold',
    flexShrink: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Outfit_700Bold',
    color: '#111827',
    marginBottom: 12,
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: 'white',
    borderRadius: 16,
  },
  emptyText: {
    color: '#9ca3af',
    fontSize: 14,
    fontFamily: 'Outfit_400Regular',
    marginTop: 10,
  },
  pedidoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  pedidoNome: {
    fontSize: 15,
    fontFamily: 'Outfit_600SemiBold',
    color: '#111827',
    marginBottom: 2,
  },
  pedidoQty: {
    fontSize: 13,
    fontFamily: 'Outfit_400Regular',
    color: '#6b7280',
    marginTop: 2,
  },
  pedidoObs: {
    fontSize: 12,
    fontFamily: 'Outfit_400Regular',
    color: '#9ca3af',
    fontStyle: 'italic',
    marginTop: 2,
  },
  pedidoStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    marginLeft: 10,
  },
  pedidoStatusText: {
    color: 'white',
    fontSize: 12,
    fontFamily: 'Outfit_600SemiBold',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 24,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -3 },
    elevation: 8,
  },
  footerTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  footerTotalLabel: {
    fontSize: 15,
    fontFamily: 'Outfit_600SemiBold',
    color: '#374151',
  },
  footerTotalValue: {
    fontSize: 22,
    fontFamily: 'Outfit_700Bold',
    color: '#22c55e',
  },
  fecharBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ef4444',
    borderRadius: 14,
    paddingVertical: 15,
  },
  fecharBtnText: {
    color: 'white',
    fontSize: 16,
    fontFamily: 'Outfit_700Bold',
  },
});

const modalStyles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  kvWrapper: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -4 },
    elevation: 16,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#d1d5db',
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
  },
  section: {
    paddingVertical: 12,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  summaryKey: {
    fontSize: 15,
    color: '#374151',
  },
  summaryVal: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  divider: {
    height: 1,
    backgroundColor: '#f3f4f6',
  },
  tipBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  tipBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  tipBtnActive: {
    borderColor: '#ef4444',
    backgroundColor: 'rgba(239,68,68,0.06)',
  },
  tipBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  tipBtnTextActive: {
    color: '#ef4444',
  },
  inputLabel: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#fafafa',
    marginBottom: 10,
  },
  totalSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  totalValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ef4444',
  },
  btnRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    marginBottom: 4,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  confirmBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ef4444',
  },
  confirmBtnDisabled: {
    backgroundColor: '#fca5a5',
  },
  confirmBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: 'white',
  },
});
