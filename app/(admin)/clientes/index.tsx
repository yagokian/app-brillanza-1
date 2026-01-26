import { useState, useCallback } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { Searchbar, FAB, Card, Text, Chip } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { theme } from '../../../src/lib/theme';
import { getClientes, searchClientes } from '../../../src/services/clientes';
import { Cliente } from '../../../src/types/database';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function ClientesScreen() {
  const router = useRouter();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  const fetchClientes = useCallback(async (query?: string) => {
    setLoading(true);
    try {
      const data = query
        ? await searchClientes(query)
        : await getClientes();
      setClientes(data || []);
    } catch (error) {
      console.error('Error fetching clientes:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Recarrega lista sempre que a tela ganha foco
  useFocusEffect(
    useCallback(() => {
      fetchClientes(debouncedQuery || undefined);
    }, [fetchClientes, debouncedQuery])
  );

  // Debounce da busca
  useFocusEffect(
    useCallback(() => {
      const handler = setTimeout(() => {
        setDebouncedQuery(searchQuery.trim());
      }, 300);
      return () => clearTimeout(handler);
    }, [searchQuery])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchClientes(debouncedQuery || undefined);
  }, [fetchClientes, debouncedQuery]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  const renderClienteItem = ({ item }: { item: Cliente }) => (
    <Card
      style={styles.card}
      onPress={() => router.push(`/(admin)/clientes/${item.id}`)}
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
          {item.tipo_cobranca && (
            <Chip mode="outlined" compact style={styles.chip}>
              {item.tipo_cobranca === 'hora' ? 'Por Hora' :
               item.tipo_cobranca === 'diaria' ? 'Diaria' : 'Fixo'}
            </Chip>
          )}
        </View>
        {item.endereco && (
          <View style={styles.enderecoContainer}>
            <MaterialCommunityIcons
              name="map-marker"
              size={14}
              color={theme.colors.outline}
            />
            <Text variant="bodySmall" style={styles.endereco} numberOfLines={1}>
              {item.endereco}
            </Text>
          </View>
        )}
      </Card.Content>
    </Card>
  );

  return (
    <View style={styles.container}>
      <Searchbar
        placeholder="Buscar cliente..."
        onChangeText={handleSearch}
        value={searchQuery}
        style={styles.searchbar}
      />

      {loading ? (
        <View style={styles.loadingContainer}>
          <Text>Carregando...</Text>
        </View>
      ) : clientes.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons
            name="account-group-outline"
            size={64}
            color={theme.colors.outline}
          />
          <Text variant="titleMedium" style={styles.emptyTitle}>
            {debouncedQuery ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'}
          </Text>
          <Text variant="bodyMedium" style={styles.emptySubtitle}>
            {debouncedQuery ? 'Tente outra busca' : 'Toque no + para adicionar'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={clientes}
          keyExtractor={(item) => item.id}
          renderItem={renderClienteItem}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          contentContainerStyle={styles.listContent}
        />
      )}

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => router.push('/(admin)/clientes/novo')}
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
  },
  nome: {
    color: theme.colors.onSurface,
    fontWeight: '600',
  },
  telefone: {
    color: theme.colors.outline,
    marginTop: 4,
  },
  chip: {
    height: 24,
  },
  enderecoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
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
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    backgroundColor: theme.colors.primary,
  },
});
