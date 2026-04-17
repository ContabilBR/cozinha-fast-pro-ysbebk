import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { useRouter, useLocalSearchParams, useNavigation, Stack } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { apiGet, apiPost } from "@/utils/api";
import { Minus, Plus, Users, X } from "lucide-react-native";

interface ApiMesa {
  id: string;
  number: number;
  capacity: number;
  status: string;
}

export default function NovaComandaScreen() {
  const COLORS = useColors();
  const router = useRouter();
  const navigation = useNavigation();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ mesa_id?: string }>();

  const [mesas, setMesas] = useState<ApiMesa[]>([]);
  const [selectedMesaId, setSelectedMesaId] = useState<string>(params.mesa_id ?? "");
  const [customerCount, setCustomerCount] = useState(2);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    navigation.setOptions({
      title: "Nova Comanda",
      headerTintColor: COLORS.primary,
      headerBackButtonDisplayMode: "minimal",
      headerRight: () => (
        <AnimatedPressable
          onPress={() => {
            console.log("[NovaComanda] Close button pressed");
            router.back();
          }}
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: COLORS.surfaceSecondary,
            alignItems: "center",
            justifyContent: "center",
            marginRight: 4,
          }}
        >
          <X size={16} color={COLORS.textSecondary} />
        </AnimatedPressable>
      ),
    });
  }, [navigation, COLORS, router]);

  const fetchMesas = useCallback(async () => {
    console.log("[NovaComanda] Fetching available mesas from /api/mesas");
    try {
      const res = await apiGet<any>("/api/mesas");
      const all: ApiMesa[] = Array.isArray(res) ? res : (res.mesas || []);
      const livres = all.filter((m) => m.status === "livre" || m.status === "free");
      console.log("[NovaComanda] Found", livres.length, "free mesas");
      setMesas(livres);
    } catch (e) {
      console.error("[NovaComanda] Error fetching mesas:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMesas(); }, [fetchMesas]);

  const handleSubmit = async () => {
    if (!selectedMesaId) {
      setError("Selecione uma mesa.");
      return;
    }
    if (customerCount < 1) {
      setError("Número de pessoas deve ser pelo menos 1.");
      return;
    }
    console.log("[NovaComanda] Creating comanda - mesa:", selectedMesaId, "customers:", customerCount);
    setError("");
    setSubmitting(true);
    try {
      const res = await apiPost<any>("/api/comandas", {
        mesa_id: selectedMesaId,
        customer_count: customerCount,
        notes: notes.trim() || undefined,
      });
      const comandaId = res?.comanda?.id || res?.id;
      console.log("[NovaComanda] Comanda created:", comandaId);
      if (comandaId) {
        router.replace(`/comanda/${comandaId}`);
      } else {
        router.back();
      }
    } catch (e: any) {
      console.error("[NovaComanda] Error creating comanda:", e instanceof Error ? e.message : String(e));
      setError("Não foi possível abrir a comanda. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: "Nova Comanda",
          headerTintColor: COLORS.primary,
          headerBackButtonDisplayMode: "minimal",
        }}
      />
      <ScrollView
        style={{ flex: 1, backgroundColor: COLORS.background }}
        contentContainerStyle={{ padding: 20, gap: 20, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Mesa picker */}
        <View style={{ gap: 10 }}>
          <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 17, color: COLORS.text }}>
            Selecionar Mesa
          </Text>
          {loading ? (
            <ActivityIndicator color={COLORS.primary} />
          ) : mesas.length === 0 ? (
            <View
              style={{
                backgroundColor: COLORS.surface,
                borderRadius: 12,
                padding: 20,
                alignItems: "center",
                borderWidth: 1,
                borderColor: COLORS.border,
              }}
            >
              <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 14, color: COLORS.textSecondary }}>
                Nenhuma mesa livre disponível
              </Text>
            </View>
          ) : (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              {mesas.map((mesa) => {
                const isSelected = selectedMesaId === mesa.id;
                return (
                  <AnimatedPressable
                    key={mesa.id}
                    onPress={() => {
                      console.log("[NovaComanda] Mesa selected:", mesa.number);
                      setSelectedMesaId(mesa.id);
                      setError("");
                    }}
                    style={{
                      width: 72,
                      height: 72,
                      borderRadius: 16,
                      backgroundColor: isSelected ? COLORS.primary : COLORS.surface,
                      borderWidth: 2,
                      borderColor: isSelected ? COLORS.primary : COLORS.border,
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 4,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: "Outfit_700Bold",
                        fontSize: 20,
                        color: isSelected ? "#fff" : COLORS.text,
                      }}
                    >
                      {mesa.number}
                    </Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
                      <Users size={10} color={isSelected ? "rgba(255,255,255,0.8)" : COLORS.textSecondary} />
                      <Text
                        style={{
                          fontFamily: "Outfit_400Regular",
                          fontSize: 10,
                          color: isSelected ? "rgba(255,255,255,0.8)" : COLORS.textSecondary,
                        }}
                      >
                        {mesa.capacity}
                      </Text>
                    </View>
                  </AnimatedPressable>
                );
              })}
            </View>
          )}
        </View>

        {/* Customer count */}
        <View style={{ gap: 10 }}>
          <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 17, color: COLORS.text }}>
            Número de Pessoas
          </Text>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 20,
              backgroundColor: COLORS.surface,
              borderRadius: 14,
              padding: 16,
              borderWidth: 1,
              borderColor: COLORS.border,
              alignSelf: "flex-start",
            }}
          >
            <AnimatedPressable
              onPress={() => {
                console.log("[NovaComanda] Decrease customer count");
                setCustomerCount((c) => Math.max(1, c - 1));
              }}
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                backgroundColor: COLORS.surfaceSecondary,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Minus size={18} color={COLORS.text} />
            </AnimatedPressable>
            <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 28, color: COLORS.text, minWidth: 40, textAlign: "center" }}>
              {customerCount}
            </Text>
            <AnimatedPressable
              onPress={() => {
                console.log("[NovaComanda] Increase customer count");
                setCustomerCount((c) => c + 1);
              }}
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                backgroundColor: COLORS.primaryMuted,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Plus size={18} color={COLORS.primary} />
            </AnimatedPressable>
          </View>
        </View>

        {/* Notes */}
        <View style={{ gap: 8 }}>
          <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 17, color: COLORS.text }}>
            Observações
          </Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Ex: cliente alérgico a amendoim..."
            placeholderTextColor={COLORS.textTertiary}
            multiline
            numberOfLines={3}
            style={{
              backgroundColor: COLORS.surface,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: COLORS.border,
              padding: 14,
              fontFamily: "Outfit_400Regular",
              fontSize: 15,
              color: COLORS.text,
              minHeight: 80,
              textAlignVertical: "top",
            }}
          />
        </View>

        {/* Error */}
        {!!error && (
          <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 13, color: COLORS.danger }}>
            {error}
          </Text>
        )}

        {/* Submit */}
        <AnimatedPressable
          onPress={handleSubmit}
          disabled={submitting || !selectedMesaId}
          style={{
            backgroundColor: COLORS.primary,
            borderRadius: 14,
            height: 52,
            alignItems: "center",
            justifyContent: "center",
            marginTop: 8,
            opacity: !selectedMesaId ? 0.6 : 1,
          }}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 16, color: "#fff" }}>
              Abrir Comanda
            </Text>
          )}
        </AnimatedPressable>
      </ScrollView>
    </>
  );
}
