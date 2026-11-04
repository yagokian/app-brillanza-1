import { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Text, Card, Button, Avatar, Surface, ActivityIndicator, List, Chip } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { theme } from '../../src/lib/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { getDashboardStats, DashboardStats } from '../../src/services/servicosAdmin';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function AdminDashboard() {
  const { profile, signOut } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      const data = await getDashboardStats();
      setStats(data);
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchStats();
    }, [fetchStats])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchStats();
  }, [fetchStats]);

  const quickActions = [
    {
      title: 'Novo Cliente',
      icon: 'account-plus',
      onPress: () => router.push('/(admin)/clientes/novo'),
      color: '#2563EB',
    },
    {
      title: 'Nova Trabalhadora',
      icon: 'account-hard-hat',
      onPress: () => router.push('/(admin)/trabalhadoras/nova'),
      color: '#111827',
    },
    {
      title: 'Agendar Servico',
      icon: 'calendar-plus',
      onPress: () => router.push('/(admin)/servicos/novo'),
      color: '#7C3AED',
    },
    {
      title: 'Ver Relatorios',
      icon: 'chart-bar',
      onPress: () => router.push('/(admin)/relatorios'),
      color: '#10B981',
    },
  ];

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      agendado: 'Agendado',
      em_andamento: 'Em Andamento',
      concluido: 'Concluido',
      cancelado: 'Cancelado',
    };
    return labels[status] || status;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      agendado: '#7E57C2',
      em_andamento: '#F9A825',
      concluido: '#2E7D32',
      cancelado: '#C62828',
    };
    return colors[status] || theme.colors.outline;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <Text variant="titleSmall" style={styles.pageTitle}>
          Inicio
        </Text>
        {/* Header */}
        <Surface style={styles.header} elevation={0}>
          <View>
            <Text variant="headlineSmall" style={styles.greeting}>
              Ola, {profile?.nome?.split(' ')[0] || 'Admin'}!
            </Text>
            <Text variant="bodyMedium" style={styles.subtitle}>
              Painel Administrativo
            </Text>
          </View>
          <Button mode="text" onPress={signOut} textColor={theme.colors.error}>
            Sair
          </Button>
        </Surface>

        {/* Stats Cards */}
        {loading && !refreshing ? (
          <ActivityIndicator style={{ marginVertical: 24 }} color={theme.colors.primary} />
        ) : (
          <View style={styles.statsContainer}>
            <Surface style={styles.statCard} elevation={1}>
              <View style={styles.statContent}>
                <MaterialCommunityIcons
                  name="calendar-today"
                  size={24}
                  color={theme.colors.primary}
                />
                <Text variant="headlineMedium" style={styles.statNumber}>
                  {stats?.servicosHoje ?? 0}
                </Text>
                <Text variant="bodySmall" style={styles.statLabel}>
                  Servicos Hoje
                </Text>
              </View>
            </Surface>

            <Surface style={styles.statCard} elevation={1}>
              <View style={styles.statContent}>
                <MaterialCommunityIcons
                  name="clock-outline"
                  size={24}
                  color="#F59E0B"
                />
                <Text variant="headlineMedium" style={styles.statNumber}>
                  {stats?.emAndamento ?? 0}
                </Text>
                <Text variant="bodySmall" style={styles.statLabel}>
                  Em Andamento
                </Text>
              </View>
            </Surface>

            <Surface style={styles.statCard} elevation={1}>
              <View style={styles.statContent}>
                <MaterialCommunityIcons
                  name="check-circle"
                  size={24}
                  color="#10B981"
                />
                <Text variant="headlineMedium" style={styles.statNumber}>
                  {stats?.concluidosHoje ?? 0}
                </Text>
                <Text variant="bodySmall" style={styles.statLabel}>
                  Concluidos Hoje
                </Text>
              </View>
            </Surface>
          </View>
        )}

        {/* Quick Actions */}
        <Text variant="titleMedium" style={styles.sectionTitle}>
          Acoes Rapidas
        </Text>
        <View style={styles.actionsGrid}>
          {quickActions.map((action, index) => (
            <Card
              key={index}
              style={styles.actionCard}
              onPress={action.onPress}
            >
              <Card.Content style={styles.actionContent}>
                <Avatar.Icon
                  size={44}
                  icon={action.icon}
                  style={{ backgroundColor: action.color }}
                />
                <Text variant="bodyMedium" style={styles.actionTitle}>
                  {action.title}
                </Text>
              </Card.Content>
            </Card>
          ))}
        </View>

        {/* Recent Activity */}
        <Text variant="titleMedium" style={styles.sectionTitle}>
          Atividade Recente
        </Text>
        {loading && !refreshing ? (
          <ActivityIndicator style={{ marginVertical: 16 }} color={theme.colors.primary} />
        ) : !stats?.atividadeRecente || stats.atividadeRecente.length === 0 ? (
          <Card style={styles.activityCard}>
            <Card.Content>
              <View style={styles.emptyState}>
                <MaterialCommunityIcons
                  name="clipboard-text-outline"
                  size={48}
                  color={theme.colors.outline}
                />
                <Text variant="bodyMedium" style={styles.emptyText}>
                  Nenhuma atividade recente
                </Text>
                <Text variant="bodySmall" style={styles.emptySubtext}>
                  As atividades aparecerao aqui
                </Text>
              </View>
            </Card.Content>
          </Card>
        ) : (
          <Card style={styles.activityCardList}>
            <Card.Content style={{ paddingHorizontal: 4, paddingVertical: 4 }}>
              {stats.atividadeRecente.map((item, index) => (
                <List.Item
                  key={item.id}
                  title={item.cliente?.nome || 'Servico sem Cliente'}
                  description={`${format(parseISO(item.data_servico), "dd/MM/yyyy")} ${
                    item.hora_inicio_prevista ? `• ${item.hora_inicio_prevista.substring(0, 5)}` : ''
                  } ${item.trabalhadora?.nome ? `• ${item.trabalhadora.nome}` : ''}`}
                  left={(props) => (
                    <List.Icon
                      {...props}
                      icon="calendar"
                      color={getStatusColor(item.status)}
                    />
                  )}
                  right={() => (
                    <Chip
                      mode="outlined"
                      textStyle={{ color: getStatusColor(item.status), fontSize: 11 }}
                      style={{ alignSelf: 'center', height: 26, marginRight: 8 }}
                    >
                      {getStatusLabel(item.status)}
                    </Chip>
                  )}
                  style={index < stats.atividadeRecente.length - 1 ? styles.listItemBorder : undefined}
                  onPress={() => router.push(`/(admin)/servicos/${item.id}`)}
                />
              ))}
            </Card.Content>
          </Card>
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
  scrollContent: {
    padding: 16,
  },
  pageTitle: {
    color: theme.colors.outline,
    marginBottom: 12,
    textTransform: 'capitalize',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    backgroundColor: 'transparent',
  },
  greeting: {
    color: theme.colors.onBackground,
    fontWeight: 'bold',
  },
  subtitle: {
    color: theme.colors.outline,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 14,
    paddingVertical: 6,
  },
  statContent: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  statNumber: {
    fontWeight: 'bold',
    color: theme.colors.onSurface,
    marginTop: 8,
  },
  statLabel: {
    color: theme.colors.outline,
    textAlign: 'center',
  },
  sectionTitle: {
    color: theme.colors.onBackground,
    marginBottom: 12,
    fontWeight: '600',
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  actionCard: {
    width: '47%',
    backgroundColor: '#F3F4F6',
    borderRadius: 14,
  },
  actionContent: {
    alignItems: 'center',
    paddingVertical: 18,
  },
  actionTitle: {
    marginTop: 12,
    textAlign: 'center',
    color: theme.colors.onSurface,
  },
  activityCard: {
    backgroundColor: '#F3F4F6',
    borderRadius: 14,
    marginBottom: 16,
  },
  activityCardList: {
    backgroundColor: '#F3F4F6',
    borderRadius: 14,
    marginBottom: 16,
  },
  listItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    color: theme.colors.outline,
    marginTop: 12,
  },
  emptySubtext: {
    color: theme.colors.outline,
    marginTop: 4,
  },
});
