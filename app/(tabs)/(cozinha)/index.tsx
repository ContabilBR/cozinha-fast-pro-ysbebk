import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  Animated,
  ActivityIndicator,
  ScrollView,
  LayoutAnimation,
  Platform,
  UIManager,
  TouchableOpacity,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { CardSkeleton } from "@/components/SkeletonLoader";
import { apiGet, apiPut } from "@/utils/api";
import { formatElapsed } from "@/utils/helpers";
import {
  Flame,
  Clock,
  RefreshCw,
  ChefHat,
  Package,
  UtensilsCrossed,
  User,
  ChevronDown,
  ChevronUp,
} from "lucide-react-native";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface KitchenPedido {
  id: string;
  comanda_id: string;
  prato_id: string;
  prato?: { id: string; nome: string };
  quantidade: number;
  status: string;
  observacao?: string;
  created_at?: string;
  mesa?: { numero: number };
  comanda?: { mesa?: { numero: number } };
}

interface ComandaPedido {
  id: string;
  prato_nome: string;
  quantidade: number;
  status: string;
  observacao: string | null;
  created_at: string;
}

interface Comanda {
  id: string;
  numero_comanda: string;
  mesa_numero: number;
  created_at: string;
  garcom_nome: string;
  total_itens: number;
  status: string;
  pedidos: ComandaPedido[];
}

const NEXT_ACTION: Record<string, { status: string; label: string }> = {
  pendente: { status: "em_preparo", label: "Iniciar Preparo" },
  em_preparo: { status: "pronto", label: "Marcar Pronto" },
};

const STATUS_COLORS: Record<string, string> = {
  pendente: "#94A3B8",
  em_preparo: "#F59E0B",
  pronto: "#22C55E",
  entregue: "#0D9488",
  cancelado: "#EF4444",
};

const STATUS_LABELS: Record<string, string> = {
  pendente: "Pendente",
  em_preparo: "Em Preparo",
  pronto: "Pronto",
  entregue: "Entregue",
  cancelado: "Cancelado",
};

const COMANDA_STATUS_COLORS: Record<string, string> = {
  aberta: "#6366F1",
  fechada: "#22C55E",
  cancelada: "#EF4444",
};

const COMANDA_STATUS_LABELS: Record<string, string> = {
  aberta: "Aberta",
  fechada: "Fechada",
  cancelada: "Cancelada",
};

type ComandaFilter = "todas" | "abertas" | "fechadas" | "canceladas";

const COMANDA_FILTERS: { key: ComandaFilter; label: string }[] = [
  { key: "todas", label: "Todas" },
  { key: "abertas", label: "Abertas" },
  { key: "fechadas", label: "Fechadas" },
  { key: "canceladas", label: "Canceladas" },
];

const COMANDA_FILTER_STATUS: Record<ComandaFilter, string | null> = {
  todas: null,
  abertas: "aberta",
  fechadas: "fechada",
  canceladas: "cancelada",
};

