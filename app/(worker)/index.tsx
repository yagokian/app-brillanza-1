import { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { Text, Card, Button, Chip, Surface } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { theme, statusColors } from '../../src/lib/theme';
import { Servico } from '../../src/types/database';
import { getServicosWithCliente } from '../../src/services/servicos';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { format, isToday, isTomorrow, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function WorkerAgenda() {
  const { profile, signOut } = useAuth();
  const router = useRouter();
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchServicos = useCallback(async () => {
    try {
      const data = await getServicosWithCliente();
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

  const getDateLabel = (dateStr: string) => {
    const date = parseISO(dateStr);
    if (isToday(date)) return 'Hoje';
    if (isTomorrow(date)) return 'Amanha';
    return format(date, "EEEE, d 'de' MMMM", { locale: ptBR });
  };

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
      style={styles.servicoCard}
      onPress={() => router.push(`/(worker)/servico/${item.id}`)}
    >
      <Card.Content>
        <View style={styles.servicoHeader}>
          <View style={styles.servicoInfo}>
            <Text variant="titleMedium" style={styles.clienteName}>
              {item.cliente?.nome || 'Cliente'}
            </Text>
            {item.hora_inicio_prevista && (
              <Text variant="bodyMedium" style={styles.horario}>
                <MaterialCommunityIcons name="clock-outline" size={14} />{' '}
                {item.hora_inicio_prevista.substring(0, 5)}
              </Text>
            )}
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

        {item.cliente?.endereco && (
          <View style={styles.enderecoContainer}>
            <MaterialCommunityIcons
              name="map-marker"
              size={16}
              color={theme.colors.outline}
            />
            <Text variant="bodySmall" style={styles.endereco}>
              {item.cliente.endereco}
            </Text>
          </View>
        )}
      </Card.Content>
    </Card>
  );

  const renderSectionHeader = (date: string) => (
    <Text variant="titleSmall" style={styles.sectionHeader}>
      {getDateLabel(date)}
    </Text>
  );

  // Agrupar servicos por data
  const groupedServicos = servicos.reduce((acc, servico) => {
    const date = servico.data_servico;
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(servico);
    return acc;
  }, {} as Record<string, Servico[]>);

  const groupedDates = Object.keys(groupedServicos).sort((a, b) => a.localeCompare(b));

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Header com logout */}
      <Surface style={styles.header} elevation={0}>
        <View>
          <Text variant="bodyLarge" style={styles.greeting}>
            Ola, {profile?.nome?.split(' ')[0] || 'Trabalhadora'}
          </Text>
        </View>
        <Button mode="text" onPress={signOut} textColor={theme.colors.error}>
          Sair
        </Button>
      </Surface>

      {loading ? (
        <View style={styles.loadingContainer}>
          <Text>Carregando...</Text>
        </View>
      ) : servicos.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons
            name="calendar-blank"
            size={64}
            color={theme.colors.outline}
          />
          <Text variant="titleMedium" style={styles.emptyTitle}>
            Nenhum servico agendado
          </Text>
          <Text variant="bodyMedium" style={styles.emptySubtitle}>
            Seus servicos aparecerao aqui
          </Text>
        </View>
      ) : (
        <FlatList
          data={groupedDates}
          keyExtractor={(item) => item}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          renderItem={({ item: date }) => (
            <View>
              {renderSectionHeader(date)}
              {groupedServicos[date].map((servico) => (
                <View key={servico.id}>
                  {renderServicoItem({ item: servico })}
                </View>
              ))}
            </View>
          )}
          contentContainerStyle={styles.listContent}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'transparent',
  },
  greeting: {
    color: theme.colors.onBackground,
  },
  listContent: {
    padding: 16,
  },
  sectionHeader: {
    color: theme.colors.primary,
    marginTop: 16,
    marginBottom: 8,
    textTransform: 'capitalize',
  },
  servicoCard: {
    marginBottom: 12,
    backgroundColor: theme.colors.surface,
  },
  servicoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  servicoInfo: {
    flex: 1,
  },
  clienteName: {
    color: theme.colors.onSurface,
    fontWeight: '600',
  },
  horario: {
    color: theme.colors.outline,
    marginTop: 4,
  },
  statusChip: {
    height: 28,
  },
  enderecoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 4,
  },
  endereco: {
    color: theme.colors.outline,
    flex: 1,
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
});
