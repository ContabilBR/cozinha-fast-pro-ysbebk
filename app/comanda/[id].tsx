import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  TextInput,
  FlatList,
  SectionList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { CardSkeleton } from "@/components/SkeletonLoader";
import { apiGet, apiPost, apiPatch } from "@/utils/api";
import { formatCurrency, formatDate, getPedidoStatusLabel, getPedidoStatusColor } from "@/utils/helpers";
import { Plus, Minus, X, CheckCircle, ShoppingBag, UtensilsCrossed, Send } from "lucide-react-native";
import type { ImageSourcePropType } from "react-native";

function resolveImageSource(source: string | number | ImageSourcePropType | undefined): ImageSourcePropType {
  if (!source) return { uri: "" };
  if (typeof source === "string") return { uri: source };
  return source as ImageSourcePropType;
}

interface ApiPrato {
  id: string;
  nome: string;
  descricao?: string;
  preco: number;
  imagem_url?: string;
  disponivel?: boolean;
  categoria?: { id: string; nome: string };
  categoria_id?: string;
}

interface StagedItem {
  prato: ApiPrato;
  quantidade: number;
  observacao: string;
}

interface PedidoItem {
  id: string;
  prato_id: string;
  prato?: { id: string; nome: string; preco: number };
  quantidade: number;
  preco_unitario?: number;
  observacao?: string;
  status: string;
  created_at?: string;
}

interface ComandaDetail {
  id: string;
  mesa_id: string;
  mesa?: { id: string; numero: number };
  garcom_id: string;
  garcom?: { id: string; name: string; nome?: string };
  status: string;
  total?: number;
  created_at?: string;
  closed_at?: string;
  pedidos?: PedidoItem[];
}

interface PratoSection {
  title: string;
  data: ApiPrato[];
}

function PedidoRow({ pedido }: { pedido: PedidoItem }) {
  const COLORS = useColors();
  const statusColor = getPedidoStatusColor(pedido.status);
  const statusLabel = getPedidoStatusLabel(pedido.status);
  const pratoNome = pedido.prato?.nome ?? "Prato";
  const unitPrice = pedido.preco_unitario ?? pedido.prato?.preco ?? 0;
  const subtotal = formatCurrency(unitPrice * pedido.quantidade);

  return (
    <View style={{ backgroundColor: COLORS.surface, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, padding: 14, marginBottom: 8, flexDirection: "row", alignItems: "center", gap: 12 }}>
      <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: COLORS.primaryMuted, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 13, color: COLORS.primary }}>{pedido.quantidade}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 14, color: COLORS.text }}>{pratoNome}</Text>
        {pedido.observacao ? (
          <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 11, color: COLORS.textSecondary, fontStyle: "italic" }}>{pedido.observacao}</Text>
        ) : null}
        <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 13, color: COLORS.primary, marginTop: 2 }}>{subtotal}</Text>
      </View>
      <View style={{ backgroundColor: statusColor + "20", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
        <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 11, color: statusColor }}>{statusLabel}</Text>
      </View>
    </View>
  );
}

function StagedItemRow({
  item,
  onIncrease,
  onDecrease,
  onRemove,
  onObservacaoChange,
}: {
  item: StagedItem;
  onIncrease: () => void;
  onDecrease: () => void;
  onRemove: () => void;
  onObservacaoChange: (text: string) => void;
}) {
  const COLORS = useColors();
  const subtotal = formatCurrency(Number(item.prato.preco) * item.quantidade);

  return (
    <View style={{ backgroundColor: COLORS.surface, borderRadius: 14, borderWidth: 1, borderColor: COLORS.primary + "30", padding: 14, marginBottom: 10, gap: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 14, color: COLORS.text }}>{item.prato.nome}</Text>
          <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 13, color: COLORS.primary, marginTop: 2 }}>{subtotal}</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <AnimatedPressable
            onPress={() => { console.log("[Comanda] Diminuir quantidade staged:", item.prato.nome); onDecrease(); }}
            style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: COLORS.surfaceSecondary, alignItems: "center", justifyContent: "center" }}
          >
            <Minus size={14} color={COLORS.text} />
          </AnimatedPressable>
          <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 16, color: COLORS.text, minWidth: 20, textAlign: "center" }}>{item.quantidade}</Text>
          <AnimatedPressable
            onPress={() => { console.log("[Comanda] Aumentar quantidade staged:", item.prato.nome); onIncrease(); }}
            style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: COLORS.primaryMuted, alignItems: "center", justifyContent: "center" }}
          >
            <Plus size={14} color={COLORS.primary} />
          </AnimatedPressable>
          <AnimatedPressable
            onPress={() => { console.log("[Comanda] Remover item staged:", item.prato.nome); onRemove(); }}
            style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: COLORS.danger + "15", alignItems: "center", justifyContent: "center" }}
          >
            <X size={14} color={COLORS.danger} />
          </AnimatedPressable>
        </View>
      </View>
      <TextInput
        value={item.observacao}
        onChangeText={onObservacaoChange}
        placeholder="Observação (ex: sem cebola...)"
        placeholderTextColor={COLORS.textTertiary}
        style={{ backgroundColor: COLORS.surfaceSecondary, borderRadius: 10, padding: 10, fontFamily: "Outfit_400Regular", fontSize: 13, color: COLORS.text, borderWidth: 1, borderColor: COLORS.border }}
      />
    </View>
  );
}