function KitchenItemCard({
  item,
  onAction,
  index,
}: {
  item: KitchenPedido;
  onAction: (id: string, status: string) => Promise<void>;
  index: number;
}) {
  const COLORS = useColors();
  const [updating, setUpdating] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 350, delay: index * 60, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 350, delay: index * 60, useNativeDriver: true }),
    ]).start();
  }, [index, opacity, translateY]);

  const createdAt = item.created_at;
  const elapsed = formatElapsed(createdAt);
  const diffMin = createdAt ? Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000) : 0;
  const isUrgent = diffMin > 20;
  const isWarning = diffMin > 10 && !isUrgent;
  const borderColor = isUrgent ? "#EF444460" : isWarning ? "#F59E0B60" : COLORS.border;
  const nextAction = NEXT_ACTION[item.status];
  const statusColor = STATUS_COLORS[item.status] || "#94A3B8";
  const statusLabel = STATUS_LABELS[item.status] || item.status;
  const mesaNum = item.comanda?.mesa?.numero ?? item.mesa?.numero ?? "?";
  const pratoNome = item.prato?.nome ?? "Prato";

  const handleAction = async () => {
    if (!nextAction) return;
    console.log("[Cozinha] Action button pressed:", item.id, "->", nextAction.status);
    setUpdating(true);
    try {
      await onAction(item.id, nextAction.status);
    } finally {
      setUpdating(false);
    }
  };

  const actionBgColor = nextAction
    ? nextAction.status === "em_preparo"
      ? "#F59E0B"
      : "#22C55E"
    : COLORS.primary;

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      <View
        style={{
          backgroundColor: COLORS.surface,
          borderRadius: 16,
          marginHorizontal: 16,
          marginBottom: 10,
          borderWidth: 1.5,
          borderColor,
          overflow: "hidden",
        }}
      >
        {isUrgent && (
          <View style={{ backgroundColor: "#EF444415", paddingHorizontal: 16, paddingVertical: 6 }}>
            <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 11, color: "#EF4444" }}>
              Aguardando há {diffMin} min — URGENTE
            </Text>
          </View>
        )}

        <View style={{ padding: 14, gap: 10 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  backgroundColor: COLORS.primaryMuted,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 16, color: COLORS.primary }}>
                  {mesaNum}
                </Text>
              </View>
              <View>
                <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 15, color: COLORS.text }}>
                  Mesa {mesaNum}
                </Text>
                <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 12, color: COLORS.textSecondary }}>
                  Pedido #{item.id.slice(-6)}
                </Text>
              </View>
            </View>
            <View style={{ alignItems: "flex-end", gap: 4 }}>
              <View
                style={{
                  backgroundColor: statusColor + "20",
                  borderRadius: 8,
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                }}
              >
                <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 11, color: statusColor }}>
                  {statusLabel}
                </Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Clock size={11} color={isUrgent ? "#EF4444" : COLORS.textSecondary} />
                <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 11, color: isUrgent ? "#EF4444" : COLORS.textSecondary }}>
                  {elapsed}
                </Text>
              </View>
            </View>
          </View>

          <View style={{ gap: 6, paddingTop: 8, borderTopWidth: 1, borderTopColor: COLORS.divider }}>
            <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 6,
                  backgroundColor: COLORS.primaryMuted,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 11, color: COLORS.primary }}>
                  {item.quantidade}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 13, color: COLORS.text }}>
                  {pratoNome}
                </Text>
                {item.observacao ? (
                  <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 11, color: COLORS.textSecondary, fontStyle: "italic" }}>
                    {item.observacao}
                  </Text>
                ) : null}
              </View>
            </View>
          </View>
        </View>

        {nextAction && (
          <AnimatedPressable
            onPress={handleAction}
            disabled={updating}
            style={{
              backgroundColor: actionBgColor,
              paddingVertical: 13,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {updating ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 14, color: "#fff" }}>
                {nextAction.label}
              </Text>
            )}
          </AnimatedPressable>
        )}
      </View>
    </Animated.View>
  );
}

