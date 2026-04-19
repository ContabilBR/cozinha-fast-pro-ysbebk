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
  Modal,
  FlatList,
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
import { Plus, Minus, X, CheckCircle, ShoppingBag, UtensilsCrossed } from "lucide-react-native";
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

  // Cardápio modal state
  const [showCardapio, setShowCardapio] = useState(false);
  const [pratos, setPratos] = useState<ApiPrato[]>([]);
  const [pratosLoading, setPratosLoading] = useState(false);
  const [selectedPrato, setSelectedPrato] = useState<ApiPrato | null>(null);
  const [quantidade, setQuantidade] = useState(1);
  const [observacao, setObservacao] = useState("");
  const [adicionando, setAdicionando] = useState(false);

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
      console.log("[Comanda] Carregados", pedidoList.length, "pedidos");
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

  const openCardapio = async () => {
    console.log("[Comanda] Abrir cardápio pressionado");
    setShowCardapio(true);
    setSelectedPrato(null);
    setQuantidade(1);
    setObservacao("");
    if (pratos.length === 0) {
      setPratosLoading(true);
      try {
        console.log("[Comanda] GET /api/pratos");
        const res = await apiGet<any>("/api/pratos");
        const list: ApiPrato[] = Array.isArray(res) ? res : (res.pratos || []);
        const disponiveis = list.filter((p) => p.disponivel !== false);
        console.log("[Comanda] Carregados", disponiveis.length, "pratos disponíveis");
        setPratos(disponiveis);
      } catch (e) {
        console.error("[Comanda] Erro ao carregar pratos:", e);
      } finally {
        setPratosLoading(false);
      }
    }
  };

  const handleSelectPrato = (prato: ApiPrato) => {
    console.log("[Comanda] Prato selecionado:", prato.nome);
    setSelectedPrato(prato);
    setQuantidade(1);
    setObservacao("");
  };

  const handleAdicionarPedido = async () => {
    if (!selectedPrato) return;
    console.log("[Comanda] Adicionar pedido pressionado — prato:", selectedPrato.nome, "qtd:", quantidade);
    setAdicionando(true);
    try {
      const payload = {
        comanda_id: id,
        prato_id: selectedPrato.id,
        quantidade,
        preco_unitario: Number(selectedPrato.preco),
        status: "pendente",
        ...(observacao.trim() ? { observacao: observacao.trim() } : {}),
      };
      console.log("[Comanda] POST /api/pedidos", payload);
      await apiPost("/api/pedidos", payload);
      console.log("[Comanda] Pedido adicionado com sucesso");
      setShowCardapio(false);
      setSelectedPrato(null);
      setQuantidade(1);
      setObservacao("");
      await fetchComanda();
    } catch (e: any) {
      console.error("[Comanda] Erro ao adicionar pedido:", e);
      Alert.alert("Erro", "Não foi possível adicionar o item. Tente novamente.");
    } finally {
      setAdicionando(false);
    }
  };

  const isAberta = comanda?.status === "aberta";
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

  const selectedPratoPrice = selectedPrato ? formatCurrency(Number(selectedPrato.preco) * quantidade) : "";

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
            onPress={openCardapio}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={{ position: "absolute", right: 16, flexDirection: "row", alignItems: "center", gap: 4 }}
          >
            <Plus size={18} color="#007AFF" />
            <Text style={{ color: "#007AFF", fontSize: 15, fontWeight: "500" }}>Adicionar</Text>
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

              <View style={{ paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.border, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 14, color: COLORS.textSecondary }}>Total</Text>
                <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 22, color: COLORS.primary }}>{total}</Text>
              </View>
            </View>

            {/* Pedidos */}
            <View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 18, color: COLORS.text }}>Itens ({pedidos.length})</Text>
                {isAberta ? (
                  <AnimatedPressable
                    onPress={openCardapio}
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
                  <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 14, color: COLORS.textSecondary }}>Nenhum item ainda</Text>
                  {isAberta ? (
                    <AnimatedPressable
                      onPress={openCardapio}
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
          </ScrollView>

          {/* Bottom actions */}
          {isAberta ? (
            <View style={{ padding: 16, gap: 10, borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: COLORS.background }}>
              <AnimatedPressable
                onPress={openCardapio}
                style={{ backgroundColor: COLORS.primaryMuted, borderRadius: 14, height: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1, borderColor: COLORS.primary + "30" }}
              >
                <Plus size={18} color={COLORS.primary} />
                <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 15, color: COLORS.primary }}>Adicionar item ao cardápio</Text>
              </AnimatedPressable>

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

      {/* Cardápio Modal */}
      <Modal
        visible={showCardapio}
        animationType="slide"
        transparent
        onRequestClose={() => { console.log("[Comanda] Cardápio modal fechado"); setShowCardapio(false); setSelectedPrato(null); }}
      >
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: COLORS.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "90%", minHeight: "60%" }}>
            {/* Modal header */}
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: COLORS.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
              <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 18, color: COLORS.text }}>
                {selectedPrato ? selectedPrato.nome : "Cardápio"}
              </Text>
              <TouchableOpacity
                onPress={() => { console.log("[Comanda] Fechar modal cardápio"); if (selectedPrato) { setSelectedPrato(null); } else { setShowCardapio(false); } }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.surfaceSecondary, alignItems: "center", justifyContent: "center" }}
              >
                {selectedPrato ? (
                  <Ionicons name="chevron-back" size={18} color={COLORS.textSecondary} />
                ) : (
                  <X size={16} color={COLORS.textSecondary} />
                )}
              </TouchableOpacity>
            </View>

            {selectedPrato ? (
              /* Add item detail view */
              <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }} keyboardShouldPersistTaps="handled">
                {selectedPrato.imagem_url ? (
                  <View style={{ height: 180, borderRadius: 16, overflow: "hidden", backgroundColor: COLORS.surfaceSecondary }}>
                    <Image source={resolveImageSource(selectedPrato.imagem_url)} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                  </View>
                ) : (
                  <View style={{ height: 100, borderRadius: 16, backgroundColor: COLORS.surfaceSecondary, alignItems: "center", justifyContent: "center", gap: 8 }}>
                    <UtensilsCrossed size={32} color={COLORS.textTertiary} />
                  </View>
                )}

                {selectedPrato.descricao ? (
                  <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 14, color: COLORS.textSecondary, lineHeight: 20 }}>{selectedPrato.descricao}</Text>
                ) : null}

                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: COLORS.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: COLORS.border }}>
                  <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 14, color: COLORS.textSecondary }}>Preço unitário</Text>
                  <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 16, color: COLORS.primary }}>{formatCurrency(selectedPrato.preco)}</Text>
                </View>

                {/* Quantity */}
                <View style={{ gap: 8 }}>
                  <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 14, color: COLORS.text }}>Quantidade</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 16, alignSelf: "flex-start", backgroundColor: COLORS.surface, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: COLORS.border }}>
                    <AnimatedPressable
                      onPress={() => { console.log("[Comanda] Diminuir quantidade"); setQuantidade((q) => Math.max(1, q - 1)); }}
                      style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: COLORS.surfaceSecondary, alignItems: "center", justifyContent: "center" }}
                    >
                      <Minus size={16} color={COLORS.text} />
                    </AnimatedPressable>
                    <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 22, color: COLORS.text, minWidth: 32, textAlign: "center" }}>{quantidade}</Text>
                    <AnimatedPressable
                      onPress={() => { console.log("[Comanda] Aumentar quantidade"); setQuantidade((q) => q + 1); }}
                      style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: COLORS.primaryMuted, alignItems: "center", justifyContent: "center" }}
                    >
                      <Plus size={16} color={COLORS.primary} />
                    </AnimatedPressable>
                  </View>
                </View>

                {/* Observation */}
                <View style={{ gap: 8 }}>
                  <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 14, color: COLORS.text }}>Observação (opcional)</Text>
                  <TextInput
                    value={observacao}
                    onChangeText={setObservacao}
                    placeholder="Ex: sem cebola, bem passado..."
                    placeholderTextColor={COLORS.textTertiary}
                    multiline
                    numberOfLines={2}
                    style={{ backgroundColor: COLORS.surface, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, padding: 12, fontFamily: "Outfit_400Regular", fontSize: 14, color: COLORS.text, minHeight: 64, textAlignVertical: "top" }}
                  />
                </View>

                <AnimatedPressable
                  onPress={handleAdicionarPedido}
                  disabled={adicionando}
                  style={{ backgroundColor: COLORS.primary, borderRadius: 14, height: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20 }}
                >
                  {adicionando ? (
                    <ActivityIndicator color="#fff" style={{ flex: 1 }} />
                  ) : (
                    <>
                      <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 16, color: "#fff" }}>Adicionar ao pedido</Text>
                      <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 15, color: "rgba(255,255,255,0.85)" }}>{selectedPratoPrice}</Text>
                    </>
                  )}
                </AnimatedPressable>
              </ScrollView>
            ) : (
              /* Pratos list */
              pratosLoading ? (
                <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 40 }}>
                  <ActivityIndicator color={COLORS.primary} size="large" />
                  <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 14, color: COLORS.textSecondary, marginTop: 12 }}>Carregando cardápio...</Text>
                </View>
              ) : pratos.length === 0 ? (
                <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 40, gap: 12 }}>
                  <UtensilsCrossed size={36} color={COLORS.textTertiary} />
                  <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 16, color: COLORS.text }}>Nenhum prato disponível</Text>
                </View>
              ) : (
                <FlatList
                  data={pratos}
                  keyExtractor={(item) => item.id}
                  contentContainerStyle={{ padding: 12, paddingBottom: 32, gap: 10 }}
                  renderItem={({ item }) => {
                    const pratoPrice = formatCurrency(item.preco);
                    const imgSource = resolveImageSource(item.imagem_url);
                    return (
                      <AnimatedPressable
                        onPress={() => handleSelectPrato(item)}
                        style={{ backgroundColor: COLORS.surface, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, flexDirection: "row", overflow: "hidden" }}
                      >
                        <View style={{ width: 80, height: 80, backgroundColor: COLORS.surfaceSecondary }}>
                          {item.imagem_url ? (
                            <Image source={imgSource} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                          ) : (
                            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                              <UtensilsCrossed size={22} color={COLORS.textTertiary} />
                            </View>
                          )}
                        </View>
                        <View style={{ flex: 1, padding: 12, justifyContent: "space-between" }}>
                          <View>
                            <Text numberOfLines={1} style={{ fontFamily: "Outfit_600SemiBold", fontSize: 14, color: COLORS.text }}>{item.nome}</Text>
                            {item.descricao ? (
                              <Text numberOfLines={1} style={{ fontFamily: "Outfit_400Regular", fontSize: 12, color: COLORS.textSecondary, marginTop: 2 }}>{item.descricao}</Text>
                            ) : null}
                          </View>
                          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                            <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 14, color: COLORS.primary }}>{pratoPrice}</Text>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: COLORS.primaryMuted, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
                              <Plus size={12} color={COLORS.primary} />
                              <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 12, color: COLORS.primary }}>Adicionar</Text>
                            </View>
                          </View>
                        </View>
                      </AnimatedPressable>
                    );
                  }}
                />
              )
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
