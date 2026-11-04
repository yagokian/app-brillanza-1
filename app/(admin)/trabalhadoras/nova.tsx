import { useState, useEffect, useCallback, useMemo } from 'react';
import { View, StyleSheet, ScrollView, Alert, FlatList, Pressable } from 'react-native';
import { TextInput, Button, Text, Switch, HelperText, Dialog, Portal, Chip, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { theme } from '../../../src/lib/theme';
import { supabase } from '../../../src/lib/supabase';
import { createTrabalhadora, getWorkerProfiles, getTrabalhadoras } from '../../../src/services/trabalhadoras';
import { ChargeType } from '../../../src/types/database';

interface TrabalhadoraForm {
  nome: string;
  telefone: string;
  email: string;
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
  email: z.string(),
  user_id: z.string(),
  tipos_de_servico: z.string(),
  tipo_pagamento: z.enum(['hora', 'diaria', 'fixo']).nullable(),
  valor_pagamento: z.string(),
  dias_disponiveis: z.string(),
  observacoes: z.string(),
  ativo: z.boolean(),
});

const generatePassword = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let password = '';
  for (let i = 0; i < 8; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

const PAYMENT_OPTIONS = [
  { value: 'hora', label: 'Por Hora' },
  { value: 'diaria', label: 'Diária' },
  { value: 'fixo', label: 'Fixo' },
] as const;

const DAYS_OF_WEEK = [
  { value: 'Segunda-feira', short: 'Seg' },
  { value: 'Terca-feira', short: 'Ter' },
  { value: 'Quarta-feira', short: 'Qua' },
  { value: 'Quinta-feira', short: 'Qui' },
  { value: 'Sexta-feira', short: 'Sex' },
  { value: 'Sabado', short: 'Sáb' },
  { value: 'Domingo', short: 'Dom' },
];

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

export default function NovaTrabalhadoraScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Array<{ id: string; nome: string; telefone: string | null }>>([]);
  const [usedUserIds, setUsedUserIds] = useState<Set<string>>(new Set());
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const [profileQuery, setProfileQuery] = useState('');
  const [selectedPayment, setSelectedPayment] = useState<string | null>(null);
  const [selectedDays, setSelectedDays] = useState<string[]>([]);

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<TrabalhadoraForm>({
    resolver: zodResolver(trabalhadoraSchema),
    defaultValues: {
      nome: '',
      telefone: '',
      email: '',
      user_id: '',
      tipos_de_servico: '',
      tipo_pagamento: null,
      valor_pagamento: '',
      dias_disponiveis: '',
      observacoes: '',
      ativo: true,
    },
  });

  const watchedEmail = watch('email');
  const watchedUserId = watch('user_id');
  const watchedNome = watch('nome');

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

  useEffect(() => {
    loadLookups();
  }, [loadLookups]);

  const filteredProfiles = useMemo(() => {
    const query = profileQuery.trim().toLowerCase();
    if (!query) return profiles;
    return profiles.filter((profile) => profile.nome.toLowerCase().includes(query));
  }, [profiles, profileQuery]);

  const getProfileLabel = (profileId: string) => {
    if (!profileId) return '';
    return profiles.find((profile) => profile.id === profileId)?.nome || '';
  };

  const handleSelectProfile = (profileId: string) => {
    setValue('user_id', profileId, { shouldValidate: true });
    setShowProfileDialog(false);
  };

  const handleClearProfile = () => {
    setValue('user_id', '');
    setGeneratedPassword(null);
    setShowProfileDialog(false);
  };

  const handleSelectPayment = (value: string) => {
    setSelectedPayment(value);
    setValue('tipo_pagamento', value as ChargeType);
  };

  const toggleDay = (day: string) => {
    setSelectedDays((current) => {
      const newDays = current.includes(day)
        ? current.filter((item) => item !== day)
        : [...current, day];
      setValue('dias_disponiveis', newDays.join(', '));
      return newDays;
    });
  };

  const handleCreateUser = async () => {
    if (!watchedEmail || !watchedNome) {
      Alert.alert('Erro', 'Preencha o nome e email antes de criar o acesso.');
      return;
    }

    setCreatingUser(true);
    try {
      const password = generatePassword();

      const { data, error } = await supabase.functions.invoke('create-worker', {
        body: { email: watchedEmail, password, nome: watchedNome },
      });

      if (error) throw new Error(error.message || 'Erro ao criar acesso');
      if (!data?.user_id) throw new Error('Não foi possível criar o acesso');

      setValue('user_id', data.user_id);
      setGeneratedPassword(password);
      Alert.alert(
        'Acesso Criado!',
        `Senha temporária: ${password}\n\nAnote esta senha para passar à trabalhadora. Ela deverá trocar no primeiro acesso.`
      );
    } catch (error: any) {
      console.error('Error creating user:', error);
      Alert.alert('Erro', error.message || 'Não foi possível criar o acesso.');
    } finally {
      setCreatingUser(false);
    }
  };

  const parseListInput = (value: string) => {
    const items = value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    return items.length > 0 ? items : null;
  };

  async function onSubmit(data: TrabalhadoraForm) {
    setLoading(true);
    try {
      await createTrabalhadora({
        user_id: data.user_id || null,
        nome: data.nome,
        telefone: data.telefone || null,
        tipos_de_servico: parseListInput(data.tipos_de_servico),
        tipo_pagamento: (selectedPayment as ChargeType) || null,
        valor_pagamento: data.valor_pagamento ? parseFloat(data.valor_pagamento) : null,
        dias_disponiveis: selectedDays.length ? selectedDays : null,
        observacoes: data.observacoes || null,
        ativo: data.ativo,
      });

      Alert.alert('Sucesso', 'Trabalhadora cadastrada com sucesso.');
      router.back();
    } catch (error: any) {
      console.error('Error creating trabalhadora:', error);
      Alert.alert('Erro', error?.message || 'Nao foi possivel criar a trabalhadora.');
    } finally {
      setLoading(false);
    }
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

        <Text variant="titleSmall" style={styles.sectionTitle}>
          Acesso ao App
        </Text>

        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              label="Email da trabalhadora"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              mode="outlined"
              keyboardType="email-address"
              autoCapitalize="none"
              style={styles.input}
              disabled={!!watchedUserId}
            />
          )}
        />

        {!watchedUserId && watchedEmail && (
          <Button
            mode="contained"
            onPress={handleCreateUser}
            loading={creatingUser}
            disabled={creatingUser || !watchedNome || !watchedEmail}
            style={styles.createUserButton}
            icon="account-plus"
          >
            Criar Acesso
          </Button>
        )}

        {generatedPassword && (
          <View style={styles.passwordBox}>
            <Text variant="bodySmall" style={styles.passwordLabel}>Senha temporária:</Text>
            <Text variant="titleMedium" style={styles.passwordText}>{generatedPassword}</Text>
            <Text variant="bodySmall" style={styles.passwordHint}>
              Anote e passe para a trabalhadora. Ela deverá trocar no primeiro acesso.
            </Text>
          </View>
        )}

        {watchedUserId && (
          <View style={styles.userLinkedBox}>
            <Text variant="bodyMedium" style={styles.userLinkedText}>
              ✓ Usuário vinculado: {getProfileLabel(watchedUserId) || watchedEmail}
            </Text>
            <Button mode="text" onPress={handleClearProfile} textColor={theme.colors.error}>
              Desvincular
            </Button>
          </View>
        )}

        {!watchedUserId && !watchedEmail && (
          <Pressable onPress={() => setShowProfileDialog(true)}>
            <View style={styles.linkExistingBox}>
              <Text variant="bodyMedium" style={styles.linkExistingText}>
                Ou vincular usuário existente →
              </Text>
            </View>
          </Pressable>
        )}

        <Text variant="titleSmall" style={styles.sectionTitle}>
          Serviço e Pagamento
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

        <Text variant="bodyMedium" style={styles.fieldLabel}>Tipo de Pagamento</Text>
        <View style={styles.chipsContainer}>
          {PAYMENT_OPTIONS.map((option) => (
            <Chip
              key={option.value}
              selected={selectedPayment === option.value}
              onPress={() => handleSelectPayment(option.value)}
              style={styles.chip}
              showSelectedOverlay
            >
              {option.label}
            </Chip>
          ))}
        </View>

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
              left={<TextInput.Affix text="€" />}
              style={styles.input}
            />
          )}
        />

        <Text variant="titleSmall" style={styles.sectionTitle}>
          Disponibilidade
        </Text>

        <Text variant="bodyMedium" style={styles.fieldLabel}>Dias Disponíveis</Text>
        <View style={styles.chipsContainer}>
          {DAYS_OF_WEEK.map((day) => (
            <Chip
              key={day.value}
              selected={selectedDays.includes(day.value)}
              onPress={() => toggleDay(day.value)}
              style={styles.chip}
              showSelectedOverlay
            >
              {day.short}
            </Chip>
          ))}
        </View>

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
            loading={loading}
            disabled={loading}
            style={styles.button}
          >
            Salvar
          </Button>
        </View>
      </ScrollView>

      <Portal>
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

      </Portal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    padding: 16,
  },
  sectionTitle: {
    color: theme.colors.primary,
    marginTop: 16,
    marginBottom: 12,
    fontWeight: '600',
  },
  fieldLabel: {
    color: theme.colors.onSurface,
    marginBottom: 8,
  },
  inputContainer: {
    marginBottom: 16,
  },
  input: {
    marginBottom: 16,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  chip: {
    marginBottom: 4,
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  createUserButton: {
    marginBottom: 16,
  },
  passwordBox: {
    backgroundColor: theme.colors.primaryContainer,
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  passwordLabel: {
    color: theme.colors.onPrimaryContainer,
  },
  passwordText: {
    color: theme.colors.onPrimaryContainer,
    fontWeight: 'bold',
    marginVertical: 8,
    fontFamily: 'monospace',
  },
  passwordHint: {
    color: theme.colors.onPrimaryContainer,
    opacity: 0.8,
  },
  userLinkedBox: {
    backgroundColor: theme.colors.secondaryContainer,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userLinkedText: {
    color: theme.colors.onSecondaryContainer,
    flex: 1,
  },
  linkExistingBox: {
    padding: 12,
    marginBottom: 16,
  },
  linkExistingText: {
    color: theme.colors.primary,
    textDecorationLine: 'underline',
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