function ComandaCard({ item, index }: { item: Comanda; index: number }) {
  const COLORS = useColors();
  const [expanded, setExpanded] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 350, delay: index * 60, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 350, delay: index * 60, useNativeDriver: true }),
    ]).start();
  }, [index, opacity, translateY]);

  const handleToggle = () => {
    console.log("[Cozinha] ComandaCard toggled:", item.id, "expanded:", !expanded);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((prev) => !prev);
  };

  const comandaCode = item.id.slice(-6).toUpperCase();
  const comandaLabel = "#" + comandaCode;

  const createdDate = new Date(item.created_at);
  const hours = String(createdDate.getHours()).padStart(2, "0");
  const minutes = String(createdDate.getMinutes()).padStart(2, "0");
  const timeLabel = hours + ":" + minutes;

  const mesaNum = String(item.mesa_numero);
  const garcomNome = item.garcom_nome;
  const totalItens = String(item.total_itens);

  const comandaStatusColor = COMANDA_STATUS_COLORS[item.status] || "#94A3B8";
  const comandaStatusLabel = COMANDA_STATUS_LABELS[item.status] || item.status;

  const pedidos: ComandaPedido[] = Array.isArray(item.pedidos) ? item.pedidos : [];

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      <View
        style={{
          backgroundColor: COLORS.surface,
          borderRadius: 16,
          marginHorizontal: 16,
          marginBottom: 10,
          borderWidth: 1,
          borderColor: COLORS.border,
          overflow: "hidden",
        }}
      >
        <TouchableOpacity activeOpacity={0.7} onPress={handleToggle}>
          <View style={{ padding: 14, flexDirection: "row", alignItems: "center", gap: 14 }}>
            <View
              style={{
                width: 52,
                height: 52,
                borderRadius: 26,
                backgroundColor: COLORS.primaryMuted,
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 20, color: COLORS.primary }}>
                {mesaNum}
              </Text>
            </View>

            <View style={{ flex: 1, gap: 2 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 16, color: COLORS.text }}>
                  {comandaLabel}
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <View
                    style={{
                      backgroundColor: comandaStatusColor + "20",
                      borderRadius: 8,
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                    }}
                  >
                    <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 11, color: comandaStatusColor }}>
                      {comandaStatusLabel}
                    </Text>
                  </View>
                  {expanded ? (
                    <ChevronUp size={16} color={COLORS.textSecondary} />
                  ) : (
                    <ChevronDown size={16} color={COLORS.textSecondary} />
                  )}
                </View>
              </View>

              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <User size={12} color={COLORS.textSecondary} />
                <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 12, color: COLORS.textSecondary }}>
                  {garcomNome}
                </Text>
              </View>

              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 14,
                  marginTop: 6,
                  paddingTop: 8,
                  borderTopWidth: 1,
                  borderTopColor: COLORS.divider,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Clock size={12} color={COLORS.textSecondary} />
                  <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 12, color: COLORS.textSecondary }}>
                    {timeLabel}
                  </Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Package size={12} color={COLORS.textSecondary} />
                  <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 12, color: COLORS.textSecondary }}>
                    {totalItens}
                  </Text>
                  <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 12, color: COLORS.textSecondary }}>
                    itens
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </TouchableOpacity>

        {expanded && (
          <View
            style={{
              borderTopWidth: 1,
              borderTopColor: COLORS.divider,
              paddingHorizontal: 14,
              paddingVertical: 10,
              gap: 8,
            }}
          >
            {pedidos.length === 0 ? (
              <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 13, color: COLORS.textSecondary, textAlign: "center", paddingVertical: 8 }}>
                Sem pedidos
              </Text>
            ) : (
              pedidos.map((pedido) => {
                const pedidoStatusColor = STATUS_COLORS[pedido.status] || "#94A3B8";
                const pedidoStatusLabel = STATUS_LABELS[pedido.status] || pedido.status;
                return (
                  <View
                    key={pedido.id}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                      paddingVertical: 6,
                      borderBottomWidth: 1,
                      borderBottomColor: COLORS.divider,
                    }}
                  >
                    <View
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 6,
                        backgroundColor: COLORS.primaryMuted,
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 11, color: COLORS.primary }}>
                        {pedido.quantidade}
                      </Text>
                    </View>
                    <Text style={{ fontFamily: "Outfit_500Medium", fontSize: 13, color: COLORS.text, flex: 1 }}>
                      {pedido.prato_nome}
                    </Text>
                    <View
                      style={{
                        backgroundColor: pedidoStatusColor + "20",
                        borderRadius: 6,
                        paddingHorizontal: 7,
                        paddingVertical: 2,
                      }}
                    >
                      <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 10, color: pedidoStatusColor }}>
                        {pedidoStatusLabel}
                      </Text>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}
      </View>
    </Animated.View>
  );
}