export default function ComandaDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const COLORS = useColors();
  const router = useRouter();
  const { user } = useAuth();

  const [comanda, setComanda] = useState<ComandaDetail | null>(null);
  const [pedidos, setPedidos] = useState<PedidoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [closing, setClosing] = useState(false);

  // Menu / cardápio state
  const [pratos, setPratos] = useState<ApiPrato[]>([]);
  const [pratosLoading, setPratosLoading] = useState(false);
  const [pratosLoaded, setPratosLoaded] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [selectedCategoria, setSelectedCategoria] = useState<string | null>(null);

  // Staging state
  const [stagedItems, setStagedItems] = useState<StagedItem[]>([]);
  const [sending, setSending] = useState(false);

  const fetchComanda = useCallback(async () => {
    console.log("[Comanda] GET /api/comandas/" + id);
    try {
      const [comandaRes, pedidosRes] = await Promise.all([
        apiGet<any>(`/api/comandas/${id}`),
        apiGet<any>(`/api/pedidos?comanda_id=${id}`),
      ]);
      const c: ComandaDetail = comandaRes.comanda || comandaRes;
      setComanda(c);
      const pedidoList: PedidoItem[] = Array.isArray(pedidosRes)
        ? pedidosRes
        : (pedidosRes.pedidos || c.pedidos || []);
      console.log("[Comanda] Carregados", pedidoList.length, "pedidos enviados");
      setPedidos(pedidoList);
      setError("");
    } catch (e: any) {
      console.error("[Comanda] Erro:", e instanceof Error ? e.message : String(e));
      setError("Não foi possível carregar a comanda.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => { fetchComanda(); }, [fetchComanda]);

  const loadPratos = useCallback(async () => {
    if (pratosLoaded) return;
    setPratosLoading(true);
    try {
      console.log("[Comanda] GET /api/pratos");
      const res = await apiGet<any>("/api/pratos");
      const list: ApiPrato[] = Array.isArray(res) ? res : (res.pratos || []);
      const disponiveis = list.filter((p) => p.disponivel !== false);
      console.log("[Comanda] Carregados", disponiveis.length, "pratos disponíveis");
      setPratos(disponiveis);
      setPratosLoaded(true);
    } catch (e) {
      console.error("[Comanda] Erro ao carregar pratos:", e);
    } finally {
      setPratosLoading(false);
    }
  }, [pratosLoaded]);

  const handleRefresh = () => {
    console.log("[Comanda] Refresh manual");
    setRefreshing(true);
    fetchComanda();
  };

  const handleClose = async () => {
    console.log("[Comanda] Fechar comanda pressionado:", id);
    Alert.alert(
      "Fechar Comanda",
      "Tem certeza que deseja fechar esta comanda?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Fechar",
          style: "destructive",
          onPress: async () => {
            setClosing(true);
            try {
              console.log("[Comanda] PATCH /api/comandas/" + id + "/fechar");
              await apiPatch(`/api/comandas/${id}/fechar`, {});
              console.log("[Comanda] Comanda fechada com sucesso");
              router.back();
            } catch (e: any) {
              console.error("[Comanda] Erro ao fechar:", e);
              Alert.alert("Erro", "Não foi possível fechar a comanda. Tente novamente.");
            } finally {
              setClosing(false);
            }
          },
        },
      ]
    );
  };

  const handleToggleMenu = () => {
    console.log("[Comanda] Toggle menu pressionado, showMenu:", !showMenu);
    if (!showMenu) {
      loadPratos();
    }
    setShowMenu((v) => !v);
  };

  const handleAddToStaging = (prato: ApiPrato) => {
    console.log("[Comanda] Adicionar ao staging:", prato.nome);
    setStagedItems((prev) => {
      const existing = prev.find((s) => s.prato.id === prato.id);
      if (existing) {
        return prev.map((s) => s.prato.id === prato.id ? { ...s, quantidade: s.quantidade + 1 } : s);
      }
      return [...prev, { prato, quantidade: 1, observacao: "" }];
    });
  };

  const handleStagedIncrease = (pratoId: string) => {
    setStagedItems((prev) => prev.map((s) => s.prato.id === pratoId ? { ...s, quantidade: s.quantidade + 1 } : s));
  };

  const handleStagedDecrease = (pratoId: string) => {
    setStagedItems((prev) => {
      const item = prev.find((s) => s.prato.id === pratoId);
      if (item && item.quantidade <= 1) {
        return prev.filter((s) => s.prato.id !== pratoId);
      }
      return prev.map((s) => s.prato.id === pratoId ? { ...s, quantidade: s.quantidade - 1 } : s);
    });
  };

  const handleStagedRemove = (pratoId: string) => {
    setStagedItems((prev) => prev.filter((s) => s.prato.id !== pratoId));
  };

  const handleStagedObservacao = (pratoId: string, text: string) => {
    setStagedItems((prev) => prev.map((s) => s.prato.id === pratoId ? { ...s, observacao: text } : s));
  };

  const handleEnviarPedido = async () => {
    if (stagedItems.length === 0) return;
    console.log("[Comanda] Salvar e Enviar Pedido pressionado — itens:", stagedItems.length);
    setSending(true);
    try {
      await Promise.all(
        stagedItems.map((item) => {
          const payload = {
            comanda_id: id,
            prato_id: item.prato.id,
            quantidade: item.quantidade,
            preco_unitario: Number(item.prato.preco),
            observacao: item.observacao.trim() || "",
            status: "pendente",
          };
          console.log("[Comanda] POST /api/pedidos", payload);
          return apiPost("/api/pedidos", payload);
        })
      );
      console.log("[Comanda] Todos os pedidos enviados com sucesso");
      setStagedItems([]);
      setShowMenu(false);
      await fetchComanda();
    } catch (e: any) {
      console.error("[Comanda] Erro ao enviar pedidos:", e);
      Alert.alert("Erro", "Não foi possível enviar os pedidos. Tente novamente.");
    } finally {
      setSending(false);
    }
  };

  const isAberta = comanda?.status === "aberta";

  // Build sections for menu grouped by category
  const categorias = Array.from(
    new Map(
      pratos
        .filter((p) => p.categoria)
        .map((p) => [p.categoria!.id, p.categoria!.nome])
    ).entries()
  ).map(([id, nome]) => ({ id, nome }));

  const semCategoria = pratos.filter((p) => !p.categoria);

  const sections: PratoSection[] = [
    ...categorias.map((cat) => ({
      title: cat.nome,
      data: pratos.filter((p) => p.categoria?.id === cat.id),
    })),
    ...(semCategoria.length > 0 ? [{ title: "Outros", data: semCategoria }] : []),
  ];

  const filteredSections: PratoSection[] = selectedCategoria
    ? sections.filter((s) => {
        const cat = categorias.find((c) => c.id === selectedCategoria);
        return cat ? s.title === cat.nome : s.title === "Outros";
      })
    : sections;

  const pedidoTotal = pedidos.reduce((sum, p) => {
    const unit = p.preco_unitario ?? p.prato?.preco ?? 0;
    return sum + unit * p.quantidade;
  }, 0);
  const total = formatCurrency(comanda?.total ?? pedidoTotal);
  const openedAt = formatDate(comanda?.created_at);
  const mesaNum = comanda?.mesa?.numero ?? "?";
  const garcomName = comanda?.garcom?.name || comanda?.garcom?.nome || "—";

  const statusColorMap: Record<string, string> = {
    aberta: COLORS.success,
    fechada: COLORS.textSecondary,
    cancelada: COLORS.danger,
  };
  const comandaStatus = comanda?.status ?? "aberta";
  const comandaStatusColor = statusColorMap[comandaStatus] ?? COLORS.textSecondary;
  const comandaStatusLabel = comandaStatus === "aberta" ? "Aberta" : comandaStatus === "fechada" ? "Fechada" : "Cancelada";

  const stagedTotal = formatCurrency(
    stagedItems.reduce((sum, s) => sum + Number(s.prato.preco) * s.quantidade, 0)
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }} edges={["top", "left", "right"]}>
      {/* Nav bar */}
      <View style={{
        flexDirection: "row",
        alignItems: "center",
        height: 56,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
        backgroundColor: COLORS.surface,
      }}>
        <TouchableOpacity
          onPress={() => { console.log("[Comanda] Botão voltar pressionado"); router.back(); }}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={{ flexDirection: "row", alignItems: "center", zIndex: 1 }}
        >
          <Ionicons name="chevron-back" size={26} color="#007AFF" />
          <Text style={{ color: "#007AFF", fontSize: 17, fontWeight: "500" }}>Voltar</Text>
        </TouchableOpacity>
        <Text style={{
          position: "absolute",
          left: 0,
          right: 0,
          textAlign: "center",
          fontSize: 17,
          fontWeight: "700",
          color: COLORS.text,
          height: 56,
          lineHeight: 56,
        }}>
          Comanda
        </Text>
        {isAberta ? (
          <TouchableOpacity
            onPress={handleToggleMenu}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={{ position: "absolute", right: 16, flexDirection: "row", alignItems: "center", gap: 4 }}
          >
            {showMenu ? (
              <Text style={{ color: "#007AFF", fontSize: 15, fontWeight: "500" }}>Fechar menu</Text>
            ) : (
              <>
                <Plus size={18} color="#007AFF" />
                <Text style={{ color: "#007AFF", fontSize: 15, fontWeight: "500" }}>Adicionar</Text>
              </>
            )}
          </TouchableOpacity>
        ) : null}
      </View>

      {loading ? (
        <View style={{ padding: 16, gap: 12 }}>
          {[0, 1, 2].map((i) => <CardSkeleton key={i} />)}
        </View>
      ) : error ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 }}>
          <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 17, color: COLORS.text }}>Erro ao carregar comanda</Text>
          <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 14, color: COLORS.textSecondary, textAlign: "center" }}>{error}</Text>
          <AnimatedPressable
            onPress={fetchComanda}
            style={{ backgroundColor: COLORS.primary, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 }}
          >
            <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 15, color: "#fff" }}>Tentar novamente</Text>
          </AnimatedPressable>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={{ padding: 16, paddingBottom: 24, gap: 16 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.primary} />}
            keyboardShouldPersistTaps="handled"
          >
            {/* Info card */}
            <View style={{ backgroundColor: COLORS.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: COLORS.border, gap: 12 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 20, color: COLORS.text }}>Mesa {mesaNum}</Text>
                <View style={{ backgroundColor: comandaStatusColor + "20", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 }}>
                  <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 12, color: comandaStatusColor }}>{comandaStatusLabel}</Text>
                </View>
              </View>

              <View style={{ gap: 6 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 13, color: COLORS.textSecondary }}>Garçom</Text>
                  <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 13, color: COLORS.text }}>{garcomName}</Text>
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 13, color: COLORS.textSecondary }}>Aberta em</Text>
                  <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 13, color: COLORS.text }}>{openedAt}</Text>
                </View>
                {comanda?.closed_at ? (
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 13, color: COLORS.textSecondary }}>Fechada em</Text>
                    <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 13, color: COLORS.text }}>{formatDate(comanda.closed_at)}</Text>
                  </View>
                ) : null}
              </View>
            </View>

            {/* ── MENU / CARDÁPIO ── */}
            {showMenu && isAberta ? (
              <View style={{ backgroundColor: COLORS.surface, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, overflow: "hidden" }}>
                <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
                  <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 17, color: COLORS.text }}>Cardápio</Text>
                  <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 13, color: COLORS.textSecondary, marginTop: 2 }}>
                    Toque em um prato para adicionar ao pedido
                  </Text>
                </View>

                {/* Category filter */}
                {categorias.length > 0 ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 8, paddingHorizontal: 12, paddingVertical: 10 }}
                    style={{ borderBottomWidth: 1, borderBottomColor: COLORS.border }}
                  >
                    <AnimatedPressable
                      onPress={() => { console.log("[Comanda] Filtro: Todos"); setSelectedCategoria(null); }}
                      style={{ paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: !selectedCategoria ? COLORS.primary : COLORS.surfaceSecondary }}
                    >
                      <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 13, color: !selectedCategoria ? "#fff" : COLORS.textSecondary }}>Todos</Text>
                    </AnimatedPressable>
                    {categorias.map((cat) => (
                      <AnimatedPressable
                        key={cat.id}
                        onPress={() => { console.log("[Comanda] Filtro categoria:", cat.nome); setSelectedCategoria(selectedCategoria === cat.id ? null : cat.id); }}
                        style={{ paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: selectedCategoria === cat.id ? COLORS.primary : COLORS.surfaceSecondary }}
                      >
                        <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 13, color: selectedCategoria === cat.id ? "#fff" : COLORS.textSecondary }}>{cat.nome}</Text>
                      </AnimatedPressable>
                    ))}
                  </ScrollView>
                ) : null}

                {pratosLoading ? (
                  <View style={{ padding: 32, alignItems: "center", gap: 10 }}>
                    <ActivityIndicator color={COLORS.primary} />
                    <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 14, color: COLORS.textSecondary }}>Carregando cardápio...</Text>
                  </View>
                ) : pratos.length === 0 ? (
                  <View style={{ padding: 32, alignItems: "center", gap: 10 }}>
                    <UtensilsCrossed size={28} color={COLORS.textTertiary} />
                    <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 15, color: COLORS.text }}>Nenhum prato disponível</Text>
                  </View>
                ) : (
                  filteredSections.map((section) => (
                    <View key={section.title}>
                      <View style={{ paddingHorizontal: 14, paddingVertical: 8, backgroundColor: COLORS.surfaceSecondary }}>
                        <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 13, color: COLORS.textSecondary, textTransform: "uppercase", letterSpacing: 0.5 }}>{section.title}</Text>
                      </View>
                      {section.data.map((prato) => {
                        const stagedQty = stagedItems.find((s) => s.prato.id === prato.id)?.quantidade ?? 0;
                        const pratoPrice = formatCurrency(prato.preco);
                        const imgSrc = resolveImageSource(prato.imagem_url);
                        return (
                          <AnimatedPressable
                            key={prato.id}
                            onPress={() => { console.log("[Comanda] Prato adicionado ao staging:", prato.nome); handleAddToStaging(prato); }}
                            style={{ flexDirection: "row", padding: 12, borderBottomWidth: 1, borderBottomColor: COLORS.divider, alignItems: "center", gap: 12 }}
                          >
                            <View style={{ width: 64, height: 64, borderRadius: 10, backgroundColor: COLORS.surfaceSecondary, overflow: "hidden" }}>
                              {prato.imagem_url ? (
                                <Image source={imgSrc} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                              ) : (
                                <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                                  <UtensilsCrossed size={20} color={COLORS.textTertiary} />
                                </View>
                              )}
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text numberOfLines={1} style={{ fontFamily: "Outfit_600SemiBold", fontSize: 14, color: COLORS.text }}>{prato.nome}</Text>
                              {prato.descricao ? (
                                <Text numberOfLines={1} style={{ fontFamily: "Outfit_400Regular", fontSize: 12, color: COLORS.textSecondary, marginTop: 2 }}>{prato.descricao}</Text>
                              ) : null}
                              <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 14, color: COLORS.primary, marginTop: 4 }}>{pratoPrice}</Text>
                            </View>
                            <View style={{ alignItems: "center", gap: 4 }}>
                              <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: COLORS.primaryMuted, alignItems: "center", justifyContent: "center" }}>
                                <Plus size={16} color={COLORS.primary} />
                              </View>
                              {stagedQty > 0 ? (
                                <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center" }}>
                                  <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 11, color: "#fff" }}>{stagedQty}</Text>
                                </View>
                              ) : null}
                            </View>
                          </AnimatedPressable>
                        );
                      })}
                    </View>
                  ))
                )}
              </View>
            ) : null}

            {/* ── ITENS A ENVIAR (staging) ── */}
            {stagedItems.length > 0 ? (
              <View>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <View>
                    <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 17, color: COLORS.text }}>Itens a enviar</Text>
                    <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 12, color: COLORS.textSecondary, marginTop: 2 }}>
                      Revise antes de enviar para a cozinha
                    </Text>
                  </View>
                  <View style={{ backgroundColor: COLORS.warning + "20", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 }}>
                    <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 13, color: COLORS.warning }}>{stagedItems.length} item{stagedItems.length !== 1 ? "s" : ""}</Text>
                  </View>
                </View>

                {stagedItems.map((item) => (
                  <StagedItemRow
                    key={item.prato.id}
                    item={item}
                    onIncrease={() => handleStagedIncrease(item.prato.id)}
                    onDecrease={() => handleStagedDecrease(item.prato.id)}
                    onRemove={() => handleStagedRemove(item.prato.id)}
                    onObservacaoChange={(text) => handleStagedObservacao(item.prato.id, text)}
                  />
                ))}

                <View style={{ backgroundColor: COLORS.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: COLORS.border, flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 14, color: COLORS.textSecondary }}>Subtotal a enviar</Text>
                  <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 16, color: COLORS.primary }}>{stagedTotal}</Text>
                </View>

                <AnimatedPressable
                  onPress={() => { console.log("[Comanda] Salvar e Enviar Pedido pressionado"); handleEnviarPedido(); }}
                  disabled={sending}
                  style={{ backgroundColor: COLORS.primary, borderRadius: 14, height: 52, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 8 }}
                >
                  {sending ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Send size={18} color="#fff" />
                      <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 16, color: "#fff" }}>Salvar e Enviar Pedido</Text>
                    </>
                  )}
                </AnimatedPressable>
              </View>
            ) : null}

            {/* ── PEDIDOS ENVIADOS ── */}
            <View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 17, color: COLORS.text }}>
                  Pedidos enviados ({pedidos.length})
                </Text>
                {isAberta && stagedItems.length === 0 ? (
                  <AnimatedPressable
                    onPress={handleToggleMenu}
                    style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: COLORS.primaryMuted, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 }}
                  >
                    <Plus size={14} color={COLORS.primary} />
                    <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 13, color: COLORS.primary }}>Adicionar item</Text>
                  </AnimatedPressable>
                ) : null}
              </View>

              {pedidos.length === 0 ? (
                <View style={{ backgroundColor: COLORS.surface, borderRadius: 12, padding: 24, alignItems: "center", borderWidth: 1, borderColor: COLORS.border, gap: 8 }}>
                  <ShoppingBag size={28} color={COLORS.textTertiary} />
                  <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 14, color: COLORS.textSecondary }}>Nenhum pedido enviado ainda</Text>
                  {isAberta ? (
                    <AnimatedPressable
                      onPress={handleToggleMenu}
                      style={{ marginTop: 4, backgroundColor: COLORS.primaryMuted, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 }}
                    >
                      <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 13, color: COLORS.primary }}>Ver cardápio</Text>
                    </AnimatedPressable>
                  ) : null}
                </View>
              ) : (
                pedidos.map((pedido) => <PedidoRow key={pedido.id} pedido={pedido} />)
              )}
            </View>

            {/* ── TOTAL (sent pedidos only) ── */}
            {pedidos.length > 0 ? (
              <View style={{ backgroundColor: COLORS.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: COLORS.border, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 14, color: COLORS.textSecondary }}>Total da comanda</Text>
                <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 22, color: COLORS.primary }}>{total}</Text>
              </View>
            ) : null}
          </ScrollView>

          {/* Bottom actions */}
          {isAberta ? (
            <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: COLORS.background }}>
              <AnimatedPressable
                onPress={() => { console.log("[Comanda] Fechar comanda button pressed"); handleClose(); }}
                disabled={closing}
                style={{ backgroundColor: COLORS.success, borderRadius: 14, height: 52, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}
              >
                {closing ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <CheckCircle size={20} color="#fff" />
                    <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 16, color: "#fff" }}>Fechar comanda</Text>
                  </>
                )}
              </AnimatedPressable>
            </View>
          ) : null}
        </View>
      )}
    </SafeAreaView>
  );
}
