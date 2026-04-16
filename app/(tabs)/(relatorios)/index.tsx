import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { SkeletonLine } from "@/components/SkeletonLoader";
import { apiGet } from "@/utils/api";
import { formatCurrency } from "@/utils/helpers";

type ReportTab = "resumo" | "pratos" | "mesas" | "garcons" | "pedidos";

interface ResumoData {
  total_mesas?: number;
  ocupacao_atual?: number;
  comandas_abertas?: number;
  faturamento_dia?: number;
}

interface PratoReport {
  nome: string;
  total: number;
}

interface MesaReport {
  numero: number;
  tempo_medio_min: number;
  rotatividade: number;
  ticket_medio?: number;
}

interface GarcomReport {
  nome: string;
  total_pedidos: number;
  faturamento: number;
}

interface PeriodoReport {
  hora: string;
  total: number;
}

interface PedidoCancelado {
  id: string;
  mesa: string;
  garcom: string;
  motivo?: string;
  created_at: string;
}

function getDateRange(): { data_inicio: string; data_fim: string } {
  const now = new Date();
  const data_fim = now.toISOString().split("T")[0];
  const d = new Date(now);
  d.setDate(d.getDate() - 30);
  const data_inicio = d.toISOString().split("T")[0];
  return { data_inicio, data_fim };
}

