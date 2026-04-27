import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { CardSkeleton } from "@/components/SkeletonLoader";
import { Users } from "lucide-react-native";
import { formatCurrency } from "@/utils/helpers";

const BASE_URL = "https://j74mf38wgua3d4qd5mqbjjvza88n2qcp.app.specular.dev";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MesaInfo {
  id: string;
  numero: number;
  status: string;
  capacidade: number;
}

interface Resumo {
  total_arrecadado: number;
  total_comandas: number;
  total_pedidos: number;
}

interface PedidoItem {
  id: string;
  prato_nome: string;
  quantidade: number;
  preco_unitario: number;
  observacao: string | null;
  status: string;
}

interface ComandaItem {
  id: string;
  status: string;
  total: number;
  garcom_id: string;
  garcom_nome: string;
  created_at: string;
  closed_at: string | null;
  source: "ativa" | "historico";
  pedidos: PedidoItem[];
}

interface HistoricoData {
  mesa: MesaInfo;
  resumo: Resumo;
  comandas: ComandaItem[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}

function getComandaStatusConfig(status: string): { label: string; color: string; bg: string } {
  switch (status) {
    case "aberta":
      return { label: "Aberta", color: "#22C55E", bg: "rgba(34,197,94,0.12)" };
    case "fechada":
      return { label: "Fechada", color: "#3B82F6", bg: "rgba(59,130,246,0.12)" };
    case "paga":
      return { label: "Paga", color: "#8B5CF6", bg: "rgba(139,92,246,0.12)" };
    case "cancelada":
      return { label: "Cancelada", color: "#EF4444", bg: "rgba(239,68,68,0.12)" };
    default:
      return { label: status, color: "#94A3B8", bg: "rgba(148,163,184,0.12)" };
  }
}

function getPedidoStatusConfig(status: string): { label: string; color: string; bg: string } {
  switch (status) {
    case "em_preparo":
    case "em_preparacao":
      return { label: "Em Preparo", color: "#F59E0B", bg: "rgba(245,158,11,0.12)" };
    case "pronto":
      return { label: "Pronto", color: "#22C55E", bg: "rgba(34,197,94,0.12)" };
    case "entregue":
      return { label: "Entregue", color: "#3B82F6", bg: "rgba(59,130,246,0.12)" };
    case "cancelado":
      return { label: "Cancelado", color: "#EF4444", bg: "rgba(239,68,68,0.12)" };
    default:
      return { label: "Pendente", color: "#94A3B8", bg: "rgba(148,163,184,0.12)" };
  }
}

function getMesaCircleColor(status: string): string {
  if (status === "disponivel" || status === "livre" || status === "free") return "#22C55E";
  if (status === "ocupada" || status === "occupied") return "#EF4444";
  return "#F59E0B";
}

function getMesaStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    disponivel: "Disponível",
    livre: "Disponível",
    free: "Disponível",
    ocupada: "Ocupada",
    occupied: "Ocupada",
    reservada: "Reservada",
    reserved: "Reservada",
    finalizada: "Finalizada",
  };
  return labels[status] || String(status);
}

// ─── Comanda Card ─────────────────────────────────────────────────────────────

