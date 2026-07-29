import React, { useState, useEffect } from "react";
import { View, Text, ScrollView, Pressable, Alert, ActivityIndicator, TextInput, Image } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { apiGet, apiPost } from "@/utils/api";
import { formatCurrency } from "@/utils/helpers";

const ETAPAS = ["resumo", "gorjeta", "divisao", "pagamento"] as const;
type Etapa = typeof ETAPAS[number];

const FORMAS = [
  { key: "dinheiro", label: "Dinheiro", icon: "cash-outline" as const },
  { key: "pix", label: "Pix", icon: "qr-code-outline" as const },
  { key: "cartao_credito", label: "Crédito", icon: "card-outline" as const },
  { key: "cartao_debito", label: "Débito", icon: "card-outline" as const },
];

export default function FecharContaScreen() {
  const COLORS = useColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [etapa, setEtapa] = useState<Etapa>("resumo");
  const [comanda, setComanda] = useState<any>(null);
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [gorjetaMode, setGorjetaMode] = useState<"none"|"10"|"custom">("none");
  const [gorjetaInput, setGorjetaInput] = useState("0");
  const [dividir, setDividir] = useState(false);
  const [numPessoas, setNumPessoas] = useState(2);
  const [divisaoResult, setDivisaoResult] = useState<any>(null);
  const [forma, setForma] = useState("dinheiro");
  const [trocoInput, setTrocoInput] = useState("0");
  const [saving, setSaving] = useState(false);
  const [pixData, setPixData] = useState<any>(null);
  const [pagamentos, setPagamentos] = useState<any[]>([]);
  const [totalPago, setTotalPago] = useState(0);
  const [pessoaAtual, setPessoaAtual] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const c = await apiGet<any>("/api/comandas/" + id);
        setComanda(c);
        setPedidos(c.pedidos || []);
        const pag = await apiGet<any>("/api/comandas/" + id + "/pagamentos");
        setPagamentos(pag.pagamentos || []);
        setTotalPago(pag.total_pago || 0);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    fetchData();
  }, [id]);

  const subtotal = pedidos.reduce((s: number, p: any) => s + parseFloat(p.precoUnitario || p.preco_unitario || "0") * (p.quantidade || 1), 0);
  const gorjetaValue = gorjetaMode === "10" ? subtotal * 0.1 : gorjetaMode === "custom" ? Math.max(0, parseFloat(gorjetaInput.replace(",", ".")) || 0) : 0;
  const totalFinal = subtotal + gorjetaValue;
  const restante = totalFinal - totalPago;
  const valorPorPessoa = dividir && numPessoas > 1 ? Math.ceil(restante / numPessoas * 100) / 100 : restante;
  const valorPessoaAtual = dividir && divisaoResult?.divisao ? (divisaoResult.divisao[pessoaAtual]?.total_a_pagar || divisaoResult.divisao[pessoaAtual]?.valor || valorPorPessoa) : restante;

  const selectGorjeta = (mode: "none"|"10"|"custom") => {
    setGorjetaMode(mode);
    if (mode === "none") setGorjetaInput("0");
    if (mode === "10") setGorjetaInput((subtotal * 0.1).toFixed(2).replace(".", ","));
  };

  const calcularDivisao = async () => {
    try {
      const res = await apiPost("/api/comandas/" + id + "/divisao", { tipo: "igual", num_pessoas: numPessoas, gorjeta: gorjetaValue });
      setDivisaoResult(res);
    } catch (err: any) { Alert.alert("Erro", err?.message || "Erro ao calcular"); }
  };

  const refreshPagamentos = async () => {
    try {
      const pag = await apiGet<any>("/api/comandas/" + id + "/pagamentos");
      setPagamentos(pag.pagamentos || []);
      setTotalPago(pag.total_pago || 0);
    } catch (err) {}
  };

  const registrarPagamento = async (valor: number) => {
    setSaving(true);
    try {
      const res = await apiPost("/api/comandas/" + id + "/pagamentos", {
        forma_pagamento: forma, valor, troco: forma === "dinheiro" ? parseFloat(trocoInput.replace(",", ".")) || 0 : 0,
      });
      if (forma === "pix" && res.pagamento?.pixQrCodeBase64) {
        setPixData(res.pagamento);
      } else {
        await refreshPagamentos();
        if (dividir && pessoaAtual < numPessoas - 1) {
          setPessoaAtual(pessoaAtual + 1);
          setForma("dinheiro");
          Alert.alert("OK", "Pessoa " + (pessoaAtual + 1) + " pagou " + formatCurrency(valor));
        } else { await fecharComanda(); }
      }
    } catch (err: any) { Alert.alert("Erro", err?.message || "Erro"); }
    finally { setSaving(false); }
  };

  const fecharComanda = async () => {
    try {
      await apiPost("/api/comandas/" + id + "/fechar", { gorjeta: gorjetaValue });
      Alert.alert("Conta fechada!", "Comanda encerrada.", [{ text: "OK", onPress: () => router.back() }]);
    } catch (err: any) {
      if (err?.message?.includes("pendente")) {
        Alert.alert("Aguardando Pix", "Confirme o Pix pendente antes de fechar.");
      } else {
        Alert.alert("Registrado!", "Volte para fechar quando pronto.", [{ text: "OK", onPress: () => router.back() }]);
      }
    }
  };

  const voltarDoPix = async () => { setPixData(null); await refreshPagamentos(); if (dividir && pessoaAtual < numPessoas - 1) setPessoaAtual(pessoaAtual + 1); };
  const etapaAnterior = () => { const idx = ETAPAS.indexOf(etapa); if (idx > 0) setEtapa(ETAPAS[idx - 1]); else router.back(); };

  const cardStyle = { backgroundColor: COLORS.surface, borderRadius: 12, padding: 14, borderWidth: 0.5, borderColor: COLORS.surfaceSecondary, marginBottom: 12 };
  const labelStyle = { fontSize: 12, fontWeight: "600" as const, color: COLORS.primary, marginBottom: 8, textTransform: "uppercase" as const, letterSpacing: 0.5 };
  const btnPrimary = { backgroundColor: COLORS.primary, borderRadius: 12, padding: 16, alignItems: "center" as const };

  if (loading) return <View style={{ flex: 1, backgroundColor: COLORS.background, justifyContent: "center", alignItems: "center" }}><ActivityIndicator size="large" color={COLORS.primary} /></View>;

  if (pixData) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.background }}>
        <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: 8, flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Pressable onPress={voltarDoPix}><Ionicons name="arrow-back" size={24} color={COLORS.text} /></Pressable>
          <Text style={{ fontSize: 20, fontWeight: "700", color: COLORS.text }}>Pix QR Code</Text>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, alignItems: "center" }}>
          <View style={{ backgroundColor: COLORS.surface, borderRadius: 16, padding: 24, alignItems: "center", borderWidth: 0.5, borderColor: COLORS.surfaceSecondary, width: "100%" }}>
            {pixData.pixQrCodeBase64 ? <Image source={{ uri: "data:image/png;base64," + pixData.pixQrCodeBase64 }} style={{ width: 220, height: 220, borderRadius: 12 }} /> : <Ionicons name="qr-code" size={120} color={COLORS.primary} />}
            <Text style={{ fontSize: 13, color: COLORS.textSecondary, marginTop: 16, textAlign: "center" }}>Escaneie o QR Code ou copie o código</Text>
            <View style={{ backgroundColor: COLORS.surfaceSecondary, borderRadius: 8, padding: 12, marginTop: 12, width: "100%" }}>
              <Text style={{ fontSize: 11, color: COLORS.textSecondary, textAlign: "center" }} numberOfLines={3}>{pixData.pixQrCode || "Código Pix"}</Text>
            </View>
            <Text style={{ fontSize: 28, fontWeight: "700", color: COLORS.primary, marginTop: 16 }}>{formatCurrency(parseFloat(pixData.valor))}</Text>
            {dividir && <Text style={{ fontSize: 14, color: COLORS.textSecondary, marginTop: 4 }}>Pessoa {pessoaAtual + 1} de {numPessoas}</Text>}
            <Text style={{ fontSize: 13, color: COLORS.textSecondary, marginTop: 4 }}>Aguardando confirmação...</Text>
          </View>
          <Pressable onPress={voltarDoPix} style={{ ...btnPrimary, width: "100%", marginTop: 12 }}>
            <Text style={{ color: "white", fontSize: 16, fontWeight: "600" }}>{dividir && pessoaAtual < numPessoas - 1 ? "Próxima pessoa" : "Continuar"}</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: 8, flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Pressable onPress={etapaAnterior}><Ionicons name="arrow-back" size={24} color={COLORS.text} /></Pressable>
        <Text style={{ fontSize: 20, fontWeight: "700", color: COLORS.text }}>Fechar conta</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
        <View style={{ flexDirection: "row", justifyContent: "center", gap: 8, marginBottom: 16 }}>
          {ETAPAS.map((e, i) => (
            <View key={e} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: ETAPAS.indexOf(etapa) >= i ? COLORS.primary : COLORS.surfaceSecondary, justifyContent: "center", alignItems: "center" }}>
                {ETAPAS.indexOf(etapa) > i ? <Ionicons name="checkmark" size={16} color="white" /> : <Text style={{ fontSize: 12, fontWeight: "600", color: ETAPAS.indexOf(etapa) >= i ? "white" : COLORS.textTertiary }}>{i + 1}</Text>}
              </View>
              {i < ETAPAS.length - 1 && <View style={{ width: 20, height: 2, backgroundColor: ETAPAS.indexOf(etapa) > i ? COLORS.primary : COLORS.surfaceSecondary }} />}
            </View>
          ))}
        </View>

        {etapa === "resumo" && (<>
          <View style={cardStyle}>
            <Text style={labelStyle}>Itens do pedido</Text>
            {pedidos.filter((p: any) => p.status !== "cancelado").map((p: any, i: number) => (
              <View key={p.id || i} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: i < pedidos.length - 1 ? 0.5 : 0, borderBottomColor: COLORS.surfaceSecondary }}>
                <Text style={{ fontSize: 14, color: COLORS.text, flex: 1 }}>{p.quantidade}x {p.pratoNome || p.prato_nome || "Item"}</Text>
                <Text style={{ fontSize: 14, fontWeight: "500", color: COLORS.text }}>{formatCurrency(parseFloat(p.precoUnitario || p.preco_unitario || "0") * (p.quantidade || 1))}</Text>
              </View>
            ))}
          </View>
          <View style={{ ...cardStyle, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ fontSize: 18, fontWeight: "600", color: COLORS.text }}>Subtotal</Text>
            <Text style={{ fontSize: 18, fontWeight: "700", color: COLORS.primary }}>{formatCurrency(subtotal)}</Text>
          </View>
          <Pressable onPress={() => setEtapa("gorjeta")} style={btnPrimary}><Text style={{ color: "white", fontSize: 16, fontWeight: "600" }}>Próximo: Gorjeta</Text></Pressable>
        </>)}

        {etapa === "gorjeta" && (<>
          <View style={{ ...cardStyle, alignItems: "center" }}>
            <Text style={{ fontSize: 13, color: COLORS.textSecondary }}>Subtotal</Text>
            <Text style={{ fontSize: 24, fontWeight: "700", color: COLORS.text }}>{formatCurrency(subtotal)}</Text>
          </View>
          <Text style={labelStyle}>Gorjeta</Text>
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
            {[{ mode: "none" as const, label: "Sem gorjeta" }, { mode: "10" as const, label: "10%" }, { mode: "custom" as const, label: "Outro" }].map((opt) => (
              <Pressable key={opt.mode} onPress={() => selectGorjeta(opt.mode)} style={{ flex: 1, backgroundColor: gorjetaMode === opt.mode ? COLORS.primary : COLORS.surface, borderRadius: 10, padding: 12, alignItems: "center", borderWidth: 0.5, borderColor: gorjetaMode === opt.mode ? COLORS.primary : COLORS.surfaceSecondary }}>
                <Text style={{ fontSize: 13, fontWeight: "500", color: gorjetaMode === opt.mode ? "white" : COLORS.text }}>{opt.label}</Text>
                {opt.mode === "10" && <Text style={{ fontSize: 11, color: gorjetaMode === opt.mode ? "rgba(255,255,255,0.7)" : COLORS.textTertiary, marginTop: 2 }}>{formatCurrency(subtotal * 0.1)}</Text>}
              </Pressable>
            ))}
          </View>
          {gorjetaMode === "custom" && <TextInput value={gorjetaInput} onChangeText={setGorjetaInput} keyboardType="decimal-pad" placeholder="Valor" placeholderTextColor={COLORS.textTertiary} style={{ backgroundColor: COLORS.surface, borderRadius: 10, borderWidth: 0.5, borderColor: COLORS.surfaceSecondary, padding: 12, fontSize: 20, color: COLORS.text, textAlign: "center", fontWeight: "600", marginBottom: 16 }} />}
          <View style={{ ...cardStyle, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View><Text style={{ fontSize: 13, color: COLORS.textSecondary }}>Total com gorjeta</Text>{gorjetaValue > 0 && <Text style={{ fontSize: 12, color: COLORS.textSecondary }}>Gorjeta: {formatCurrency(gorjetaValue)}</Text>}</View>
            <Text style={{ fontSize: 22, fontWeight: "700", color: COLORS.primary }}>{formatCurrency(totalFinal)}</Text>
          </View>
          <Pressable onPress={async () => { if (gorjetaValue > 0) { try { await apiPost("/api/comandas/" + id + "/gorjeta", { gorjeta: gorjetaValue }); } catch(e) {} } setEtapa("divisao"); }} style={btnPrimary}><Text style={{ color: "white", fontSize: 16, fontWeight: "600" }}>Próximo: Divisão</Text></Pressable>
        </>)}

        {etapa === "divisao" && (<>
          <View style={{ ...cardStyle, alignItems: "center" }}>
            <Text style={{ fontSize: 13, color: COLORS.textSecondary }}>Total a pagar</Text>
            <Text style={{ fontSize: 24, fontWeight: "700", color: COLORS.primary }}>{formatCurrency(totalFinal)}</Text>
          </View>
          <Text style={labelStyle}>Dividir a conta?</Text>
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
            <Pressable onPress={() => { setDividir(false); setDivisaoResult(null); }} style={{ flex: 1, backgroundColor: !dividir ? COLORS.primary : COLORS.surface, borderRadius: 12, padding: 14, alignItems: "center", borderWidth: 0.5, borderColor: !dividir ? COLORS.primary : COLORS.surfaceSecondary }}>
              <Ionicons name="person-outline" size={24} color={!dividir ? "white" : COLORS.textSecondary} />
              <Text style={{ fontSize: 13, fontWeight: "500", color: !dividir ? "white" : COLORS.text, marginTop: 6 }}>Uma pessoa</Text>
            </Pressable>
            <Pressable onPress={() => setDividir(true)} style={{ flex: 1, backgroundColor: dividir ? COLORS.primary : COLORS.surface, borderRadius: 12, padding: 14, alignItems: "center", borderWidth: 0.5, borderColor: dividir ? COLORS.primary : COLORS.surfaceSecondary }}>
              <Ionicons name="people-outline" size={24} color={dividir ? "white" : COLORS.textSecondary} />
              <Text style={{ fontSize: 13, fontWeight: "500", color: dividir ? "white" : COLORS.text, marginTop: 6 }}>Dividir</Text>
            </Pressable>
          </View>
          {dividir && (<>
            <Text style={labelStyle}>Número de pessoas</Text>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 16, marginBottom: 16 }}>
              <Pressable onPress={() => setNumPessoas(Math.max(2, numPessoas - 1))} style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.surfaceSecondary, justifyContent: "center", alignItems: "center" }}><Ionicons name="remove" size={24} color={COLORS.text} /></Pressable>
              <Text style={{ fontSize: 36, fontWeight: "700", color: COLORS.text, minWidth: 50, textAlign: "center" }}>{numPessoas}</Text>
              <Pressable onPress={() => setNumPessoas(numPessoas + 1)} style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.primary, justifyContent: "center", alignItems: "center" }}><Ionicons name="add" size={24} color="white" /></Pressable>
            </View>
            <View style={{ ...cardStyle, alignItems: "center" }}>
              <Text style={{ fontSize: 13, color: COLORS.textSecondary }}>Valor por pessoa</Text>
              <Text style={{ fontSize: 28, fontWeight: "700", color: COLORS.primary }}>{formatCurrency(Math.ceil(totalFinal / numPessoas * 100) / 100)}</Text>
            </View>
          </>)}
          <Pressable onPress={() => { if (dividir) calcularDivisao(); setEtapa("pagamento"); }} style={btnPrimary}><Text style={{ color: "white", fontSize: 16, fontWeight: "600" }}>Próximo: Pagamento</Text></Pressable>
        </>)}

        {etapa === "pagamento" && (<>
          <View style={cardStyle}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}><Text style={{ fontSize: 13, color: COLORS.textSecondary }}>Total da comanda</Text><Text style={{ fontSize: 13, color: COLORS.text }}>{formatCurrency(totalFinal)}</Text></View>
            {gorjetaValue > 0 && <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}><Text style={{ fontSize: 13, color: COLORS.textSecondary }}>Gorjeta (no fechamento)</Text><Text style={{ fontSize: 13, color: COLORS.textSecondary }}>{formatCurrency(gorjetaValue)}</Text></View>}
            {gorjetaValue > 0 && <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}><Text style={{ fontSize: 13, color: COLORS.textSecondary }}>Gorjeta</Text><Text style={{ fontSize: 13, color: COLORS.text }}>{formatCurrency(gorjetaValue)}</Text></View>}
            {totalPago > 0 && <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}><Text style={{ fontSize: 13, color: "#22C55E" }}>Já pago</Text><Text style={{ fontSize: 13, color: "#22C55E" }}>{formatCurrency(totalPago)}</Text></View>}
            <View style={{ flexDirection: "row", justifyContent: "space-between", paddingTop: 8, borderTopWidth: 0.5, borderTopColor: COLORS.surfaceSecondary }}>
              <Text style={{ fontSize: 16, fontWeight: "600", color: COLORS.text }}>{dividir ? "Pessoa " + (pessoaAtual + 1) + "/" + numPessoas : "Restante"}</Text>
              <Text style={{ fontSize: 18, fontWeight: "700", color: COLORS.primary }}>{formatCurrency(dividir ? valorPessoaAtual : restante)}</Text>
            </View>
          </View>
          <Text style={labelStyle}>Forma de pagamento</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
            {FORMAS.map((f) => (
              <Pressable key={f.key} onPress={() => setForma(f.key)} style={{ flex: 1, minWidth: "45%", backgroundColor: forma === f.key ? COLORS.primary : COLORS.surface, borderRadius: 12, padding: 14, alignItems: "center", borderWidth: 0.5, borderColor: forma === f.key ? COLORS.primary : COLORS.surfaceSecondary }}>
                <Ionicons name={f.icon} size={24} color={forma === f.key ? "white" : COLORS.textSecondary} />
                <Text style={{ fontSize: 13, fontWeight: "500", color: forma === f.key ? "white" : COLORS.text, marginTop: 6 }}>{f.label}</Text>
              </Pressable>
            ))}
          </View>
          {forma === "dinheiro" && (<><Text style={labelStyle}>Troco para (R$)</Text><TextInput value={trocoInput} onChangeText={setTrocoInput} keyboardType="decimal-pad" placeholder="0,00" placeholderTextColor={COLORS.textTertiary} style={{ backgroundColor: COLORS.surface, borderRadius: 10, borderWidth: 0.5, borderColor: COLORS.surfaceSecondary, padding: 12, fontSize: 16, color: COLORS.text, marginBottom: 16 }} /></>)}
          {pagamentos.length > 0 && <View style={{ ...cardStyle, marginBottom: 16 }}><Text style={labelStyle}>Pagamentos registrados</Text>{pagamentos.map((p: any, i: number) => (<View key={p.id || i} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 }}><Text style={{ fontSize: 13, color: COLORS.textSecondary }}>{p.formaPagamento || p.forma_pagamento}</Text><Text style={{ fontSize: 13, color: p.status === "confirmado" ? "#22C55E" : "#F59E0B", fontWeight: "500" }}>{formatCurrency(parseFloat(p.valor))} {p.status === "pendente" ? "(pendente)" : "✓"}</Text></View>))}</View>}
          <Pressable onPress={() => registrarPagamento(dividir ? valorPessoaAtual : restante)} disabled={saving || restante <= 0} style={{ ...btnPrimary, backgroundColor: saving || restante <= 0 ? COLORS.textTertiary : forma === "pix" ? "#3B82F6" : COLORS.primary }}>
            {saving ? <ActivityIndicator color="white" /> : <Text style={{ color: "white", fontSize: 16, fontWeight: "600" }}>{restante <= 0 ? "Tudo pago" : (forma === "pix" ? "Gerar QR Pix" : "Pagar") + " " + formatCurrency(dividir ? valorPessoaAtual : restante)}</Text>}
          </Pressable>
          {restante <= 0 && <Pressable onPress={fecharComanda} style={{ ...btnPrimary, marginTop: 10, backgroundColor: "#22C55E" }}><Text style={{ color: "white", fontSize: 16, fontWeight: "600" }}>Fechar comanda</Text></Pressable>}
        </>)}
      </ScrollView>
    </View>
  );
}
