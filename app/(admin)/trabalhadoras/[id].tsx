import { useState, useEffect, useCallback, useMemo } from 'react';
import { View, StyleSheet, ScrollView, Alert, FlatList, Pressable } from 'react-native';
import { TextInput, Button, Text, Switch, HelperText, Dialog, Portal } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { theme } from '../../../src/lib/theme';
import {
  getTrabalhadora,
  updateTrabalhadora,
  deleteTrabalhadora,
  getWorkerProfiles,
  getTrabalhadoras,
} from '../../../src/services/trabalhadoras';
import { ChargeType } from '../../../src/types/database';

interface TrabalhadoraForm {
  nome: string;
  telefone: string;
  user_id: string;
  tipos_de_servico: string;
  tipo_pagamento: 'hora' | 'diaria' | 'fixo' | null;
  valor_pagamento: string;
  dias_disponiveis: string;
  observacoes: string;
  ativo: boolean;
}

const trabalhadoraSchema = z.object({
  nome: z.string().min(1, 'Nome e obrigatorio'),
  telefone: z.string(),
  user_id: z.string(),
  tipos_de_servico: z.string(),
  tipo_pagamento: z.enum(['hora', 'diaria', 'fixo']).nullable(),
  valor_pagamento: z.string(),
  dias_disponiveis: z.string(),
  observacoes: z.string(),
  ativo: z.boolean(),
});

