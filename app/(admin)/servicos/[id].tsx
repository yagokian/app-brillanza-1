import { useState, useEffect, useCallback, useMemo } from 'react';
import { View, StyleSheet, ScrollView, Alert, FlatList } from 'react-native';
import { TextInput, Button, Text, SegmentedButtons, Dialog, Portal } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { theme } from '../../../src/lib/theme';
import { getServicoAdmin, updateServicoAdmin, deleteServicoAdmin } from '../../../src/services/servicosAdmin';
import { getClientes } from '../../../src/services/clientes';
import { getTrabalhadoras } from '../../../src/services/trabalhadoras';
import { Servico } from '../../../src/types/database';
import { Cliente, Trabalhadora } from '../../../src/types/database';

interface ServicoForm {
  cliente_id: string;
  trabalhadora_id: string;
  data_servico: string;
  hora_inicio_prevista: string;
  duracao_estimada: string;
  tipo_cobranca_cliente: 'hora' | 'diaria' | 'fixo' | null;
  valor_cliente: string;
  tipo_pagamento_trabalhadora: 'hora' | 'diaria' | 'fixo' | null;
  valor_trabalhadora: string;
  status: 'agendado' | 'em_andamento' | 'concluido' | 'cancelado';
  observacoes_trabalhadora: string;
}

const servicoSchema = z.object({
  cliente_id: z.string().min(1, 'Cliente e obrigatorio'),
  trabalhadora_id: z.string(),
  data_servico: z.string().min(1, 'Data e obrigatoria'),
  hora_inicio_prevista: z.string(),
  duracao_estimada: z.string(),
  tipo_cobranca_cliente: z.enum(['hora', 'diaria', 'fixo']).nullable(),
  valor_cliente: z.string(),
  tipo_pagamento_trabalhadora: z.enum(['hora', 'diaria', 'fixo']).nullable(),
  valor_trabalhadora: z.string(),
  status: z.enum(['agendado', 'em_andamento', 'concluido', 'cancelado']),
  observacoes_trabalhadora: z.string(),
});

const formatDateInput = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
};

const convertDateToISO = (dateStr: string): string => {
  if (!dateStr || dateStr.length !== 10) return dateStr;
  const [day, month, year] = dateStr.split('/');
  return `${year}-${month}-${day}`;
};

const convertISOToDate = (isoStr: string): string => {
  if (!isoStr || isoStr.length < 10) return isoStr;
  const [year, month, day] = isoStr.slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
};