export default function RelatoriosScreen() {
  const COLORS = useColors();
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState<ReportTab>("resumo");
  const [resumo, setResumo] = useState<ResumoData>({});
  const [pratos, setPratos] = useState<PratoReport[]>([]);
  const [mesas, setMesas] = useState<MesaReport[]>([]);
  const [garcons, setGarcons] = useState<GarcomReport[]>([]);
  const [periodos, setPeriodos] = useState<PeriodoReport[]>([]);
  const [cancelados, setCancelados] = useState<PedidoCancelado[]>([]);
  const [horarios, setHorarios] = useState<PeriodoReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    console.log("[Relatorios] Fetching reports, tab:", activeTab);
    const { data_inicio, data_fim } = getDateRange();
    try {
      if (activeTab === "resumo") {
        const [resumoRes, horariosRes] = await Promise.all([
          apiGet<any>("/api/relatorios/resumo").catch(() => ({})),
          apiGet<any>("/api/relatorios/horarios-movimento").catch(() => ({})),
        ]);
        setResumo(resumoRes?.resumo || resumoRes || {});
        setHorarios((horariosRes?.horarios || []) as PeriodoReport[]);
      } else if (activeTab === "pratos") {
        const res = await apiGet<any>(`/api/relatorios/pratos-mais-pedidos?data_inicio=${data_inicio}&data_fim=${data_fim}`).catch(() => ({}));
        setPratos((res?.pratos || []) as PratoReport[]);
      } else if (activeTab === "mesas") {
        const [ocupRes, ticketRes] = await Promise.all([
          apiGet<any>("/api/relatorios/ocupacao-mesas").catch(() => ({})),
          apiGet<any>("/api/relatorios/ticket-medio").catch(() => ({})),
        ]);
        const mesaList: MesaReport[] = (ocupRes?.mesas || []) as MesaReport[];
        const ticketMesas: { numero: number; ticket_medio: number }[] = ticketRes?.por_mesa || [];
        const merged = mesaList.map((m) => {
          const t = ticketMesas.find((tm) => tm.numero === m.numero);
          return { ...m, ticket_medio: t?.ticket_medio };
        });
        setMesas(merged);
      } else if (activeTab === "garcons") {
        const res = await apiGet<any>(`/api/relatorios/atendimentos-garcom?data_inicio=${data_inicio}&data_fim=${data_fim}`).catch(() => ({}));
        setGarcons((res?.garcons || []) as GarcomReport[]);
      } else if (activeTab === "pedidos") {
        const [periodosRes, canceladosRes] = await Promise.all([
          apiGet<any>(`/api/relatorios/pedidos-por-periodo?data_inicio=${data_inicio}&data_fim=${data_fim}`).catch(() => ({})),
          apiGet<any>(`/api/relatorios/pedidos-cancelados?data_inicio=${data_inicio}&data_fim=${data_fim}`).catch(() => ({})),
        ]);
        setPeriodos((periodosRes?.periodos || []) as PeriodoReport[]);
        setCancelados((canceladosRes?.pedidos || []) as PedidoCancelado[]);
      }
    } catch (e) {
      console.error("[Relatorios] Error:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab]);

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  const handleRefresh = () => {
    console.log("[Relatorios] Manual refresh");
    setRefreshing(true);
    fetchData();
  };

  const TABS: { key: ReportTab; label: string }[] = [
    { key: "resumo", label: "Resumo" },
    { key: "pratos", label: "Pratos" },
    { key: "mesas", label: "Mesas" },
    { key: "garcons", label: "Garçons" },
    { key: "pedidos", label: "Pedidos" },
  ];

  const maxPrato = Math.max(...pratos.map((p) => p.total), 1);
  const maxHorario = Math.max(...horarios.map((h) => h.total), 1);
  const maxPeriodo = Math.max(...periodos.map((p) => p.total), 1);

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <View
        style={{
          paddingTop: insets.top + 12,
          paddingHorizontal: 20,
          paddingBottom: 0,
          backgroundColor: COLORS.surface,
          borderBottomWidth: 1,
          borderBottomColor: COLORS.border,
        }}
      >
        <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 26, color: COLORS.text, letterSpacing: -0.3, marginBottom: 12 }}>
          Relatórios
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 4, paddingBottom: 12 }}>
          {TABS.map((tab) => (
            <AnimatedPressable
              key={tab.key}
              onPress={() => {
                console.log("[Relatorios] Tab changed:", tab.key);
                setActiveTab(tab.key);
              }}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 20,
                backgroundColor: activeTab === tab.key ? COLORS.primary : COLORS.surfaceSecondary,
              }}
            >
              <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 13, color: activeTab === tab.key ? "#fff" : COLORS.textSecondary }}>
                {tab.label}
              </Text>
            </AnimatedPressable>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 120, gap: 20 }}
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.primary} />
        }
      >
        {/* RESUMO TAB */}
        {activeTab === "resumo" && (
          <>
            <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
              {[
                { label: "Total Mesas", value: String(resumo.total_mesas ?? 0), color: "#3B82F6" },
                { label: "Ocupação Atual", value: String(resumo.ocupacao_atual ?? 0), color: COLORS.primary },
                { label: "Comandas Abertas", value: String(resumo.comandas_abertas ?? 0), color: COLORS.warning },
                { label: "Faturamento Hoje", value: formatCurrency(resumo.faturamento_dia ?? 0), color: COLORS.success },
              ].map((stat) => (
                <View
                  key={stat.label}
                  style={{
                    flex: 1,
                    minWidth: "45%",
                    backgroundColor: COLORS.surface,
                    borderRadius: 14,
                    padding: 14,
                    borderWidth: 1,
                    borderColor: COLORS.border,
                    gap: 6,
                  }}
                >
                  {loading ? (
                    <>
                      <SkeletonLine width="80%" height={18} />
                      <SkeletonLine width="60%" height={12} />
                    </>
                  ) : (
                    <>
                      <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 18, color: stat.color }}>
                        {stat.value}
                      </Text>
                      <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 12, color: COLORS.textSecondary }}>
                        {stat.label}
                      </Text>
                    </>
                  )}
                </View>
              ))}
            </View>

            {/* Horários de movimento */}
            <View>
              <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 18, color: COLORS.text, marginBottom: 12 }}>
                Horários de Movimento
              </Text>
              <View
                style={{
                  backgroundColor: COLORS.surface,
                  borderRadius: 16,
                  padding: 16,
                  borderWidth: 1,
                  borderColor: COLORS.border,
                  gap: 10,
                }}
              >
                {loading ? (
                  [0, 1, 2, 3].map((i) => <SkeletonLine key={i} width="100%" height={24} />)
                ) : horarios.length === 0 ? (
                  <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 14, color: COLORS.textSecondary, textAlign: "center" }}>
                    Sem dados disponíveis
                  </Text>
                ) : (
                  horarios.map((h) => {
                    const barW = Math.max(4, Math.round((h.total / maxHorario) * 100));
                    return (
                      <View key={h.hora} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                        <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 12, color: COLORS.textSecondary, width: 40 }}>
                          {h.hora}
                        </Text>
                        <View style={{ flex: 1, height: 20, backgroundColor: COLORS.surfaceSecondary, borderRadius: 4 }}>
                          <View
                            style={{
                              height: 20,
                              width: `${barW}%` as `${number}%`,
                              backgroundColor: COLORS.primary,
                              borderRadius: 4,
                            }}
                          />
                        </View>
                        <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 12, color: COLORS.text, width: 28, textAlign: "right" }}>
                          {h.total}
                        </Text>
                      </View>
                    );
                  })
                )}
              </View>
            </View>
          </>
        )}

        {/* PRATOS TAB */}
        {activeTab === "pratos" && (
          <View>
            <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 18, color: COLORS.text, marginBottom: 12 }}>
              Pratos Mais Pedidos
            </Text>
            <View
              style={{
                backgroundColor: COLORS.surface,
                borderRadius: 16,
                padding: 16,
                borderWidth: 1,
                borderColor: COLORS.border,
                gap: 14,
              }}
            >
              {loading ? (
                [0, 1, 2, 3].map((i) => (
                  <View key={i} style={{ gap: 6 }}>
                    <SkeletonLine width="50%" height={13} />
                    <SkeletonLine width="100%" height={10} borderRadius={5} />
                  </View>
                ))
              ) : pratos.length === 0 ? (
                <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 14, color: COLORS.textSecondary, textAlign: "center" }}>
                  Sem dados para o período
                </Text>
              ) : (
                pratos.map((prato, i) => {
                  const barW = Math.max(2, Math.round((prato.total / maxPrato) * 100));
                  return (
                    <View key={prato.nome + i} style={{ gap: 6 }}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                        <Text numberOfLines={1} style={{ fontFamily: "Outfit_600SemiBold", fontSize: 13, color: COLORS.text, flex: 1 }}>
                          {prato.nome}
                        </Text>
                        <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 13, color: COLORS.primary, marginLeft: 8 }}>
                          {prato.total}x
                        </Text>
                      </View>
                      <View style={{ height: 8, backgroundColor: COLORS.surfaceSecondary, borderRadius: 4 }}>
                        <View
                          style={{
                            height: 8,
                            width: `${barW}%` as `${number}%`,
                            backgroundColor: COLORS.primary,
                            borderRadius: 4,
                          }}
                        />
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          </View>
        )}

        {/* MESAS TAB */}
        {activeTab === "mesas" && (
          <View>
            <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 18, color: COLORS.text, marginBottom: 12 }}>
              Ocupação de Mesas
            </Text>
            <View style={{ gap: 8 }}>
              {loading ? (
                [0, 1, 2].map((i) => (
                  <View key={i} style={{ backgroundColor: COLORS.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: COLORS.border, gap: 8 }}>
                    <SkeletonLine width="40%" height={14} />
                    <SkeletonLine width="70%" height={12} />
                  </View>
                ))
              ) : mesas.length === 0 ? (
                <View style={{ backgroundColor: COLORS.surface, borderRadius: 12, padding: 24, alignItems: "center", borderWidth: 1, borderColor: COLORS.border }}>
                  <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 14, color: COLORS.textSecondary }}>
                    Sem dados disponíveis
                  </Text>
                </View>
              ) : (
                mesas.map((mesa) => {
                  const ticketStr = mesa.ticket_medio != null ? formatCurrency(mesa.ticket_medio) : "—";
                  return (
                    <View
                      key={mesa.numero}
                      style={{
                        backgroundColor: COLORS.surface,
                        borderRadius: 12,
                        padding: 14,
                        borderWidth: 1,
                        borderColor: COLORS.border,
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <View style={{ gap: 3 }}>
                        <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 14, color: COLORS.text }}>
                          Mesa {mesa.numero}
                        </Text>
                        <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 12, color: COLORS.textSecondary }}>
                          Tempo médio: {mesa.tempo_medio_min}min
                        </Text>
                        <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 12, color: COLORS.textSecondary }}>
                          Rotatividade: {mesa.rotatividade}x
                        </Text>
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 11, color: COLORS.textSecondary }}>
                          Ticket médio
                        </Text>
                        <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 15, color: COLORS.primary }}>
                          {ticketStr}
                        </Text>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          </View>
        )}

        {/* GARCONS TAB */}
        {activeTab === "garcons" && (
          <View>
            <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 18, color: COLORS.text, marginBottom: 12 }}>
              Desempenho dos Garçons
            </Text>
            <View style={{ gap: 8 }}>
              {loading ? (
                [0, 1, 2].map((i) => (
                  <View key={i} style={{ backgroundColor: COLORS.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: COLORS.border, gap: 8 }}>
                    <SkeletonLine width="40%" height={14} />
                    <SkeletonLine width="70%" height={12} />
                  </View>
                ))
              ) : garcons.length === 0 ? (
                <View style={{ backgroundColor: COLORS.surface, borderRadius: 12, padding: 24, alignItems: "center", borderWidth: 1, borderColor: COLORS.border }}>
                  <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 14, color: COLORS.textSecondary }}>
                    Sem dados para o período
                  </Text>
                </View>
              ) : (
                garcons.map((g) => {
                  const fat = formatCurrency(g.faturamento);
                  return (
                    <View
                      key={g.nome}
                      style={{
                        backgroundColor: COLORS.surface,
                        borderRadius: 12,
                        padding: 14,
                        borderWidth: 1,
                        borderColor: COLORS.border,
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <View style={{ gap: 3 }}>
                        <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 14, color: COLORS.text }}>
                          {g.nome}
                        </Text>
                        <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 12, color: COLORS.textSecondary }}>
                          {g.total_pedidos} pedidos
                        </Text>
                      </View>
                      <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 15, color: COLORS.primary }}>
                        {fat}
                      </Text>
                    </View>
                  );
                })
              )}
            </View>
          </View>
        )}

        {/* PEDIDOS TAB */}
        {activeTab === "pedidos" && (
          <>
            <View>
              <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 18, color: COLORS.text, marginBottom: 12 }}>
                Pedidos por Período
              </Text>
              <View
                style={{
                  backgroundColor: COLORS.surface,
                  borderRadius: 16,
                  padding: 16,
                  borderWidth: 1,
                  borderColor: COLORS.border,
                  gap: 10,
                }}
              >
                {loading ? (
                  [0, 1, 2, 3].map((i) => <SkeletonLine key={i} width="100%" height={24} />)
                ) : periodos.length === 0 ? (
                  <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 14, color: COLORS.textSecondary, textAlign: "center" }}>
                    Sem dados para o período
                  </Text>
                ) : (
                  periodos.map((p) => {
                    const barW = Math.max(4, Math.round((p.total / maxPeriodo) * 100));
                    return (
                      <View key={p.hora} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                        <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 12, color: COLORS.textSecondary, width: 40 }}>
                          {p.hora}
                        </Text>
                        <View style={{ flex: 1, height: 20, backgroundColor: COLORS.surfaceSecondary, borderRadius: 4 }}>
                          <View
                            style={{
                              height: 20,
                              width: `${barW}%` as `${number}%`,
                              backgroundColor: COLORS.primary,
                              borderRadius: 4,
                            }}
                          />
                        </View>
                        <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 12, color: COLORS.text, width: 28, textAlign: "right" }}>
                          {p.total}
                        </Text>
                      </View>
                    );
                  })
                )}
              </View>
            </View>

            <View>
              <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 18, color: COLORS.text, marginBottom: 12 }}>
                Pedidos Cancelados
              </Text>
              <View style={{ gap: 8 }}>
                {loading ? (
                  [0, 1].map((i) => (
                    <View key={i} style={{ backgroundColor: COLORS.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: COLORS.border, gap: 8 }}>
                      <SkeletonLine width="40%" height={14} />
                      <SkeletonLine width="70%" height={12} />
                    </View>
                  ))
                ) : cancelados.length === 0 ? (
                  <View style={{ backgroundColor: COLORS.surface, borderRadius: 12, padding: 24, alignItems: "center", borderWidth: 1, borderColor: COLORS.border }}>
                    <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 14, color: COLORS.textSecondary }}>
                      Nenhum pedido cancelado no período
                    </Text>
                  </View>
                ) : (
                  cancelados.map((p) => (
                    <View
                      key={p.id}
                      style={{
                        backgroundColor: COLORS.surface,
                        borderRadius: 12,
                        padding: 14,
                        borderWidth: 1,
                        borderColor: COLORS.border,
                        gap: 4,
                      }}
                    >
                      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                        <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 14, color: COLORS.text }}>
                          Mesa {p.mesa}
                        </Text>
                        <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 12, color: COLORS.textSecondary }}>
                          {p.garcom}
                        </Text>
                      </View>
                      {p.motivo ? (
                        <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 12, color: COLORS.danger }}>
                          {p.motivo}
                        </Text>
                      ) : null}
                    </View>
                  ))
                )}
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}