export default function CozinhaScreen() {
  const COLORS = useColors();
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState<"fila" | "comandas">("fila");

  // Fila state
  const [items, setItems] = useState<KitchenPedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Comandas state
  const [comandas, setComandas] = useState<Comanda[]>([]);
  const [comandasLoading, setComandasLoading] = useState(true);
  const [comandasRefreshing, setComandasRefreshing] = useState(false);
  const [comandasError, setComandasError] = useState("");
  const [comandaFilter, setComandaFilter] = useState<ComandaFilter>("todas");

  const fetchFila = useCallback(async () => {
    console.log("[Cozinha] Fetching kitchen queue from /api/pedidos (pendente + em_preparo + pronto)");
    try {
      const [pendentesRes, emPreparoRes, prontoRes] = await Promise.all([
        apiGet<any>("/api/pedidos?status=pendente"),
        apiGet<any>("/api/pedidos?status=em_preparo"),
        apiGet<any>("/api/pedidos?status=pronto"),
      ]);
      const pendentes: KitchenPedido[] = Array.isArray(pendentesRes) ? pendentesRes : (pendentesRes.pedidos || []);
      const emPreparo: KitchenPedido[] = Array.isArray(emPreparoRes) ? emPreparoRes : (emPreparoRes.pedidos || []);
      const pronto: KitchenPedido[] = Array.isArray(prontoRes) ? prontoRes : (prontoRes.pedidos || []);
      const all = [...pendentes, ...emPreparo, ...pronto];
      const sorted = all.sort((a, b) => {
        const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
        return aTime - bTime;
      });
      console.log("[Cozinha] Loaded", sorted.length, "kitchen items (pendente:", pendentes.length, "em_preparo:", emPreparo.length, "pronto:", pronto.length, ")");
      setItems(sorted);
      setLastRefresh(new Date());
      setError("");
    } catch (e: any) {
      console.error("[Cozinha] Error:", e instanceof Error ? e.message : String(e));
      setError("Não foi possível carregar a fila.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const fetchComandas = useCallback(async () => {
    console.log("[Cozinha] Fetching comandas from /api/cozinha/comandas");
    try {
      const res = await apiGet<{ comandas: Comanda[] }>("/api/cozinha/comandas");
      const list: Comanda[] = Array.isArray(res) ? res : (res.comandas || []);
      console.log("[Cozinha] Loaded", list.length, "comandas");
      setComandas(list);
      setComandasError("");
    } catch (e: any) {
      console.error("[Cozinha] Comandas error:", e instanceof Error ? e.message : String(e));
      setComandasError("Não foi possível carregar as comandas.");
    } finally {
      setComandasLoading(false);
      setComandasRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchFila();
    fetchComandas();
    const interval = setInterval(() => {
      console.log("[Cozinha] Auto-refresh (30s)");
      fetchFila();
      fetchComandas();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchFila, fetchComandas]);

  const handleRefresh = () => {
    console.log("[Cozinha] Manual refresh - tab:", activeTab);
    if (activeTab === "fila") {
      setRefreshing(true);
      fetchFila();
    } else {
      setComandasRefreshing(true);
      fetchComandas();
    }
  };

  const handleAction = async (id: string, status: string) => {
    console.log("[Cozinha] PUT pedido status:", id, "->", status);
    try {
      await apiPut(`/api/pedidos/${id}/status`, { status });
      console.log("[Cozinha] Status updated, refreshing");
      await fetchFila();
    } catch (e) {
      console.error("[Cozinha] Status update error:", e);
    }
  };

  const handleTabPress = (tab: "fila" | "comandas") => {
    console.log("[Cozinha] Tab switched to:", tab);
    setActiveTab(tab);
  };

  const handleFilterPress = (filter: ComandaFilter) => {
    console.log("[Cozinha] Comanda filter changed to:", filter);
    setComandaFilter(filter);
  };

  const filteredComandas = comandas.filter((c) => {
    const targetStatus = COMANDA_FILTER_STATUS[comandaFilter];
    if (targetStatus === null) return true;
    return c.status === targetStatus;
  });

  const pendingCount = items.filter((i) => i.status === "pendente").length;
  const inProgressCount = items.filter((i) => i.status === "em_preparo").length;
  const lastRefreshMin = Math.floor((Date.now() - lastRefresh.getTime()) / 60000);
  const lastRefreshLabel = lastRefreshMin < 1 ? "agora" : `há ${lastRefreshMin} min`;

  const isFilaRefreshing = refreshing;
  const isComandasRefreshing = comandasRefreshing;
  const currentRefreshing = activeTab === "fila" ? isFilaRefreshing : isComandasRefreshing;

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + 12,
          paddingHorizontal: 20,
          paddingBottom: 14,
          backgroundColor: COLORS.surface,
          borderBottomWidth: 1,
          borderBottomColor: COLORS.border,
        }}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Flame size={22} color={COLORS.primary} />
              <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 26, color: COLORS.text, letterSpacing: -0.3 }}>
                Cozinha
              </Text>
            </View>
            <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 13, color: COLORS.textSecondary }}>
              {pendingCount} pendentes · {inProgressCount} em preparo
            </Text>
          </View>
          <View style={{ alignItems: "flex-end", gap: 4 }}>
            <AnimatedPressable
              onPress={handleRefresh}
              accessibilityLabel="Atualizar"
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                backgroundColor: COLORS.surfaceSecondary,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <RefreshCw size={18} color={COLORS.textSecondary} />
            </AnimatedPressable>
            <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 10, color: COLORS.textTertiary }}>
              {lastRefreshLabel}
            </Text>
          </View>
        </View>

        {/* Toggle */}
        <View
          style={{
            flexDirection: "row",
            backgroundColor: COLORS.surfaceSecondary,
            borderRadius: 12,
            padding: 3,
          }}
        >
          <AnimatedPressable
            onPress={() => handleTabPress("fila")}
            style={{
              flex: 1,
              paddingVertical: 8,
              borderRadius: 10,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: activeTab === "fila" ? COLORS.primary : "transparent",
            }}
          >
            <Text
              style={{
                fontFamily: "Outfit_600SemiBold",
                fontSize: 14,
                color: activeTab === "fila" ? "#fff" : COLORS.textSecondary,
              }}
            >
              Fila
            </Text>
          </AnimatedPressable>
          <AnimatedPressable
            onPress={() => handleTabPress("comandas")}
            style={{
              flex: 1,
              paddingVertical: 8,
              borderRadius: 10,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: activeTab === "comandas" ? COLORS.primary : "transparent",
            }}
          >
            <Text
              style={{
                fontFamily: "Outfit_600SemiBold",
                fontSize: 14,
                color: activeTab === "comandas" ? "#fff" : COLORS.textSecondary,
              }}
            >
              Comandas
            </Text>
          </AnimatedPressable>
        </View>

        {/* Comanda status filter pills */}
        {activeTab === "comandas" && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginTop: 10 }}
            contentContainerStyle={{ gap: 8, paddingHorizontal: 0 }}
          >
            {COMANDA_FILTERS.map((f) => {
              const isActive = comandaFilter === f.key;
              return (
                <AnimatedPressable
                  key={f.key}
                  onPress={() => handleFilterPress(f.key)}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 6,
                    borderRadius: 20,
                    backgroundColor: isActive ? COLORS.primary : COLORS.surfaceSecondary,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: "Outfit_600SemiBold",
                      fontSize: 13,
                      color: isActive ? "#fff" : COLORS.textSecondary,
                    }}
                  >
                    {f.label}
                  </Text>
                </AnimatedPressable>
              );
            })}
          </ScrollView>
        )}
      </View>

      {/* Fila view */}
      {activeTab === "fila" && (
        <>
          {loading ? (
            <View style={{ paddingTop: 16 }}>
              {[0, 1, 2].map((i) => <CardSkeleton key={i} />)}
            </View>
          ) : error ? (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 }}>
              <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 17, color: COLORS.text }}>
                Erro ao carregar fila
              </Text>
              <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 14, color: COLORS.textSecondary, textAlign: "center" }}>
                {error}
              </Text>
              <AnimatedPressable
                onPress={fetchFila}
                style={{ backgroundColor: COLORS.primary, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 }}
              >
                <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 15, color: "#fff" }}>
                  Tentar novamente
                </Text>
              </AnimatedPressable>
            </View>
          ) : (
            <FlatList
              data={items}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingTop: 12, paddingBottom: 120 }}
              contentInsetAdjustmentBehavior="automatic"
              refreshControl={
                <RefreshControl refreshing={currentRefreshing} onRefresh={handleRefresh} tintColor={COLORS.primary} />
              }
              renderItem={({ item, index }) => (
                <KitchenItemCard item={item} onAction={handleAction} index={index} />
              )}
              ListEmptyComponent={
                <View style={{ alignItems: "center", justifyContent: "center", padding: 48, gap: 12 }}>
                  <View
                    style={{
                      width: 72,
                      height: 72,
                      borderRadius: 20,
                      backgroundColor: COLORS.primaryMuted,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <ChefHat size={32} color={COLORS.primary} />
                  </View>
                  <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 17, color: COLORS.text }}>
                    Fila vazia
                  </Text>
                  <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 14, color: COLORS.textSecondary, textAlign: "center" }}>
                    Nenhum item aguardando preparo
                  </Text>
                </View>
              }
            />
          )}
        </>
      )}

      {/* Comandas view */}
      {activeTab === "comandas" && (
        <>
          {comandasLoading ? (
            <View style={{ paddingTop: 16 }}>
              {[0, 1, 2].map((i) => <CardSkeleton key={i} />)}
            </View>
          ) : comandasError ? (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 }}>
              <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 17, color: COLORS.text }}>
                Erro ao carregar comandas
              </Text>
              <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 14, color: COLORS.textSecondary, textAlign: "center" }}>
                {comandasError}
              </Text>
              <AnimatedPressable
                onPress={fetchComandas}
                style={{ backgroundColor: COLORS.primary, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 }}
              >
                <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 15, color: "#fff" }}>
                  Tentar novamente
                </Text>
              </AnimatedPressable>
            </View>
          ) : (
            <FlatList
              data={filteredComandas}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingTop: 12, paddingBottom: 120 }}
              contentInsetAdjustmentBehavior="automatic"
              refreshControl={
                <RefreshControl refreshing={currentRefreshing} onRefresh={handleRefresh} tintColor={COLORS.primary} />
              }
              renderItem={({ item, index }) => (
                <ComandaCard item={item} index={index} />
              )}
              ListEmptyComponent={
                <View style={{ alignItems: "center", justifyContent: "center", padding: 48, gap: 12 }}>
                  <View
                    style={{
                      width: 72,
                      height: 72,
                      borderRadius: 20,
                      backgroundColor: COLORS.primaryMuted,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <UtensilsCrossed size={32} color={COLORS.primary} />
                  </View>
                  <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 17, color: COLORS.text }}>
                    Nenhuma comanda
                  </Text>
                  <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 14, color: COLORS.textSecondary, textAlign: "center" }}>
                    Não há comandas no momento
                  </Text>
                </View>
              }
            />
          )}
        </>
      )}
    </View>
  );
}
