import React, { useState, useCallback } from "react";
import { View, Text, FlatList, Pressable, RefreshControl, ActivityIndicator, Modal, TextInput, Alert, ScrollView } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { apiGet, apiPost, apiDelete } from "@/utils/api";

const STATUS_CFG: Record<string, { label: string; bg: string; text: string; icon: string }> = {
  pendente: { label: "Pendente", bg: "#FEF3C7", text: "#92400E", icon: "time-outline" },
  processando: { label: "Processando", bg: "#DBEAFE", text: "#1E40AF", icon: "sync-outline" },
  autorizada: { label: "Autorizada", bg: "#D1FAE5", text: "#065F46", icon: "checkmark-circle-outline" },
  rejeitada: { label: "Rejeitada", bg: "#FEE2E2", text: "#991B1B", icon: "close-circle-outline" },
  cancelada: { label: "Cancelada", bg: "#F3F4F6", text: "#6B7280", icon: "ban-outline" },
  erro: { label: "Erro", bg: "#FEE2E2", text: "#991B1B", icon: "alert-circle-outline" },
};

const DEFAULTS_FISCAIS = {
  ncm: "21069090", cfop: "5102",
  icms_situacao_tributaria: "102", pis_situacao_tributaria: "49", cofins_situacao_tributaria: "49",
};

interface Nota { id: string; referenciaFocus?: string; referencia_focus?: string; status: string; chaveAcesso?: string; chave_acesso?: string; numeroNota?: number; numero_nota?: number; serie?: number; mensagemSefaz?: string; mensagem_sefaz?: string; createdAt?: string; created_at?: string; }
interface ComandaHistorico { id: string; mesa_numero?: number; garcom_nome?: string; total: string; closed_at?: string; pedidos: Array<{ id: string; prato_nome?: string; quantidade: number; preco_unitario: string }>; }

