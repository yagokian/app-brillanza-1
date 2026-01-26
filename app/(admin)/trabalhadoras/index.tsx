import { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { Searchbar, FAB, Card, Text, Chip } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '../../../src/lib/theme';
import { getTrabalhadoras, searchTrabalhadoras } from '../../../src/services/trabalhadoras';
import { Trabalhadora } from '../../../src/types/database';

export default function TrabalhadorasScreen() {
  const router = useRouter();
  const [trabalhadoras, setTrabalhadoras] = useState<Trabalhadora[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
    }, 300);

    return () => clearTimeout(handler);
  }, [searchQuery]);

  const fetchTrabalhadoras = useCallback(async () => {
    setLoading(true);
    try {
      const data = debouncedQuery
        ? await searchTrabalhadoras(debouncedQuery)
        : await getTrabalhadoras();
      setTrabalhadoras(data || []);
    } catch (error) {
      console.error('Error fetching trabalhadoras:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [debouncedQuery]);

  useEffect(() => {
    fetchTrabalhadoras();
  }, [fetchTrabalhadoras]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchTrabalhadoras();
  }, [fetchTrabalhadoras]);

  const renderTrabalhadoraItem = ({ item }: { item: Trabalhadora }) => {
    const statusColor = item.ativo ? theme.colors.primary : theme.colors.outline;
    return (
      <Card
        style={styles.card}
        onPress={() => router.push(`/(admin)/trabalhadoras/${item.id}`)}
      >
        <Card.Content>
          <View style={styles.cardHeader}>
            <View style={styles.cardInfo}>
              <Text variant="titleMedium" style={styles.nome}>
                {item.nome}
              </Text>
              {item.telefone && (
                <Text variant="bodySmall" style={styles.telefone}>
                  <MaterialCommunityIcons name="phone" size={12} /> {item.telefone}
                </Text>
              )}
            </View>
            <Chip
              mode="flat"
              style={[styles.statusChip, { backgroundColor: `${statusColor}20` }]}
              textStyle={{ color: statusColor }}
            >
              {item.ativo ? 'Ativa' : 'Inativa'}
            </Chip>
          </View>
          <Text variant="bodySmall" style={styles.userText}>
            {item.user_id ? 'Vinculada a usuario' : 'Sem usuario vinculado'}
          </Text>
        </Card.Content>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      <Searchbar
        placeholder="Buscar trabalhadora..."
        onChangeText={setSearchQuery}
        value={searchQuery}
        style={styles.searchbar}
      />

      {loading ? (
        <View style={styles.loadingContainer}>
          <Text>Carregando...</Text>
        </View>
      ) : trabalhadoras.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons
            name="account-hard-hat-outline"
            size={64}
            color={theme.colors.outline}
          />
          <Text variant="titleMedium" style={styles.emptyTitle}>
            Nenhuma trabalhadora cadastrada
          </Text>
          <Text variant="bodyMedium" style={styles.emptySubtitle}>
            Toque no + para adicionar
          </Text>
        </View>
      ) : (
        <FlatList
          data={trabalhadoras}
          keyExtractor={(item) => item.id}
          renderItem={renderTrabalhadoraItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={styles.listContent}
        />
      )}

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => router.push('/(admin)/trabalhadoras/nova')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  searchbar: {
    margin: 16,
    marginBottom: 8,
  },
  listContent: {
    padding: 16,
    paddingTop: 8,
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
    marginRight: 12,
  },
  nome: {
    color: theme.colors.onSurface,
  },
  telefone: {
    color: theme.colors.outline,
    marginTop: 4,
  },
  statusChip: {
    height: 28,
  },
  userText: {
    marginTop: 8,
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
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    backgroundColor: theme.colors.primary,
  },
});
