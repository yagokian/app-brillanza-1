import { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { Text, Card, Chip, FAB } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme, statusColors } from '../../../src/lib/theme';
import { getServicosAdmin } from '../../../src/services/servicosAdmin';
import { Servico } from '../../../src/types/database';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function ServicosScreen() {
  const router = useRouter();
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchServicos = useCallback(async () => {
    try {
      const data = await getServicosAdmin();
      setServicos(data || []);
    } catch (error) {
      console.error('Error fetching servicos:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchServicos();
  }, [fetchServicos]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchServicos();
  }, [fetchServicos]);

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      agendado: 'Agendado',
      em_andamento: 'Em Andamento',
      concluido: 'Concluido',
      cancelado: 'Cancelado',
    };
    return labels[status] || status;
  };

  const renderServicoItem = ({ item }: { item: Servico }) => (
    <Card
      style={styles.card}
      onPress={() => router.push(`/(admin)/servicos/${item.id}`)}
    >
      <Card.Content>
        <View style={styles.cardHeader}>
          <View style={styles.cardInfo}>
            <Text variant="titleMedium" style={styles.title}>
              {item.cliente?.nome || 'Cliente'}
            </Text>
            <Text variant="bodySmall" style={styles.subtitle}>
              {format(parseISO(item.data_servico), "d 'de' MMMM", { locale: ptBR })}
              {item.hora_inicio_prevista ? ` • ${item.hora_inicio_prevista.substring(0, 5)}` : ''}
            </Text>
          </View>
          <Chip
            mode="flat"
            style={[
              styles.statusChip,
              { backgroundColor: statusColors[item.status as keyof typeof statusColors] + '20' },
            ]}
            textStyle={{ color: statusColors[item.status as keyof typeof statusColors] }}
          >
            {getStatusLabel(item.status)}
          </Chip>
        </View>
        {item.trabalhadora?.nome && (
          <View style={styles.workerRow}>
            <MaterialCommunityIcons
              name="account-hard-hat"
              size={16}
              color={theme.colors.outline}
            />
            <Text variant="bodySmall" style={styles.workerText}>
              {item.trabalhadora.nome}
            </Text>
          </View>
        )}
      </Card.Content>
    </Card>
  );

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={styles.loadingContainer}>
          <Text>Carregando...</Text>
        </View>
      ) : servicos.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons
            name="calendar-check-outline"
            size={64}
            color={theme.colors.outline}
          />
          <Text variant="titleMedium" style={styles.emptyTitle}>
            Nenhum servico agendado
          </Text>
          <Text variant="bodyMedium" style={styles.emptySubtitle}>
            Toque no + para criar um novo servico
          </Text>
        </View>
      ) : (
        <FlatList
          data={servicos}
          keyExtractor={(item) => item.id}
          renderItem={renderServicoItem}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          contentContainerStyle={styles.listContent}
        />
      )}

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => router.push('/(admin)/servicos/novo')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  listContent: {
    padding: 16,
  },
  card: {
    marginBottom: 12,
    backgroundColor: theme.colors.surface,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardInfo: {
    flex: 1,
  },
  title: {
    color: theme.colors.onSurface,
    fontWeight: '600',
  },
  subtitle: {
    color: theme.colors.outline,
    marginTop: 4,
  },
  statusChip: {
    height: 28,
  },
  workerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  workerText: {
    color: theme.colors.outline,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyTitle: {
    color: theme.colors.onSurface,
    marginTop: 16,
  },
  emptySubtitle: {
    color: theme.colors.outline,
    marginTop: 4,
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    backgroundColor: theme.colors.primary,
  },
});
