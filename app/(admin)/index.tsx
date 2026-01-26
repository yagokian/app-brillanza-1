import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Card, Button, Avatar, Surface } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { theme } from '../../src/lib/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function AdminDashboard() {
  const { profile, signOut } = useAuth();
  const router = useRouter();

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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
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

        {/* Stats Cards - Placeholder */}
        <View style={styles.statsContainer}>
          <Surface style={styles.statCard} elevation={1}>
            <View style={styles.statContent}>
              <MaterialCommunityIcons
                name="calendar-today"
                size={24}
                color={theme.colors.primary}
              />
              <Text variant="headlineMedium" style={styles.statNumber}>
                0
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
                0
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
                0
              </Text>
              <Text variant="bodySmall" style={styles.statLabel}>
                Concluidos
              </Text>
            </View>
          </Surface>
        </View>

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

        {/* Recent Activity - Placeholder */}
        <Text variant="titleMedium" style={styles.sectionTitle}>
          Atividade Recente
        </Text>
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
