import React from "react";
import { Redirect } from "expo-router";
import { NativeTabs, Icon, Label } from "expo-router/unstable-native-tabs";
import { useAuth } from "@/contexts/AuthContext";
import { UserRole } from "@/types";

export default function TabLayoutIOS() {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Redirect href="/auth-screen" />;

  const role = ((user as any).role as UserRole) || "garcom";

  if (role === "garcom") {
    return (
      <NativeTabs>
        <NativeTabs.Trigger name="(mesas)">
          <Icon sf="square.grid.2x2" />
          <Label>Mesas</Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="(comandas)">
          <Icon sf="doc.text" />
          <Label>Comandas</Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="(cardapio)">
          <Icon sf="fork.knife" />
          <Label>Cardápio</Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="(perfil)">
          <Icon sf="person.circle" />
          <Label>Perfil</Label>
        </NativeTabs.Trigger>
      </NativeTabs>
    );
  }

  if (role === "administrador") {
    return (
      <NativeTabs>
        <NativeTabs.Trigger name="(mesas)">
          <Icon sf="square.grid.2x2" />
          <Label>Mesas</Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="(cardapio)">
          <Icon sf="fork.knife" />
          <Label>Cardápio</Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="(usuarios)">
          <Icon sf="person.2" />
          <Label>Usuários</Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="(perfil)">
          <Icon sf="person.circle" />
          <Label>Perfil</Label>
        </NativeTabs.Trigger>
      </NativeTabs>
    );
  }

  if (role === "gerente") {
    return (
      <NativeTabs>
        <NativeTabs.Trigger name="(dashboard)">
          <Icon sf="chart.bar" />
          <Label>Dashboard</Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="(relatorios)">
          <Icon sf="chart.pie" />
          <Label>Relatórios</Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="(historico)">
          <Icon sf="clock.arrow.circlepath" />
          <Label>Histórico</Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="(cardapio)">
          <Icon sf="fork.knife" />
          <Label>Cardápio</Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="(perfil)">
          <Icon sf="person.circle" />
          <Label>Perfil</Label>
        </NativeTabs.Trigger>
      </NativeTabs>
    );
  }

  if (role === "cozinheiro") {
    return (
      <NativeTabs>
        <NativeTabs.Trigger name="(cozinha)">
          <Icon sf="flame" />
          <Label>Fila</Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="(historico)">
          <Icon sf="clock.arrow.circlepath" />
          <Label>Histórico</Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="(cardapio)">
          <Icon sf="fork.knife" />
          <Label>Cardápio</Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="(perfil)">
          <Icon sf="person.circle" />
          <Label>Perfil</Label>
        </NativeTabs.Trigger>
      </NativeTabs>
    );
  }

  return (
    <NativeTabs>
      <NativeTabs.Trigger name="(mesas)">
        <Icon sf="square.grid.2x2" />
        <Label>Mesas</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(perfil)">
        <Icon sf="person.circle" />
        <Label>Perfil</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