function ComandaCard({ comanda }: { comanda: ComandaItem }) {
  const COLORS = useColors();
  const [expanded, setExpanded] = useState(false);

  const statusCfg = getComandaStatusConfig(comanda.status);
  const isAtiva = comanda.source === "ativa";
  const openedAt = formatDateTime(comanda.created_at);
  const closedAt = formatDateTime(comanda.closed_at);
  const totalStr = formatCurrency(Number(comanda.total) || 0);
  const hasClosed = !!comanda.closed_at;

  const handleToggle = () => {
    console.log("[MesaHistorico] Comanda card toggled:", comanda.id, "expanded:", !expanded);
    setExpanded((prev) => !prev);
  };

  return (
    <AnimatedPressable
      onPress={handleToggle}
      style={{
        backgroundColor: COLORS.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: isAtiva ? "#22C55E40" : COLORS.border,
        overflow: "hidden",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 1,
      }}
    >
      {/* Card header */}
      <View style={{ padding: 14, gap: 8 }}>
        {/* Row 1: date, status badge, total */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
            <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 13, color: COLORS.text }}>
              {openedAt}
            </Text>
            {isAtiva ? (
              <View style={{ backgroundColor: "rgba(34,197,94,0.15)", borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 10, color: "#22C55E" }}>
                  ATIVA
                </Text>
              </View>
            ) : null}
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{ backgroundColor: statusCfg.bg, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 }}>
              <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 11, color: statusCfg.color }}>
                {statusCfg.label}
              </Text>
            </View>
            <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 14, color: COLORS.primary }}>
              {totalStr}
            </Text>
          </View>
        </View>

        {/* Row 2: garçom + closed_at */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Text style={{ fontSize: 12 }}>👤</Text>
            <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 12, color: COLORS.textSecondary }}>
              {comanda.garcom_nome}
            </Text>
          </View>
          {hasClosed ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Text style={{ fontSize: 12 }}>🔒</Text>
              <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 12, color: COLORS.textSecondary }}>
                {closedAt}
              </Text>
            </View>
          ) : null}
          <View style={{ flex: 1, alignItems: "flex-end" }}>
            <Ionicons
              name={expanded ? "chevron-up" : "chevron-down"}
              size={16}
              color={COLORS.textSecondary}
            />
          </View>
        </View>
      </View>

      {/* Expanded pedidos */}
      {expanded ? (
        <View style={{ borderTopWidth: 1, borderTopColor: COLORS.border, padding: 14, gap: 8 }}>
          {comanda.pedidos.length === 0 ? (
            <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 13, color: COLORS.textSecondary, textAlign: "center", paddingVertical: 8 }}>
              Nenhum pedido nesta comanda
            </Text>
          ) : (
            comanda.pedidos.map((pedido) => {
              const pStatusCfg = getPedidoStatusConfig(pedido.status);
              const precoUnit = Number(pedido.preco_unitario) || 0;
              const qtdPreco = `${pedido.quantidade} × R$ ${precoUnit.toFixed(2).replace(".", ",")}`;
              const hasObs = pedido.observacao && pedido.observacao.trim().length > 0;
              return (
                <View
                  key={pedido.id}
                  style={{
                    backgroundColor: COLORS.background,
                    borderRadius: 12,
                    padding: 12,
                    borderWidth: 1,
                    borderColor: COLORS.border,
                    gap: 4,
                  }}
                >
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 13, color: COLORS.text, flex: 1, marginRight: 8 }}>
                      {pedido.prato_nome}
                    </Text>
                    <View style={{ backgroundColor: pStatusCfg.bg, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 }}>
                      <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 10, color: pStatusCfg.color }}>
                        {pStatusCfg.label}
                      </Text>
                    </View>
                  </View>
                  <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 12, color: COLORS.textSecondary }}>
                    {qtdPreco}
                  </Text>
                  {hasObs ? (
                    <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 11, color: COLORS.textTertiary, fontStyle: "italic" }}>
                      {pedido.observacao}
                    </Text>
                  ) : null}
                </View>
              );
            })
          )}
        </View>
      ) : null}
    </AnimatedPressable>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function MesaHistoricoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const COLORS = useColors();
  const router = useRouter();

  const [data, setData] = useState<HistoricoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const fetchHistorico = useCallback(async () => {
    console.log("[MesaHistorico] GET /api/mesas/" + id + "/historico");
    try {
      const res = await fetch(`${BASE_URL}/api/mesas/${id}/historico`);
      if (!res.ok) {
        const text = await res.text();
        console.warn("[MesaHistorico] Fetch error:", res.status, text.slice(0, 200));
        setError(`Erro ${res.status}: não foi possível carregar o histórico.`);
        return;
      }
      const json = await res.json();
      console.log("[MesaHistorico] Dados carregados — mesa:", json.mesa?.numero, "comandas:", json.comandas?.length);
      // Normalize numbers
      const normalized: HistoricoData = {
        mesa: json.mesa,
        resumo: {
          total_arrecadado: Number(json.resumo?.total_arrecadado) || 0,
          total_comandas: Number(json.resumo?.total_comandas) || 0,
          total_pedidos: Number(json.resumo?.total_pedidos) || 0,
        },
        comandas: (json.comandas || []).map((c: any) => ({
          ...c,
          total: Number(c.total) || 0,
          pedidos: (c.pedidos || []).map((p: any) => ({
            ...p,
            preco_unitario: Number(p.preco_unitario) || 0,
            quantidade: Number(p.quantidade) || 0,
          })),
        })),
      };
      // Sort most recent first
      normalized.comandas.sort((a, b) => {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
      setData(normalized);
      setError("");
    } catch (e: any) {
      console.error("[MesaHistorico] Erro:", e);
      setError("Não foi possível carregar o histórico da mesa.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => { fetchHistorico(); }, [fetchHistorico]);

  const handleRefresh = () => {
    console.log("[MesaHistorico] Refresh manual");
    setRefreshing(true);
    fetchHistorico();
  };

  // Derived display values
  const mesaNumero = data?.mesa?.numero ?? "—";
  const mesaStatus = data?.mesa?.status ?? "";
  const mesaCapacidade = data?.mesa?.capacidade ?? 0;
  const circleColor = getMesaCircleColor(mesaStatus);
  const statusLabel = getMesaStatusLabel(mesaStatus);
  const totalArrecadado = formatCurrency(data?.resumo?.total_arrecadado ?? 0);
  const totalComandas = String(data?.resumo?.total_comandas ?? 0);
  const totalPedidos = String(data?.resumo?.total_pedidos ?? 0);
  const navSubtitle = data ? `Mesa ${mesaNumero}` : "";

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
        <Pressable
          onPress={() => { console.log("[MesaHistorico] Botão voltar pressionado"); router.back(); }}
          style={{ flexDirection: "row", alignItems: "center", padding: 8, zIndex: 10 }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={22} color="#22c55e" />
        </Pressable>
        <View style={{ position: "absolute", left: 0, right: 0, alignItems: "center", pointerEvents: "none" }}>
          <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 17, color: COLORS.text }}>
            Histórico
          </Text>
          {navSubtitle ? (
            <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 12, color: COLORS.textSecondary, marginTop: 1 }}>
              {navSubtitle}
            </Text>
          ) : null}
        </View>
      </View>

      {loading ? (
        <View style={{ padding: 16, gap: 12 }}>
          {[0, 1, 2].map((i) => <CardSkeleton key={i} />)}
        </View>
      ) : error ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 }}>
          <View style={{ width: 72, height: 72, borderRadius: 20, backgroundColor: "rgba(239,68,68,0.10)", alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="alert-circle-outline" size={34} color={COLORS.danger} />
          </View>
          <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 17, color: COLORS.text, textAlign: "center" }}>
            Erro ao carregar histórico
          </Text>
          <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 14, color: COLORS.textSecondary, textAlign: "center" }}>
            {error}
          </Text>
          <AnimatedPressable
            onPress={() => { console.log("[MesaHistorico] Tentar novamente pressionado"); setLoading(true); fetchHistorico(); }}
            style={{ backgroundColor: COLORS.primary, borderRadius: 12, paddingHorizontal: 28, paddingVertical: 13 }}
          >
            <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 15, color: "#fff" }}>Tentar novamente</Text>
          </AnimatedPressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 80, gap: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.primary} />}
        >
          {/* Mesa info card */}
          <View style={{
            backgroundColor: COLORS.surface,
            borderRadius: 16,
            padding: 20,
            borderWidth: 1,
            borderColor: COLORS.border,
            gap: 16,
          }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View style={{
                width: 64,
                height: 64,
                borderRadius: 18,
                backgroundColor: circleColor + "18",
                alignItems: "center",
                justifyContent: "center",
              }}>
                <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 28, color: circleColor }}>
                  {mesaNumero}
                </Text>
              </View>
              <View style={{ backgroundColor: circleColor + "20", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 }}>
                <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 13, color: circleColor }}>
                  {statusLabel}
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Users size={16} color={COLORS.textSecondary} />
              <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 14, color: COLORS.textSecondary }}>
                Capacidade:
              </Text>
              <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 14, color: COLORS.text }}>
                {mesaCapacidade}
              </Text>
              <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 14, color: COLORS.textSecondary }}>
                pessoas
              </Text>
            </View>
          </View>

          {/* Resumo card */}
          <View style={{
            backgroundColor: COLORS.surface,
            borderRadius: 16,
            padding: 16,
            borderWidth: 1,
            borderColor: COLORS.border,
          }}>
            <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 15, color: COLORS.text, marginBottom: 14 }}>
              Resumo
            </Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              {/* Total arrecadado */}
              <View style={{
                flex: 2,
                backgroundColor: "rgba(34,197,94,0.08)",
                borderRadius: 14,
                padding: 14,
                alignItems: "center",
                gap: 4,
                borderWidth: 1,
                borderColor: "rgba(34,197,94,0.18)",
              }}>
                <Text style={{ fontSize: 20 }}>💰</Text>
                <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 16, color: "#22C55E", textAlign: "center" }}>
                  {totalArrecadado}
                </Text>
                <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 11, color: COLORS.textSecondary, textAlign: "center" }}>
                  Total Arrecadado
                </Text>
              </View>
              {/* Comandas */}
              <View style={{
                flex: 1,
                backgroundColor: COLORS.background,
                borderRadius: 14,
                padding: 14,
                alignItems: "center",
                gap: 4,
                borderWidth: 1,
                borderColor: COLORS.border,
              }}>
                <Text style={{ fontSize: 20 }}>🧾</Text>
                <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 20, color: COLORS.text }}>
                  {totalComandas}
                </Text>
                <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 11, color: COLORS.textSecondary, textAlign: "center" }}>
                  Comandas
                </Text>
              </View>
              {/* Pedidos */}
              <View style={{
                flex: 1,
                backgroundColor: COLORS.background,
                borderRadius: 14,
                padding: 14,
                alignItems: "center",
                gap: 4,
                borderWidth: 1,
                borderColor: COLORS.border,
              }}>
                <Text style={{ fontSize: 20 }}>🍽️</Text>
                <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 20, color: COLORS.text }}>
                  {totalPedidos}
                </Text>
                <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 11, color: COLORS.textSecondary, textAlign: "center" }}>
                  Pedidos
                </Text>
              </View>
            </View>
          </View>

          {/* Comandas list */}
          <View style={{ gap: 10 }}>
            <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 16, color: COLORS.text }}>
              Comandas
            </Text>
            {data && data.comandas.length === 0 ? (
              <View style={{
                backgroundColor: COLORS.surface,
                borderRadius: 16,
                padding: 32,
                alignItems: "center",
                borderWidth: 1,
                borderColor: COLORS.border,
                gap: 8,
              }}>
                <Text style={{ fontSize: 32 }}>🧾</Text>
                <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 15, color: COLORS.text, textAlign: "center" }}>
                  Nenhuma comanda registrada para esta mesa
                </Text>
              </View>
            ) : (
              data?.comandas.map((comanda) => (
                <ComandaCard key={comanda.id} comanda={comanda} />
              ))
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
