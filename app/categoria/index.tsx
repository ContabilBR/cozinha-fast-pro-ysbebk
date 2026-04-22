import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  Modal, Alert, ActivityIndicator, KeyboardAvoidingView, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { apiGet, apiPost, apiPut, apiDelete } from '@/utils/api';

interface Categoria { id: string; nome: string; descricao?: string; }

export default function CategoriasScreen() {
  const COLORS = useColors();
  const router = useRouter();

  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [modalNome, setModalNome] = useState('');
  const [modalDescricao, setModalDescricao] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchCategorias = useCallback(async () => {
    try {
      const res = await apiGet<any>('/api/categorias');
      const list: Categoria[] = Array.isArray(res) ? res : (res?.categorias ?? []);
      setCategorias(list);
    } catch (e) {
      console.error('[Categorias] Erro ao carregar:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCategorias(); }, [fetchCategorias]);

  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/(home)' as any);
  };

  const openCreate = () => {
    setEditingId(null); setModalNome(''); setModalDescricao(''); setShowModal(true);
  };

  const openEdit = (cat: Categoria) => {
    setEditingId(cat.id); setModalNome(cat.nome); setModalDescricao(cat.descricao ?? ''); setShowModal(true);
  };

  const handleSave = async () => {
    if (!modalNome.trim()) { Alert.alert('Atenção', 'Nome é obrigatório.'); return; }
    setSaving(true);
    try {
      if (editingId) {
        await apiPut(`/api/categorias/${editingId}`, { nome: modalNome.trim(), descricao: modalDescricao.trim() || null });
      } else {
        await apiPost('/api/categorias', { nome: modalNome.trim(), descricao: modalDescricao.trim() || null });
      }
      setShowModal(false);
      fetchCategorias();
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível salvar a categoria.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: string, catNome: string) => {
    Alert.alert('Excluir', `Excluir "${catNome}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: async () => {
        await apiDelete(`/api/categorias/${id}`).catch(() => {});
        fetchCategorias();
      }}
    ]);
  };

  const handleBulkDelete = () => {
    if (selected.size === 0) return;
    Alert.alert('Excluir categorias', `Excluir ${selected.size} categoria(s)?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: async () => {
        for (const id of selected) {
          await apiDelete(`/api/categorias/${id}`).catch(() => {});
        }
        setSelected(new Set());
        setSelectMode(false);
        fetchCategorias();
      }}
    ]);
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const enterSelectMode = (id: string) => { setSelectMode(true); setSelected(new Set([id])); };
  const exitSelectMode = () => { setSelectMode(false); setSelected(new Set()); };

  const inputStyle = {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 10, padding: 12, fontSize: 15,
    color: COLORS.text, borderWidth: 1, borderColor: COLORS.border, marginBottom: 12,
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }} edges={['top', 'left', 'right']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', height: 56, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: COLORS.surface }}>
        {selectMode ? (
          <TouchableOpacity onPress={exitSelectMode} style={{ paddingVertical: 8, paddingRight: 12 }}>
            <Text style={{ color: '#007AFF', fontSize: 16, fontWeight: '500' }}>Cancelar</Text>
          </TouchableOpacity>
        ) : (
          <AnimatedPressable onPress={handleBack} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingRight: 8 }}>
            <Ionicons name="chevron-back" size={26} color="#007AFF" />
            <Text style={{ color: '#007AFF', fontSize: 17, fontWeight: '500' }}>Voltar</Text>
          </AnimatedPressable>
        )}
        <Text style={{ position: 'absolute', left: 0, right: 0, textAlign: 'center', fontSize: 17, fontWeight: '700', color: COLORS.text, height: 56, lineHeight: 56 }}>
          Categorias
        </Text>
        <View style={{ marginLeft: 'auto', flexDirection: 'row', gap: 8 }}>
          {selectMode ? (
            <TouchableOpacity onPress={handleBulkDelete} disabled={selected.size === 0}
              style={{ backgroundColor: selected.size > 0 ? '#FF3B30' : COLORS.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 }}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Excluir ({selected.size})</Text>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity onPress={() => setSelectMode(true)}
                style={{ borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}>
                <Text style={{ color: COLORS.textSecondary, fontSize: 14, fontWeight: '500' }}>Selecionar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={openCreate}
                style={{ backgroundColor: COLORS.primary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="add" size={16} color="#fff" />
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Incluir</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={categorias}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 120, gap: 10 }}
          renderItem={({ item }) => {
            const isSelected = selected.has(item.id);
            return (
              <TouchableOpacity
                onPress={() => { if (selectMode) toggleSelect(item.id); }}
                onLongPress={() => { if (!selectMode) enterSelectMode(item.id); }}
                activeOpacity={selectMode ? 0.6 : 1}
                style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isSelected ? COLORS.primaryMuted : COLORS.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: isSelected ? COLORS.primary : COLORS.border, gap: 12 }}
              >
                {selectMode && (
                  <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: isSelected ? COLORS.primary : COLORS.border, backgroundColor: isSelected ? COLORS.primary : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                    {isSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
                  </View>
                )}
                <Ionicons name="pricetag-outline" size={20} color={COLORS.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '600', color: COLORS.text }}>{item.nome}</Text>
                  {item.descricao ? <Text style={{ fontSize: 13, color: COLORS.textSecondary, marginTop: 2 }}>{item.descricao}</Text> : null}
                </View>
                {!selectMode && (
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity onPress={() => openEdit(item)} style={{ backgroundColor: '#007AFF', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Ionicons name="pencil" size={13} color="#fff" />
                      <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>Editar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDelete(item.id, item.nome)} style={{ backgroundColor: '#FF3B30', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Ionicons name="trash" size={13} color="#fff" />
                      <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>Excluir</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingTop: 60, gap: 8 }}>
              <Ionicons name="pricetag-outline" size={48} color={COLORS.textTertiary} />
              <Text style={{ fontSize: 16, color: COLORS.textSecondary }}>Nenhuma categoria</Text>
            </View>
          }
        />
      )}

      <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }} activeOpacity={1} onPress={() => setShowModal(false)}>
            <TouchableOpacity activeOpacity={1} onPress={() => {}}>
              <View style={{ backgroundColor: COLORS.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 }}>
                <View style={{ alignItems: 'center', marginBottom: 16 }}>
                  <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.border }} />
                </View>
                <Text style={{ fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 20 }}>
                  {editingId ? 'Editar Categoria' : 'Nova Categoria'}
                </Text>
                <Text style={{ fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 6 }}>Nome *</Text>
                <TextInput value={modalNome} onChangeText={setModalNome} placeholder="Nome da categoria" placeholderTextColor={COLORS.textTertiary} style={inputStyle} autoFocus autoCorrect={true} autoCapitalize="sentences" keyboardType="default" />
                <Text style={{ fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 6 }}>Descrição</Text>
                <TextInput value={modalDescricao} onChangeText={setModalDescricao} placeholder="Descrição (opcional)" placeholderTextColor={COLORS.textTertiary} style={[inputStyle, { minHeight: 80, textAlignVertical: 'top' }]} multiline autoCorrect={true} autoCapitalize="sentences" keyboardType="default" />
                <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
                  <TouchableOpacity onPress={() => setShowModal(false)} style={{ flex: 1, height: 48, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: COLORS.textSecondary, fontWeight: '600' }}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleSave} disabled={saving} style={{ flex: 1, height: 48, borderRadius: 12, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' }}>
                    {saving ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>Salvar</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