const formatTimeInput = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2, 4)}`;
};

const formatDecimalInput = (value: string) => {
  const normalized = value.replace(/,/g, '.').replace(/[^\d.]/g, '');
  const [intPart, decimalPart] = normalized.split('.');
  if (!decimalPart) return intPart || '';
  return `${intPart || '0'}.${decimalPart.slice(0, 2)}`;
};

export default function ServicoDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [servico, setServico] = useState<Servico | null>(null);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [trabalhadoras, setTrabalhadoras] = useState<Trabalhadora[]>([]);
  const [showClienteDialog, setShowClienteDialog] = useState(false);
  const [showTrabalhadoraDialog, setShowTrabalhadoraDialog] = useState(false);
  const [clienteQuery, setClienteQuery] = useState('');
  const [trabalhadoraQuery, setTrabalhadoraQuery] = useState('');

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isDirty },
  } = useForm<ServicoForm>({
    resolver: zodResolver(servicoSchema),
  });

  const loadLookups = useCallback(async () => {
    try {
      const [clientesData, trabalhadorasData] = await Promise.all([
        getClientes(),
        getTrabalhadoras(),
      ]);
      setClientes(clientesData || []);
      setTrabalhadoras(trabalhadorasData || []);
    } catch (error) {
      console.error('Error loading lookups:', error);
    }
  }, []);

  const loadServico = useCallback(async () => {
    if (!id) return;
    try {
      const data = await getServicoAdmin(id);
      setServico(data);
      reset({
        cliente_id: data.cliente_id,
        trabalhadora_id: data.trabalhadora_id || '',
        data_servico: convertISOToDate(data.data_servico),
        hora_inicio_prevista: data.hora_inicio_prevista || '',
        duracao_estimada: data.duracao_estimada || '',
        tipo_cobranca_cliente: data.tipo_cobranca_cliente,
        valor_cliente: data.valor_cliente?.toString() || '',
        tipo_pagamento_trabalhadora: data.tipo_pagamento_trabalhadora,
        valor_trabalhadora: data.valor_trabalhadora?.toString() || '',
        status: data.status,
        observacoes_trabalhadora: data.observacoes_trabalhadora || '',
      });
    } catch (error) {
      console.error('Error loading servico:', error);
      Alert.alert('Erro', 'Nao foi possivel carregar o servico.');
      router.back();
    } finally {
      setLoading(false);
    }
  }, [id, reset, router]);

  useEffect(() => {
    loadServico();
    loadLookups();
  }, [loadServico, loadLookups]);

  const filteredClientes = useMemo(() => {
    const query = clienteQuery.trim().toLowerCase();
    if (!query) return clientes;
    return clientes.filter((cliente) =>
      cliente.nome.toLowerCase().includes(query)
    );
  }, [clientes, clienteQuery]);

  const filteredTrabalhadoras = useMemo(() => {
    const query = trabalhadoraQuery.trim().toLowerCase();
    if (!query) return trabalhadoras;
    return trabalhadoras.filter((trabalhadora) =>
      trabalhadora.nome.toLowerCase().includes(query)
    );
  }, [trabalhadoras, trabalhadoraQuery]);

  const getClienteLabel = (clienteId: string) => {
    if (!clienteId) return '';
    return (
      clientes.find((cliente) => cliente.id === clienteId)?.nome ||
      servico?.cliente?.nome ||
      ''
    );
  };

  const getTrabalhadoraLabel = (trabalhadoraId: string) => {
    if (!trabalhadoraId) return '';
    return (
      trabalhadoras.find((trabalhadora) => trabalhadora.id === trabalhadoraId)?.nome ||
      servico?.trabalhadora?.nome ||
      ''
    );
  };

  const handleSelectCliente = (clienteId: string) => {
    setValue('cliente_id', clienteId, { shouldValidate: true });
    setShowClienteDialog(false);
  };

  const handleSelectTrabalhadora = (trabalhadoraId: string) => {
    setValue('trabalhadora_id', trabalhadoraId);
    setShowTrabalhadoraDialog(false);
  };

  const handleClearTrabalhadora = () => {
    setValue('trabalhadora_id', '');
    setShowTrabalhadoraDialog(false);
  };

  async function onSubmit(data: ServicoForm) {
    if (!id) return;
    setSaving(true);
    try {
      await updateServicoAdmin(id, {
        cliente_id: data.cliente_id,
        trabalhadora_id: data.trabalhadora_id || null,
        data_servico: convertDateToISO(data.data_servico),
        hora_inicio_prevista: data.hora_inicio_prevista || null,
        duracao_estimada: data.duracao_estimada || null,
        tipo_cobranca_cliente: data.tipo_cobranca_cliente || null,
        valor_cliente: data.valor_cliente ? parseFloat(data.valor_cliente) : null,
        tipo_pagamento_trabalhadora: data.tipo_pagamento_trabalhadora || null,
        valor_trabalhadora: data.valor_trabalhadora ? parseFloat(data.valor_trabalhadora) : null,
        status: data.status,
        observacoes_trabalhadora: data.observacoes_trabalhadora || null,
      });
      Alert.alert('Sucesso', 'Servico atualizado com sucesso.');
      router.back();
    } catch (error) {
      console.error('Error updating servico:', error);
      Alert.alert('Erro', 'Nao foi possivel atualizar o servico.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!id) return;
    setDeleting(true);
    try {
      await deleteServicoAdmin(id);
      setShowDeleteDialog(false);
      Alert.alert('Sucesso', 'Servico excluido com sucesso.');
      router.back();
    } catch (error) {
      console.error('Error deleting servico:', error);
      Alert.alert('Erro', 'Nao foi possivel excluir o servico.');
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
          Cliente e trabalhadora
        </Text>
        <Controller
          control={control}
          name="cliente_id"
          render={({ field: { value } }) => (
            <View style={styles.inputContainer}>
              <TextInput
                label="Cliente"
                value={getClienteLabel(value)}
                mode="outlined"
                placeholder="Selecionar cliente"
                editable={false}
                right={
                  <TextInput.Icon
                    icon="menu-down"
                    onPress={() => setShowClienteDialog(true)}
                  />
                }
                error={!!errors.cliente_id}
              />
              {errors.cliente_id && (
                <Text variant="bodySmall" style={styles.errorText}>
                  {errors.cliente_id.message}
                </Text>
              )}
            </View>
          )}
        />

        <Controller
          control={control}
          name="trabalhadora_id"
          render={({ field: { value } }) => (
            <View style={styles.inputContainer}>
              <TextInput
                label="Trabalhadora (opcional)"
                value={getTrabalhadoraLabel(value)}
                mode="outlined"
                placeholder="Selecionar trabalhadora"
                editable={false}
                right={
                  <TextInput.Icon
                    icon="menu-down"
                    onPress={() => setShowTrabalhadoraDialog(true)}
                  />
                }
              />
            </View>
          )}
        />

        <Text variant="titleSmall" style={styles.sectionTitle}>
          Agendamento
        </Text>
        <Controller
          control={control}
          name="data_servico"
          render={({ field: { onChange, onBlur, value } }) => (
            <View style={styles.inputContainer}>
              <TextInput
                label="Data do servico"
                value={value}
                onChangeText={(text) => onChange(formatDateInput(text))}
                onBlur={onBlur}
                mode="outlined"
                error={!!errors.data_servico}
                keyboardType="number-pad"
                maxLength={10}
              />
              {errors.data_servico && (
                <Text variant="bodySmall" style={styles.errorText}>
                  {errors.data_servico.message}
                </Text>
              )}
            </View>
          )}
        />

        <Controller
          control={control}
          name="hora_inicio_prevista"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              label="Hora inicio prevista"
              value={value}
              onChangeText={(text) => onChange(formatTimeInput(text))}
              onBlur={onBlur}
              mode="outlined"
              placeholder="HH:MM"
              keyboardType="number-pad"
              maxLength={5}
              style={styles.input}
            />
          )}
        />

        <Controller
          control={control}
          name="duracao_estimada"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              label="Duracao estimada"
              value={value}
              onChangeText={(text) => onChange(formatTimeInput(text))}
              onBlur={onBlur}
              mode="outlined"
              placeholder="HH:MM"
              keyboardType="number-pad"
              maxLength={5}
              style={styles.input}
            />
          )}
        />

        <Text variant="titleSmall" style={styles.sectionTitle}>
          Cobranca
        </Text>
        <Controller
          control={control}
          name="tipo_cobranca_cliente"
          render={({ field: { onChange, value } }) => (
            <SegmentedButtons
              value={value || ''}
              onValueChange={onChange}
              buttons={[
                { value: 'hora', label: 'Hora' },
                { value: 'diaria', label: 'Diaria' },
                { value: 'fixo', label: 'Fixo' },
              ]}
              style={styles.segmented}
            />
          )}
        />

        <Controller
          control={control}
          name="valor_cliente"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              label="Valor cliente"
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
          Pagamento trabalhadora
        </Text>
        <Controller
          control={control}
          name="tipo_pagamento_trabalhadora"
          render={({ field: { onChange, value } }) => (
            <SegmentedButtons
              value={value || ''}
              onValueChange={onChange}
              buttons={[
                { value: 'hora', label: 'Hora' },
                { value: 'diaria', label: 'Diaria' },
                { value: 'fixo', label: 'Fixo' },
              ]}
              style={styles.segmented}
            />
          )}
        />

        <Controller
          control={control}
          name="valor_trabalhadora"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              label="Valor trabalhadora"
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
          Status
        </Text>
        <Controller
          control={control}
          name="status"
          render={({ field: { onChange, value } }) => (
            <SegmentedButtons
              value={value}
              onValueChange={onChange}
              buttons={[
                { value: 'agendado', label: 'Agendado' },
                { value: 'em_andamento', label: 'Em andamento' },
                { value: 'concluido', label: 'Concluido' },
                { value: 'cancelado', label: 'Cancelado' },
              ]}
              style={styles.segmented}
            />
          )}
        />

        <Controller
          control={control}
          name="observacoes_trabalhadora"
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

        <View style={styles.buttonContainer}>
          <Button
            mode="outlined"
            onPress={() => router.back()}
            style={styles.button}
          >
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
          Excluir Servico
        </Button>
      </ScrollView>

      <Portal>
        <Dialog visible={showDeleteDialog} onDismiss={() => setShowDeleteDialog(false)}>
          <Dialog.Title>Excluir Servico</Dialog.Title>
          <Dialog.Content>
            <Text>Tem certeza que deseja excluir este servico?</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowDeleteDialog(false)}>Cancelar</Button>
            <Button
              onPress={handleDelete}
              loading={deleting}
              textColor={theme.colors.error}
            >
              Excluir
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={showClienteDialog} onDismiss={() => setShowClienteDialog(false)}>
          <Dialog.Title>Selecionar cliente</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Buscar cliente"
              value={clienteQuery}
              onChangeText={setClienteQuery}
              mode="outlined"
              style={styles.dialogInput}
            />
            <FlatList
              data={filteredClientes}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <Button mode="text" onPress={() => handleSelectCliente(item.id)}>
                  {item.nome}
                </Button>
              )}
              ListEmptyComponent={
                <Text variant="bodySmall" style={styles.emptyListText}>
                  Nenhum cliente encontrado
                </Text>
              }
              style={styles.dialogList}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowClienteDialog(false)}>Fechar</Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog
          visible={showTrabalhadoraDialog}
          onDismiss={() => setShowTrabalhadoraDialog(false)}
        >
          <Dialog.Title>Selecionar trabalhadora</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Buscar trabalhadora"
              value={trabalhadoraQuery}
              onChangeText={setTrabalhadoraQuery}
              mode="outlined"
              style={styles.dialogInput}
            />
            <Button mode="text" onPress={handleClearTrabalhadora}>
              Sem trabalhadora
            </Button>
            <FlatList
              data={filteredTrabalhadoras}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <Button mode="text" onPress={() => handleSelectTrabalhadora(item.id)}>
                  {item.nome}
                </Button>
              )}
              ListEmptyComponent={
                <Text variant="bodySmall" style={styles.emptyListText}>
                  Nenhuma trabalhadora encontrada
                </Text>
              }
              style={styles.dialogList}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowTrabalhadoraDialog(false)}>Fechar</Button>
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
    marginBottom: 16,
  },
  inputContainer: {
    marginBottom: 16,
  },
  input: {
    marginBottom: 16,
  },
  segmented: {
    marginBottom: 16,
  },
  errorText: {
    color: theme.colors.error,
    marginTop: 4,
  },
  dialogInput: {
    marginBottom: 12,
  },
  dialogList: {
    maxHeight: 220,
  },
  emptyListText: {
    color: theme.colors.outline,
    marginTop: 8,
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
    marginTop: 24,
  },
});
