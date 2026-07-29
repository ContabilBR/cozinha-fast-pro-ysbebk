// force rebuild v2
import React, { useState, useEffect } from "react";
import { View, Text, ScrollView, Pressable, Alert, ActivityIndicator, TextInput, Image } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { apiGet, apiPost } from "@/utils/api";
import { formatCurrency } from "@/utils/helpers";

const FORMAS = [
  { key: "dinheiro", label: "Dinheiro", icon: "cash-outline" },
  { key: "pix", label: "Pix", icon: "qr-code-outline" },
  { key: "cartao_credito", label: "Crédito", icon: "card-outline" },
  { key: "cartao_debito", label: "Débito", icon: "card-outline" },
];

export default function PagamentoScreen() {
  const COLORS = useColors();
  const router = useRouter();
  const { id, valor: valorParam } = useLocalSearchParams<{ id: string; valor?: string }>();
  const insets = useSafeAreaInsets();
  const [forma, setForma] = useState("dinheiro");
  const [valor, setValor] = useState(valorParam || "");
  const [troco, setTroco] = useState("0");
  const [saving, setSaving] = useState(false);
  const [pixData, setPixData] = useState<any>(null);
  const [pagamentos, setPagamentos] = useState<any[]>([]);
  const [totalComanda, setTotalComanda] = useState(0);
  const [totalPago, setTotalPago] = useState(0);

  useEffect(() => {
    console.log("[PagamentoScreen] Fetching pagamentos for comanda:", id);
    apiGet("/api/comandas/" + id + "/pagamentos").then((d: any) => {
      console.log("[PagamentoScreen] Pagamentos loaded:", d);
      setPagamentos(d.pagamentos || []);
      setTotalPago(d.total_pago || 0);
    }).catch((err) => { console.log("[PagamentoScreen] Error fetching pagamentos:", err); });
    console.log("[PagamentoScreen] Fetching comanda:", id);
    apiGet("/api/comandas/" + id).then((d: any) => {
      console.log("[PagamentoScreen] Comanda loaded:", d);
      const t = parseFloat(d.comanda?.total || d.total || "0");
      setTotalComanda(t);
      if (!valorParam) setValor(t.toFixed(2));
    }).catch((err) => { console.log("[PagamentoScreen] Error fetching comanda:", err); });
  }, [id, valorParam]);

  const restante = totalComanda - totalPago;

  const submit = async () => {
    const v = parseFloat(valor.replace(",", "."));
    if (!v || v <= 0) return Alert.alert("Erro", "Informe o valor");
    console.log("[PagamentoScreen] Registering payment:", { forma, valor: v, comanda: id });
    setSaving(true);
    try {
      const res = await apiPost("/api/comandas/" + id + "/pagamentos", {
        forma_pagamento: forma, valor: v, troco: forma === "dinheiro" ? parseFloat(troco.replace(",", ".")) || 0 : 0,
      });
      console.log("[PagamentoScreen] Payment registered:", res);
      if (forma === "pix" && res.pagamento?.pixQrCodeBase64) {
        setPixData(res.pagamento);
      } else {
        Alert.alert("Pagamento registrado", formatCurrency(v) + " em " + FORMAS.find(f => f.key === forma)?.label);
        router.back();
      }
    } catch (err: any) {
      console.log("[PagamentoScreen] Error registering payment:", err);
      Alert.alert("Erro", err?.message || "Erro ao registrar pagamento");
    } finally { setSaving(false); }
  };

  const inputStyle = { backgroundColor: COLORS.surface, borderRadius: 10, borderWidth: 0.5, borderColor: COLORS.surfaceSecondary, padding: 12, fontSize: 16, color: COLORS.text };

  if (pixData) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.background }}>
        <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: 8, flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Pressable onPress={() => { console.log("[PagamentoScreen] Back pressed from Pix screen"); router.back(); }}><Ionicons name="arrow-back" size={24} color={COLORS.text} /></Pressable>
          <Text style={{ fontSize: 20, fontWeight: "700", color: COLORS.text }}>Pix QR Code</Text>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, alignItems: "center" }}>
          <View style={{ backgroundColor: COLORS.surface, borderRadius: 16, padding: 24, alignItems: "center", borderWidth: 0.5, borderColor: COLORS.surfaceSecondary, width: "100%" }}>
            <Image source={{ uri: "data:image/png;base64," + pixData.pixQrCodeBase64 }} style={{ width: 220, height: 220, borderRadius: 12 }} />
            <Text style={{ fontSize: 13, color: COLORS.textSecondary, marginTop: 16, textAlign: "center" }}>Escaneie o QR Code ou copie o código abaixo</Text>
            <View style={{ backgroundColor: COLORS.surfaceSecondary, borderRadius: 8, padding: 12, marginTop: 12, width: "100%" }}>
              <Text style={{ fontSize: 11, color: COLORS.textSecondary, textAlign: "center" }} numberOfLines={3}>{pixData.pixQrCode || "Código Pix"}</Text>
            </View>
            <Text style={{ fontSize: 28, fontWeight: "700", color: COLORS.primary, marginTop: 16 }}>{formatCurrency(parseFloat(pixData.valor))}</Text>
            <Text style={{ fontSize: 13, color: COLORS.textSecondary, marginTop: 4 }}>Aguardando confirmação...</Text>
          </View>
          <Pressable onPress={() => { console.log("[PagamentoScreen] Back to comanda pressed from Pix screen"); router.back(); }} style={{ marginTop: 20, backgroundColor: COLORS.primary, borderRadius: 12, padding: 16, width: "100%", alignItems: "center" }}>
            <Text style={{ color: "white", fontSize: 16, fontWeight: "600" }}>Voltar para comanda</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: 8, flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Pressable onPress={() => { console.log("[PagamentoScreen] Back pressed"); router.back(); }}><Ionicons name="arrow-back" size={24} color={COLORS.text} /></Pressable>
        <Text style={{ fontSize: 20, fontWeight: "700", color: COLORS.text }}>Pagamento</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
        <View style={{ backgroundColor: COLORS.surface, borderRadius: 12, padding: 14, borderWidth: 0.5, borderColor: COLORS.surfaceSecondary, marginBottom: 16 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}><Text style={{ fontSize: 13, color: COLORS.textSecondary }}>Total da comanda</Text><Text style={{ fontSize: 13, color: COLORS.text }}>{formatCurrency(totalComanda)}</Text></View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}><Text style={{ fontSize: 13, color: COLORS.textSecondary }}>Já pago</Text><Text style={{ fontSize: 13, color: "#22C55E" }}>{formatCurrency(totalPago)}</Text></View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", paddingTop: 8, borderTopWidth: 0.5, borderTopColor: COLORS.surfaceSecondary }}><Text style={{ fontSize: 16, fontWeight: "600", color: COLORS.text }}>Restante</Text><Text style={{ fontSize: 16, fontWeight: "600", color: COLORS.primary }}>{formatCurrency(restante)}</Text></View>
        </View>

        <Text style={{ fontSize: 12, fontWeight: "600", color: COLORS.primary, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>Forma de pagamento</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
          {FORMAS.map(f => (
            <Pressable key={f.key} onPress={() => { console.log("[PagamentoScreen] Payment method selected:", f.key); setForma(f.key); }} style={{ flex: 1, minWidth: "45%", backgroundColor: forma === f.key ? COLORS.primary : COLORS.surface, borderRadius: 12, padding: 14, alignItems: "center", borderWidth: 0.5, borderColor: forma === f.key ? COLORS.primary : COLORS.surfaceSecondary }}>
              <Ionicons name={f.icon as any} size={24} color={forma === f.key ? "white" : COLORS.textSecondary} />
              <Text style={{ fontSize: 13, fontWeight: "500", color: forma === f.key ? "white" : COLORS.text, marginTop: 6 }}>{f.label}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={{ fontSize: 12, fontWeight: "600", color: COLORS.primary, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Valor</Text>
        <TextInput value={valor} onChangeText={setValor} keyboardType="decimal-pad" placeholder="0,00" placeholderTextColor={COLORS.textTertiary} style={{ ...inputStyle, marginBottom: 12, fontSize: 24, textAlign: "center", fontWeight: "600" }} />

        {forma === "dinheiro" && (
          <><Text style={{ fontSize: 12, fontWeight: "600", color: COLORS.primary, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Troco para</Text>
          <TextInput value={troco} onChangeText={setTroco} keyboardType="decimal-pad" placeholder="0,00" placeholderTextColor={COLORS.textTertiary} style={{ ...inputStyle, marginBottom: 12 }} /></>
        )}

        {pagamentos.length > 0 && (
          <View style={{ marginTop: 8, marginBottom: 16 }}>
            <Text style={{ fontSize: 12, fontWeight: "600", color: COLORS.primary, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Pagamentos anteriores</Text>
            {pagamentos.map((p: any, i: number) => (
              <View key={p.id || i} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 }}>
                <Text style={{ fontSize: 13, color: COLORS.textSecondary }}>{p.formaPagamento || p.forma_pagamento}</Text>
                <Text style={{ fontSize: 13, color: p.status === "confirmado" ? "#22C55E" : "#F59E0B", fontWeight: "500" }}>{formatCurrency(parseFloat(p.valor))} {p.status === "pendente" ? "(pendente)" : ""}</Text>
              </View>
            ))}
          </View>
        )}

        <Pressable onPress={submit} disabled={saving} style={{ backgroundColor: saving ? COLORS.textTertiary : COLORS.primary, borderRadius: 12, padding: 16, alignItems: "center", marginTop: 8 }}>
          {saving ? <ActivityIndicator color="white" /> : <Text style={{ color: "white", fontSize: 16, fontWeight: "600" }}>{forma === "pix" ? "Gerar QR Code Pix" : "Registrar pagamento"}</Text>}
        </Pressable>
      </ScrollView>
    </View>
  );
}
