import React from "react";
import { View } from "react-native";
import { Slot, Redirect } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import FloatingTabBar, { TabBarItem } from "@/components/FloatingTabBar";
import { useColors } from "@/hooks/useColors";
import { usePratoProntoCount } from "@/hooks/usePratoProntoCount";

function getTabsForRole(role: string, pratoProntoCount: number): TabBarItem[] {
  const perfilTab: TabBarItem = {
    name: "perfil",
    route: "/(tabs)/(perfil)",
    icon: "account-circle",
    label: "Perfil",
  };

  switch (role) {
    case "garcom":
      return [
        { name: "mesas", route: "/(tabs)/(mesas)", icon: "grid-view", label: "Mesas" },
        { name: "cardapio", route: "/(tabs)/(cardapio)", icon: "restaurant-menu", label: "Cardápio" },
        { name: "comandas", route: "/(tabs)/(comandas)", icon: "receipt-long", label: "Comandas" },
        { name: "pedidos", route: "/(tabs)/(pedidos)", icon: "list-alt", label: "Pedidos", badge: pratoProntoCount },
        { name: "delivery", route: "/(tabs)/(delivery)", icon: "delivery-dining", label: "Delivery" },
        perfilTab,
      ];
    case "cozinheiro":
    case "cozinha":
      return [
        { name: "cozinha", route: "/(tabs)/(cozinha)", icon: "local-fire-department", label: "Cozinha" },
        { name: "cardapio", route: "/(tabs)/(cardapio)", icon: "restaurant-menu", label: "Cardápio" },
        perfilTab,
      ];
    case "gerente":
    case "administrador":
    case "admin":
      return [
        { name: "dashboard", route: "/(tabs)/(dashboard)", icon: "bar-chart", label: "Dashboard" },
        { name: "mesas", route: "/(tabs)/(mesas)", icon: "grid-view", label: "Mesas" },
        { name: "comandas", route: "/(tabs)/(comandas)", icon: "receipt-long", label: "Comandas" },
        { name: "delivery", route: "/(tabs)/(delivery)", icon: "delivery-dining", label: "Delivery" },
        { name: "cardapio", route: "/(tabs)/(cardapio)", icon: "restaurant-menu", label: "Cardápio" },
        { name: "gestao", route: "/(tabs)/(gestao)", icon: "settings", label: "Gestão" },
        perfilTab,
      ];
    default:
      return [
        { name: "mesas", route: "/(tabs)/(mesas)", icon: "grid-view", label: "Mesas" },
        perfilTab,
      ];
  }
}

export default function TabLayout() {
  const { user, isLoading } = useAuth();
  const COLORS = useColors();
  const role = user?.role || "garcom";
  const pratoProntoCount = usePratoProntoCount(role === "garcom");

  if (isLoading) return null;
  if (!user) return <Redirect href="/auth-screen" />;

  const tabs = getTabsForRole(role, pratoProntoCount);
  const tabCount = tabs.length;
  const containerWidth = Math.min(60 + tabCount * 72, 420);

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <Slot />
      <FloatingTabBar tabs={tabs} containerWidth={containerWidth} />
    </View>
  );
}