const formatPhoneInput = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) {
    return `${digits.slice(0, 2)} ${digits.slice(2)}`;
  }
  if (digits.length <= 10) {
    return `${digits.slice(0, 2)} ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `${digits.slice(0, 2)} ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

const formatDecimalInput = (value: string) => {
  const normalized = value.replace(/,/g, '.').replace(/[^\d.]/g, '');
  const [intPart, decimalPart] = normalized.split('.');
  if (!decimalPart) return intPart || '';
  return `${intPart || '0'}.${decimalPart.slice(0, 2)}`;
};

export default function TrabalhadoraDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [profiles, setProfiles] = useState<Array<{ id: string; nome: string; telefone: string | null }>>([]);
  const [usedUserIds, setUsedUserIds] = useState<Set<string>>(new Set());
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const [profileQuery, setProfileQuery] = useState('');
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showDaysDialog, setShowDaysDialog] = useState(false);
  const [customPayment, setCustomPayment] = useState(false);
  const [selectedDays, setSelectedDays] = useState<string[]>([]);

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isDirty },
  } = useForm<TrabalhadoraForm>({
    resolver: zodResolver(trabalhadoraSchema),
    defaultValues: {
      nome: '',
      telefone: '',
      user_id: '',
      tipos_de_servico: '',
      tipo_pagamento: null,
      valor_pagamento: '',
      dias_disponiveis: '',
      observacoes: '',
      ativo: true,
    },
  });

  const loadLookups = useCallback(async () => {
    try {
      const [profilesData, trabalhadorasData] = await Promise.all([
        getWorkerProfiles(),
        getTrabalhadoras(),
      ]);
      setProfiles(profilesData || []);
      setUsedUserIds(
        new Set((trabalhadorasData || []).map((item) => item.user_id).filter(Boolean) as string[])
      );
    } catch (error) {
      console.error('Error loading profiles:', error);
    }
  }, []);

  const loadTrabalhadora = useCallback(async () => {
    if (!id) return;
    try {
      const data = await getTrabalhadora(id);
      reset({
        nome: data.nome,
        telefone: data.telefone || '',
        user_id: data.user_id || '',
        tipos_de_servico: data.tipos_de_servico?.join(', ') || '',
        tipo_pagamento: data.tipo_pagamento,
        valor_pagamento: data.valor_pagamento?.toString() || '',
        dias_disponiveis: data.dias_disponiveis?.join(', ') || '',
        observacoes: data.observacoes || '',
        ativo: data.ativo,
      });
      setSelectedDays(data.dias_disponiveis || []);
      setCustomPayment(false);
    } catch (error) {
      console.error('Error loading trabalhadora:', error);
      Alert.alert('Erro', 'Nao foi possivel carregar a trabalhadora.');
      router.back();
    } finally {
      setLoading(false);
    }
  }, [id, reset, router]);

  useEffect(() => {
    loadTrabalhadora();
    loadLookups();
  }, [loadTrabalhadora, loadLookups]);

  const filteredProfiles = useMemo(() => {
    const query = profileQuery.trim().toLowerCase();
    if (!query) return profiles;
    return profiles.filter((profile) => profile.nome.toLowerCase().includes(query));
  }, [profiles, profileQuery]);

  const getProfileLabel = (profileId: string) => {
    if (!profileId) return '';
    return profiles.find((profile) => profile.id === profileId)?.nome || '';
  };

  const paymentOptions = [
    { value: 'hora', label: 'Hora' },
    { value: 'diaria', label: 'Diaria' },
    { value: 'fixo', label: 'Fixo' },
    { value: 'personalizado', label: 'Personalizar' },
  ] as const;

  const getPaymentLabel = (value: ChargeType | null) => {
    if (customPayment) return 'Personalizado';
    if (!value) return '';
    return paymentOptions.find((option) => option.value === value)?.label || '';
  };

  const daysOfWeek = [
    'Segunda-feira',
    'Terca-feira',
    'Quarta-feira',
    'Quinta-feira',
    'Sexta-feira',
    'Sabado',
    'Domingo',
  ];

  const handleSelectProfile = (profileId: string) => {
    setValue('user_id', profileId, { shouldValidate: true });
    setShowProfileDialog(false);
  };

  const handleClearProfile = () => {
    setValue('user_id', '');
    setShowProfileDialog(false);
  };

  const handleSelectPayment = (value: (typeof paymentOptions)[number]['value']) => {
    if (value === 'personalizado') {
      setCustomPayment(true);
      setValue('tipo_pagamento', null);
    } else {
      setCustomPayment(false);
      setValue('tipo_pagamento', value);
    }
    setShowPaymentDialog(false);
  };

  const toggleDay = (day: string) => {
    setSelectedDays((current) => {
      if (current.includes(day)) {
        return current.filter((item) => item !== day);
      }
      return [...current, day];
    });
  };

  useEffect(() => {
    setValue('dias_disponiveis', selectedDays.join(', '));
  }, [selectedDays, setValue]);

  const parseListInput = (value: string) => {
    const items = value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    return items.length > 0 ? items : null;
  };

  async function onSubmit(data: TrabalhadoraForm) {
    if (!id) return;
    setSaving(true);
    try {
      await updateTrabalhadora(id, {
        user_id: data.user_id || null,
        nome: data.nome,
        telefone: data.telefone || null,
        tipos_de_servico: parseListInput(data.tipos_de_servico),
        tipo_pagamento: (data.tipo_pagamento as ChargeType) || null,
        valor_pagamento: data.valor_pagamento ? parseFloat(data.valor_pagamento) : null,
        dias_disponiveis: selectedDays.length ? selectedDays : null,
        observacoes: data.observacoes || null,
        ativo: data.ativo,
      });
      Alert.alert('Sucesso', 'Trabalhadora atualizada com sucesso.');
      router.back();
    } catch (error) {
      console.error('Error updating trabalhadora:', error);
      Alert.alert('Erro', 'Nao foi possivel atualizar a trabalhadora.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!id) return;
    setDeleting(true);
    try {
      await deleteTrabalhadora(id);
      setShowDeleteDialog(false);
      Alert.alert('Sucesso', 'Trabalhadora excluida com sucesso.');
      router.back();
    } catch (error) {
      console.error('Error deleting trabalhadora:', error);
      Alert.alert('Erro', 'Nao foi possivel excluir a trabalhadora.');
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Carregando...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text variant="titleSmall" style={styles.sectionTitle}>
          Dados basicos
        </Text>

        <Controller
          control={control}
          name="nome"
          render={({ field: { onChange, onBlur, value } }) => (
            <View style={styles.inputContainer}>
              <TextInput
                label="Nome completo"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                mode="outlined"
                error={!!errors.nome}
              />
              {errors.nome && <HelperText type="error">{errors.nome.message}</HelperText>}
            </View>
          )}
        />

        <Controller
          control={control}
          name="telefone"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              label="Telefone"
              value={value}
              onChangeText={(text) => onChange(formatPhoneInput(text))}
              onBlur={onBlur}
              mode="outlined"
              keyboardType="phone-pad"
              style={styles.input}
            />
          )}
        />

        <Controller
          control={control}
          name="user_id"
          render={({ field: { value } }) => (
            <View style={styles.inputContainer}>
              <Pressable onPress={() => setShowProfileDialog(true)}>
                <View pointerEvents="none">
                  <TextInput
                    label="Usuario (opcional)"
                    value={getProfileLabel(value)}
                    mode="outlined"
                    placeholder="Selecionar usuario"
                    editable={false}
                    right={
                      <TextInput.Icon
                        icon="menu-down"
                        onPress={() => setShowProfileDialog(true)}
                      />
                    }
                  />
                </View>
              </Pressable>
              <Text variant="bodySmall" style={styles.helperText}>
                Vincule a conta de login da trabalhadora (se ja existir).
              </Text>
              {value && usedUserIds.has(value) && (
                <Text variant="bodySmall" style={styles.warningText}>
                  Este usuario ja esta vinculado a outra trabalhadora.
                </Text>
              )}
            </View>
          )}
        />

        <Text variant="titleSmall" style={styles.sectionTitle}>
          Servico e pagamento
        </Text>

        <Controller
          control={control}
          name="tipos_de_servico"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              label="Tipos de servico"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              mode="outlined"
              placeholder="Ex: Residencial, Comercial"
              style={styles.input}
            />
          )}
        />

        <Controller
          control={control}
          name="tipo_pagamento"
          render={({ field: { value } }) => (
            <View style={styles.inputContainer}>
              <Pressable onPress={() => setShowPaymentDialog(true)}>
                <View pointerEvents="none">
                  <TextInput
                    label="Tipo de pagamento"
                    value={getPaymentLabel(value)}
                    mode="outlined"
                    placeholder="Selecionar tipo"
                    editable={false}
                    right={
                      <TextInput.Icon
                        icon="menu-down"
                        onPress={() => setShowPaymentDialog(true)}
                      />
                    }
                  />
                </View>
              </Pressable>
              {customPayment ? (
                <Text variant="bodySmall" style={styles.helperText}>
                  Descreva o combinado no campo Observacoes.
                </Text>
              ) : null}
            </View>
          )}
        />

        <Controller
          control={control}
          name="valor_pagamento"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              label="Valor de pagamento"
              value={value}
              onChangeText={(text) => onChange(formatDecimalInput(text))}
              onBlur={onBlur}
              mode="outlined"
              keyboardType="decimal-pad"
              style={styles.input}
            />
          )}
        />

        <Text variant="titleSmall" style={styles.sectionTitle}>
          Disponibilidade
        </Text>

        <Controller
          control={control}
          name="dias_disponiveis"
          render={({ field: { value } }) => (
            <Pressable onPress={() => setShowDaysDialog(true)}>
              <View style={styles.inputContainer} pointerEvents="none">
                <TextInput
                  label="Dias disponiveis"
                  value={value}
                  mode="outlined"
                  placeholder="Selecionar dias"
                  editable={false}
                  right={
                    <TextInput.Icon
                      icon="menu-down"
                      onPress={() => setShowDaysDialog(true)}
                    />
                  }
                />
              </View>
            </Pressable>
          )}
        />

        <Controller
          control={control}
          name="observacoes"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              label="Observacoes"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              mode="outlined"
              multiline
              numberOfLines={3}
              style={styles.input}
            />
          )}
        />

        <Controller
          control={control}
          name="ativo"
          render={({ field: { onChange, value } }) => (
            <View style={styles.switchContainer}>
              <Text variant="bodyMedium">Trabalhadora ativa</Text>
              <Switch value={value} onValueChange={onChange} />
            </View>
          )}
        />

        <View style={styles.buttonContainer}>
          <Button mode="outlined" onPress={() => router.back()} style={styles.button}>
            Cancelar
          </Button>
          <Button
            mode="contained"
            onPress={handleSubmit(onSubmit)}
            loading={saving}
            disabled={saving || !isDirty}
            style={styles.button}
          >
            Salvar
          </Button>
        </View>

        <Button
          mode="text"
          onPress={() => setShowDeleteDialog(true)}
          textColor={theme.colors.error}
          style={styles.deleteButton}
        >
          Excluir trabalhadora
        </Button>
      </ScrollView>

      <Portal>
        <Dialog visible={showDeleteDialog} onDismiss={() => setShowDeleteDialog(false)}>
          <Dialog.Title>Excluir trabalhadora</Dialog.Title>
          <Dialog.Content>
            <Text>Tem certeza que deseja excluir esta trabalhadora?</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowDeleteDialog(false)}>Cancelar</Button>
            <Button onPress={handleDelete} loading={deleting} textColor={theme.colors.error}>
              Excluir
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={showProfileDialog} onDismiss={() => setShowProfileDialog(false)}>
          <Dialog.Title>Selecionar usuario</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Buscar usuario"
              value={profileQuery}
              onChangeText={setProfileQuery}
              mode="outlined"
              style={styles.dialogInput}
            />
            <FlatList
              data={filteredProfiles}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <Button mode="text" onPress={() => handleSelectProfile(item.id)}>
                  {item.nome}{item.telefone ? ` • ${item.telefone}` : ''}
                </Button>
              )}
              ListEmptyComponent={
                <Text variant="bodySmall" style={styles.emptyListText}>
                  Nenhum usuario encontrado
                </Text>
              }
              style={styles.dialogList}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={handleClearProfile}>Limpar</Button>
            <Button onPress={() => setShowProfileDialog(false)}>Fechar</Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={showPaymentDialog} onDismiss={() => setShowPaymentDialog(false)}>
          <Dialog.Title>Tipo de pagamento</Dialog.Title>
          <Dialog.Content>
            {paymentOptions.map((option) => (
              <Button
                key={option.value}
                mode="text"
                onPress={() => handleSelectPayment(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowPaymentDialog(false)}>Fechar</Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={showDaysDialog} onDismiss={() => setShowDaysDialog(false)}>
          <Dialog.Title>Dias disponiveis</Dialog.Title>
          <Dialog.Content>
            {daysOfWeek.map((day) => (
              <Button
                key={day}
                mode={selectedDays.includes(day) ? 'contained' : 'text'}
                onPress={() => toggleDay(day)}
              >
                {day}
              </Button>
            ))}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setSelectedDays([])}>Limpar</Button>
            <Button onPress={() => setShowDaysDialog(false)}>Fechar</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 16,
  },
  sectionTitle: {
    color: theme.colors.primary,
    marginTop: 8,
    marginBottom: 12,
  },
  inputContainer: {
    marginBottom: 16,
  },
  input: {
    marginBottom: 16,
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  warningText: {
    color: theme.colors.error,
    marginTop: 8,
  },
  helperText: {
    color: theme.colors.outline,
    marginTop: 6,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  button: {
    flex: 1,
  },
  deleteButton: {
    marginTop: 8,
  },
  dialogInput: {
    marginBottom: 12,
  },
  dialogList: {
    maxHeight: 240,
  },
  emptyListText: {
    color: theme.colors.outline,
    textAlign: 'center',
    paddingVertical: 12,
  },
});