export default function FiscalScreen() {
  const COLORS = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [notas, setNotas] = useState<Nota[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showEmitir, setShowEmitir] = useState(false);
  const [comandas, setComandas] = useState<ComandaHistorico[]>([]);
  const [loadingComandas, setLoadingComandas] = useState(false);
  const [selectedComanda, setSelectedComanda] = useState<ComandaHistorico | null>(null);
  const [cpfConsumidor, setCpfConsumidor] = useState("");
  const [emitindo, setEmitindo] = useState(false);
  const [showCancelar, setShowCancelar] = useState(false);
  const [notaCancelar, setNotaCancelar] = useState<Nota | null>(null);
  const [justificativa, setJustificativa] = useState("");
  const [cancelando, setCancelando] = useState(false);

  const fetchNotas = useCallback(async () => {
    try { const res = await apiGet<any>("/api/fiscal/notas"); setNotas(res.notas || []); } catch (e) { console.error("Erro:", e); } finally { setLoading(false); setRefreshing(false); }
  }, []);
  useFocusEffect(useCallback(() => { setLoading(true); fetchNotas(); }, [fetchNotas]));

  const getRef = (n: Nota) => n.referenciaFocus || n.referencia_focus || "";
  const getChave = (n: Nota) => n.chaveAcesso || n.chave_acesso || "";
  const getNumero = (n: Nota) => n.numeroNota || n.numero_nota;
  const getMsg = (n: Nota) => n.mensagemSefaz || n.mensagem_sefaz;
  const getDate = (n: Nota) => n.createdAt || n.created_at || "";
  const fmt = (v: string | number) => "R$ " + parseFloat(String(v)).toFixed(2).replace(".", ",");

  const openEmitir = async () => { setShowEmitir(true); setSelectedComanda(null); setCpfConsumidor(""); setLoadingComandas(true); try { const res = await apiGet<any>("/api/historico"); setComandas(Array.isArray(res) ? res : (res.historico || [])); } catch (e) { Alert.alert("Erro", "Não foi possível carregar comandas"); setShowEmitir(false); } finally { setLoadingComandas(false); } };
  const handleEmitir = async () => { if (!selectedComanda || !selectedComanda.pedidos?.length) { Alert.alert("Erro", "Comanda sem itens"); return; } setEmitindo(true); try { const itens = selectedComanda.pedidos.map((p) => ({ descricao: p.prato_nome || "Item", quantidade: p.quantidade, valor_unitario: parseFloat(p.preco_unitario), ...DEFAULTS_FISCAIS })); const body: any = { comanda_historico_id: selectedComanda.id, itens }; if (cpfConsumidor.trim().length >= 11) body.cpf_consumidor = cpfConsumidor.replace(/\D/g, ""); const res = await apiPost<any>("/api/fiscal/nfce", body); setShowEmitir(false); fetchNotas(); const status = res.nota_fiscal?.status || "processando"; if (status === "autorizada") Alert.alert("Sucesso", "NFC-e autorizada!"); else if (status === "rejeitada" || status === "erro") Alert.alert("Atenção", "NFC-e " + status); else Alert.alert("Enviado", "NFC-e em processamento."); } catch (e: any) { Alert.alert("Erro", e.message || "Erro ao emitir"); } finally { setEmitindo(false); } };
  const atualizarStatus = async (nota: Nota) => { try { await apiGet<any>("/api/fiscal/nfce/" + getRef(nota)); fetchNotas(); Alert.alert("Atualizado", "Status atualizado"); } catch (e: any) { Alert.alert("Erro", e.message || "Erro"); } };
  const openCancelar = (nota: Nota) => { setNotaCancelar(nota); setJustificativa(""); setShowCancelar(true); };
  const handleCancelar = async () => { if (!notaCancelar || justificativa.length < 15) { Alert.alert("Atenção", "Justificativa mínima: 15 caracteres"); return; } setCancelando(true); try { await apiDelete<any>("/api/fiscal/nfce/" + getRef(notaCancelar), { justificativa }); setShowCancelar(false); fetchNotas(); Alert.alert("Sucesso", "NFC-e cancelada"); } catch (e: any) { Alert.alert("Erro", e.message || "Erro"); } finally { setCancelando(false); } };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: 8, flexDirection: "row", alignItems: "center" }}>
        <Pressable onPress={() => router.back()} style={{ marginRight: 10 }}><Ionicons name="arrow-back" size={24} color={COLORS.text} /></Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 22, fontWeight: "700", color: COLORS.text }}>Notas Fiscais</Text>
          <Text style={{ fontSize: 13, color: COLORS.textSecondary, marginTop: 2 }}>{notas.length} nota{notas.length !== 1 ? "s" : ""}</Text>
        </View>
        <Pressable onPress={openEmitir} style={{ backgroundColor: "#22C55E", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Ionicons name="add" size={18} color="white" /><Text style={{ color: "white", fontWeight: "700", fontSize: 14 }}>Emitir</Text>
        </Pressable>
      </View>
      {loading ? <View style={{ padding: 16 }}><ActivityIndicator size="large" color={COLORS.primary} /></View> : (
        <FlatList data={notas} keyExtractor={(n) => n.id} contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchNotas(); }} tintColor={COLORS.primary} />}
          renderItem={({ item }) => { const s = STATUS_CFG[item.status] || STATUS_CFG.pendente; return (
            <View style={{ backgroundColor: COLORS.surface, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 0.5, borderColor: COLORS.border }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><Ionicons name={s.icon as any} size={16} color={s.text} /><Text style={{ fontSize: 15, fontWeight: "600", color: COLORS.text }}>#{getRef(item).slice(-8)}</Text></View>
                <View style={{ backgroundColor: s.bg, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 }}><Text style={{ fontSize: 11, fontWeight: "600", color: s.text }}>{s.label}</Text></View>
              </View>
              {getNumero(item) ? <Text style={{ fontSize: 12, color: COLORS.textSecondary, marginTop: 6 }}>Nota nº {getNumero(item)} • Série {item.serie}</Text> : null}
              {getChave(item) ? <Text style={{ fontSize: 10, color: COLORS.textSecondary, marginTop: 2 }} numberOfLines={1}>Chave: {getChave(item)}</Text> : null}
              <Text style={{ fontSize: 11, color: COLORS.textSecondary, marginTop: 4 }}>{new Date(getDate(item)).toLocaleString("pt-BR")}</Text>
              {getMsg(item) ? <Text style={{ fontSize: 11, color: COLORS.textSecondary, marginTop: 2 }}>{getMsg(item)}</Text> : null}
              <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                {item.status === "processando" && <Pressable onPress={() => atualizarStatus(item)} style={{ flex: 1, backgroundColor: "#DBEAFE", borderRadius: 8, paddingVertical: 8, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 4 }}><Ionicons name="sync-outline" size={14} color="#1E40AF" /><Text style={{ fontSize: 12, fontWeight: "600", color: "#1E40AF" }}>Atualizar</Text></Pressable>}
                {item.status === "autorizada" && <Pressable onPress={() => openCancelar(item)} style={{ flex: 1, backgroundColor: "#FEE2E2", borderRadius: 8, paddingVertical: 8, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 4 }}><Ionicons name="close-circle-outline" size={14} color="#991B1B" /><Text style={{ fontSize: 12, fontWeight: "600", color: "#991B1B" }}>Cancelar</Text></Pressable>}
              </View>
            </View>); }}
          ListEmptyComponent={<View style={{ alignItems: "center", paddingTop: 60 }}><Ionicons name="document-text-outline" size={48} color={COLORS.textSecondary} /><Text style={{ fontSize: 16, color: COLORS.textSecondary, marginTop: 12 }}>Nenhuma nota fiscal</Text><Pressable onPress={openEmitir} style={{ marginTop: 16, backgroundColor: "#22C55E", borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 }}><Text style={{ color: "white", fontWeight: "700" }}>Emitir primeira NFC-e</Text></Pressable></View>}
        />
      )}
      {/* MODAL_EMITIR_PLACEHOLDER */}
      {/* MODAL_CANCELAR_PLACEHOLDER */}
    </View>
  );
}
