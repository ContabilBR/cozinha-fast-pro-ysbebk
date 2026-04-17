import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useRouter, useLocalSearchParams, Stack } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { apiGet, apiPost } from "@/utils/api";
import { Users } from "lucide-react-native";

interface ApiMesa {
  id: string;
  numero: number;
  capacidade: number;
  status: string;
}

function isDisponivel(status: string): boolean {
  return status === "disponivel" || status === "livre" || status === "free";
}

export default function NovaComandaScreen() {
  const COLORS = useColors();
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ mesa_id?: string }>();

  const [mesas, setMesas] = useState<ApiMesa[]>([]);
  const [selectedMesaId, setSelectedMesaId] = useState<string>(params.mesa_id ?? "");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const fetchMesas = useCallback(async () => {
    console.log("[NovaComanda] Fetching available mesas from /api/mesas");
    try {
      const res = await apiGet<any>("/api/mesas");
      const all: ApiMesa[] = Array.isArray(res) ? res : (res.mesas || []);
      const livres = all.filter((m) => isDisponivel(m.status));
      console.log("[NovaComanda] Found", livres.length, "mesas disponíveis");
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
    const garcomId = user?.id;
    console.log("[NovaComanda] Creating comanda - mesa:", selectedMesaId, "garcom:", garcomId);
    setError("");
    setSubmitting(true);
    try {
      const payload: any = { mesa_id: selectedMesaId };
      if (garcomId) payload.garcom_id = garcomId;
      const res = await apiPost<any>("/api/comandas", payload);
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
          title: "Abrir Comanda",
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
                Nenhuma mesa disponível no momento
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
                      console.log("[NovaComanda] Mesa selected:", mesa.numero);
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
                      {mesa.numero}
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
                        {mesa.capacidade}
                      </Text>
                    </View>
                  </AnimatedPressable>
                );
              })}
            </View>
          )}
        </View>

        {/* Garçom info */}
        {user && (
          <View
            style={{
              backgroundColor: COLORS.surface,
              borderRadius: 14,
              padding: 16,
              borderWidth: 1,
              borderColor: COLORS.border,
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: COLORS.primaryMuted,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Users size={18} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 12, color: COLORS.textSecondary }}>
                Garçom responsável
              </Text>
              <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 14, color: COLORS.text }}>
                {user.name || user.email}
              </Text>
            </View>
          </View>
        )}

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
