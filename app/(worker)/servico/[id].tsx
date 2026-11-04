import { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Alert, Linking } from 'react-native';
import { Text, Card, Button, Chip, TextInput, Surface, Checkbox } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { theme, statusColors } from '../../../src/lib/theme';
import { Servico } from '../../../src/types/database';
import { getServicoById, startServico, finishServico, saveObservacoes, saveChecklist } from '../../../src/services/servicos';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function ServicoDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [servico, setServico] = useState<Servico | null>(null);
  const [observacoes, setObservacoes] = useState('');
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});

  const loadServico = useCallback(async () => {
    if (!id) return;
    try {
      const data = await getServicoById(id);
      setServico(data);
      setObservacoes(data.observacoes_trabalhadora || '');
      setChecklist(data.checklist || {
        "Limpar banheiros": false,
        "Aspirar tapetes": false,
        "Limpar cozinha": false,
        "Remover lixo": false,
        "Passar pano no chão": false
      });
    } catch (error) {
      console.error('Error loading servico:', error);
      Alert.alert('Erro', 'Nao foi possivel carregar o servico.');
      router.back();
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    loadServico();
  }, [loadServico]);

  async function handleToggleChecklistItem(key: string) {
    if (!id || !servico) return;
    if (servico.status === 'concluido' || servico.status === 'cancelado') {
      return;
    }

    const updatedChecklist = {
      ...checklist,
      [key]: !checklist[key]
    };
    
    setChecklist(updatedChecklist);

    try {
      await saveChecklist(id, updatedChecklist);
    } catch (error) {
      console.error('Error saving checklist:', error);
      setChecklist(checklist);
      Alert.alert('Erro', 'Não foi possível salvar o checklist.');
    }
  }

  async function handleIniciar() {
    if (!id || !servico) return;
    setUpdating(true);
    try {
      await startServico(id);
      await loadServico();
      Alert.alert('Sucesso', 'Servico iniciado!');
    } catch (error) {
      console.error('Error starting servico:', error);
      Alert.alert('Erro', 'Nao foi possivel iniciar o servico.');
    } finally {
      setUpdating(false);
    }
  }

  async function handleFinalizar() {
    if (!id || !servico) return;
    setUpdating(true);
    try {
      await finishServico(id, observacoes);
      await loadServico();
      Alert.alert('Sucesso', 'Servico finalizado!');
    } catch (error) {
      console.error('Error finishing servico:', error);
      Alert.alert('Erro', 'Nao foi possivel finalizar o servico.');
    } finally {
      setUpdating(false);
    }
  }

  async function handleSalvarObservacoes() {
    if (!id) return;
    setUpdating(true);
    try {
      await saveObservacoes(id, observacoes);
      Alert.alert('Sucesso', 'Observacoes salvas!');
    } catch (error) {
      console.error('Error saving observacoes:', error);
      Alert.alert('Erro', 'Nao foi possivel salvar as observacoes.');
    } finally {
      setUpdating(false);
    }
  }

  function handleLigar() {
    if (servico?.cliente?.telefone) {
      Linking.openURL(`tel:${servico.cliente.telefone}`);
    }
  }

  function handleMapa() {
    if (servico?.cliente?.endereco) {
      const address = encodeURIComponent(servico.cliente.endereco);
      Linking.openURL(`https://maps.google.com/?q=${address}`);
    }
  }

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      agendado: 'Agendado',
      em_andamento: 'Em Andamento',
      concluido: 'Concluido',
      cancelado: 'Cancelado',
    };
    return labels[status] || status;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Carregando...</Text>
      </View>
    );
  }

  if (!servico) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Servico nao encontrado</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Status */}
        <Surface style={styles.statusContainer} elevation={0}>
          <Chip
            mode="flat"
            style={[
              styles.statusChip,
              { backgroundColor: statusColors[servico.status as keyof typeof statusColors] + '20' },
            ]}
            textStyle={{ color: statusColors[servico.status as keyof typeof statusColors] }}
          >
            {getStatusLabel(servico.status)}
          </Chip>
          <Text variant="bodySmall" style={styles.dataServico}>
            {format(parseISO(servico.data_servico), "EEEE, d 'de' MMMM", { locale: ptBR })}
          </Text>
        </Surface>

        {/* Cliente */}
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.cardTitle}>
              Cliente
            </Text>
            <Text variant="headlineSmall" style={styles.clienteName}>
              {servico.cliente?.nome}
            </Text>
            {servico.cliente?.tipo_servico && (
              <Text variant="bodySmall" style={styles.tipoServico}>
                {servico.cliente.tipo_servico}
              </Text>
            )}

            {servico.cliente?.endereco && (
              <View style={styles.infoRow}>
                <MaterialCommunityIcons
                  name="map-marker"
                  size={20}
                  color={theme.colors.outline}
                />
                <Text variant="bodyMedium" style={styles.infoText}>
                  {servico.cliente.endereco}
                </Text>
              </View>
            )}

            {servico.cliente?.telefone && (
              <View style={styles.infoRow}>
                <MaterialCommunityIcons
                  name="phone"
                  size={20}
                  color={theme.colors.outline}
                />
                <Text variant="bodyMedium" style={styles.infoText}>
                  {servico.cliente.telefone}
                </Text>
              </View>
            )}

            <View style={styles.actionButtons}>
              {servico.cliente?.telefone && (
                <Button
                  mode="outlined"
                  icon="phone"
                  onPress={handleLigar}
                  style={styles.actionButton}
                >
                  Ligar
                </Button>
              )}
              {servico.cliente?.endereco && (
                <Button
                  mode="outlined"
                  icon="map"
                  onPress={handleMapa}
                  style={styles.actionButton}
                >
                  Mapa
                </Button>
              )}
            </View>
          </Card.Content>
        </Card>

        {/* Horarios */}
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.cardTitle}>
              Horarios
            </Text>

            <View style={styles.horariosContainer}>
              <View style={styles.horarioItem}>
                <Text variant="bodySmall" style={styles.horarioLabel}>
                  Previsto
                </Text>
                <Text variant="titleLarge" style={styles.horarioValue}>
                  {servico.hora_inicio_prevista?.substring(0, 5) || '--:--'}
                </Text>
              </View>

              {servico.hora_inicio_real && (
                <View style={styles.horarioItem}>
                  <Text variant="bodySmall" style={styles.horarioLabel}>
                    Inicio Real
                  </Text>
                  <Text variant="titleLarge" style={styles.horarioValue}>
                    {format(parseISO(servico.hora_inicio_real), 'HH:mm')}
                  </Text>
                </View>
              )}

              {servico.hora_fim_real && (
                <View style={styles.horarioItem}>
                  <Text variant="bodySmall" style={styles.horarioLabel}>
                    Fim Real
                  </Text>
                  <Text variant="titleLarge" style={styles.horarioValue}>
                    {format(parseISO(servico.hora_fim_real), 'HH:mm')}
                  </Text>
                </View>
              )}
            </View>
          </Card.Content>
        </Card>

        {/* Checklist */}
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.cardTitle}>
              Checklist de Tarefas
            </Text>
            {Object.keys(checklist).map((key) => (
              <View key={key} style={styles.checklistItem}>
                <Checkbox.Android
                  status={checklist[key] ? 'checked' : 'unchecked'}
                  onPress={() => handleToggleChecklistItem(key)}
                  disabled={servico.status === 'concluido' || servico.status === 'cancelado' || updating}
                  color={theme.colors.primary}
                />
                <Text
                  style={[
                    styles.checklistText,
                    checklist[key] && styles.checklistTextChecked,
                  ]}
                  onPress={() => {
                    if (servico.status !== 'concluido' && servico.status !== 'cancelado' && !updating) {
                      handleToggleChecklistItem(key);
                    }
                  }}
                >
                  {key}
                </Text>
              </View>
            ))}
          </Card.Content>
        </Card>

        {/* Observacoes */}
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.cardTitle}>
              Observacoes
            </Text>
            <TextInput
              mode="outlined"
              multiline
              numberOfLines={4}
              value={observacoes}
              onChangeText={setObservacoes}
              placeholder="Adicione observacoes sobre o servico..."
              style={styles.observacoesInput}
            />
            {servico.status !== 'concluido' && servico.status !== 'cancelado' && (
              <Button
                mode="text"
                onPress={handleSalvarObservacoes}
                loading={updating}
                disabled={updating}
              >
                Salvar Observacoes
              </Button>
            )}
          </Card.Content>
        </Card>

        {/* Botoes de acao */}
        {servico.status === 'agendado' && (
          <Button
            mode="contained"
            onPress={handleIniciar}
            loading={updating}
            disabled={updating}
            style={styles.mainButton}
            contentStyle={styles.mainButtonContent}
            icon="play"
          >
            Iniciar Servico
          </Button>
        )}

        {servico.status === 'em_andamento' && (
          <Button
            mode="contained"
            onPress={handleFinalizar}
            loading={updating}
            disabled={updating}
            style={[styles.mainButton, styles.mainButtonSuccess]}
            contentStyle={styles.mainButtonContent}
            icon="check"
          >
            Finalizar Servico
          </Button>
        )}
      </ScrollView>
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
  statusContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: 'transparent',
  },
  statusChip: {
    height: 32,
  },
  dataServico: {
    color: theme.colors.outline,
    textTransform: 'capitalize',
  },
  card: {
    marginBottom: 16,
    backgroundColor: theme.colors.surface,
  },
  cardTitle: {
    color: theme.colors.primary,
    marginBottom: 12,
  },
  clienteName: {
    color: theme.colors.onSurface,
    fontWeight: '600',
    marginBottom: 12,
  },
  tipoServico: {
    color: theme.colors.outline,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  infoText: {
    color: theme.colors.onSurfaceVariant,
    flex: 1,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  actionButton: {
    flex: 1,
  },
  horariosContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  horarioItem: {
    alignItems: 'center',
  },
  horarioLabel: {
    color: theme.colors.outline,
  },
  horarioValue: {
    color: theme.colors.onSurface,
    fontWeight: '600',
  },
  observacoesInput: {
    marginBottom: 8,
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  checklistText: {
    color: theme.colors.onSurface,
    fontSize: 16,
    marginLeft: 8,
    flex: 1,
  },
  checklistTextChecked: {
    textDecorationLine: 'line-through',
    color: theme.colors.outline,
  },
  mainButton: {
    marginTop: 8,
  },
  mainButtonSuccess: {
    backgroundColor: '#10B981',
  },
  mainButtonContent: {
    paddingVertical: 8,
  },
});
