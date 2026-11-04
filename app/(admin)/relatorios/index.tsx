import { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Text, Card, Button, TextInput, List, Surface, ActivityIndicator, Divider } from 'react-native-paper';
import { theme } from '../../../src/lib/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getRelatorios, RelatorioStats } from '../../../src/services/servicosAdmin';

export default function RelatoriosScreen() {
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [stats, setStats] = useState<RelatorioStats | null>(null);
  
  // Accordion states
  const [expandedWorkers, setExpandedWorkers] = useState(false);
  const [expandedClients, setExpandedClients] = useState(false);

  const formatDateInput = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 8);
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) {
      return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    }
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
  };

  const convertDateToISO = (dateStr: string): string => {
    if (!dateStr || dateStr.length !== 10) return '';
    const [day, month, year] = dateStr.split('/');
    return `${year}-${month}-${day}`;
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const fetchData = useCallback(async (start: string, end: string) => {
    if (start.length !== 10 || end.length !== 10) return;
    setLoading(true);
    try {
      const startISO = convertDateToISO(start);
      const endISO = convertDateToISO(end);
      const data = await getRelatorios(startISO, endISO);
      setStats(data);
    } catch (error) {
      console.error('Error fetching reports:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initialize dates and load initial data
  useEffect(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    
    const initialFim = `${day}/${month}/${year}`;
    const initialInicio = `01/${month}/${year}`;
    
    setDataFim(initialFim);
    setDataInicio(initialInicio);
    
    fetchData(initialInicio, initialFim);
  }, [fetchData]);

  const handleFiltrar = () => {
    fetchData(dataInicio, dataFim);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData(dataInicio, dataFim);
    setRefreshing(false);
  };

  return (
    <View style={styles.container}>
      {/* Date selector surface */}
      <Surface style={styles.filterSurface} elevation={1}>
        <View style={styles.row}>
          <TextInput
            label="Data Início"
            mode="outlined"
            value={dataInicio}
            onChangeText={(txt) => setDataInicio(formatDateInput(txt))}
            placeholder="DD/MM/AAAA"
            keyboardType="numeric"
            style={styles.dateInput}
            left={<TextInput.Icon icon="calendar" />}
          />
          <TextInput
            label="Data Fim"
            mode="outlined"
            value={dataFim}
            onChangeText={(txt) => setDataFim(formatDateInput(txt))}
            placeholder="DD/MM/AAAA"
            keyboardType="numeric"
            style={styles.dateInput}
            left={<TextInput.Icon icon="calendar" />}
          />
        </View>
        <Button
          mode="contained"
          onPress={handleFiltrar}
          icon="magnify"
          style={styles.filterButton}
          disabled={loading || dataInicio.length !== 10 || dataFim.length !== 10}
        >
          Filtrar Período
        </Button>
      </Surface>

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Carregando relatórios...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[theme.colors.primary]} />
          }
        >
          {stats ? (
            <>
              {/* KPI Cards Grid */}
              <View style={styles.grid}>
                {/* Card 1: Faturamento */}
                <Card style={[styles.kpiCard, { borderLeftColor: '#2E7D32', borderLeftWidth: 4 }]}>
                  <Card.Content style={styles.kpiContent}>
                    <View style={styles.kpiHeader}>
                      <Text variant="titleSmall" style={styles.kpiLabel}>Faturamento</Text>
                      <MaterialCommunityIcons name="currency-usd" size={20} color="#2E7D32" />
                    </View>
                    <Text variant="titleLarge" style={styles.kpiValue}>
                      {formatCurrency(stats.totalFaturado)}
                    </Text>
                    <Text variant="bodySmall" style={styles.kpiSub}>
                      {stats.totalServicos} {stats.totalServicos === 1 ? 'serviço' : 'serviços'}
                    </Text>
                  </Card.Content>
                </Card>

                {/* Card 2: Custos */}
                <Card style={[styles.kpiCard, { borderLeftColor: '#C62828', borderLeftWidth: 4 }]}>
                  <Card.Content style={styles.kpiContent}>
                    <View style={styles.kpiHeader}>
                      <Text variant="titleSmall" style={styles.kpiLabel}>Custos</Text>
                      <MaterialCommunityIcons name="hand-coin" size={20} color="#C62828" />
                    </View>
                    <Text variant="titleLarge" style={styles.kpiValue}>
                      {formatCurrency(stats.totalPago)}
                    </Text>
                    <Text variant="bodySmall" style={styles.kpiSub}>
                      Repasses p/ trabalhadoras
                    </Text>
                  </Card.Content>
                </Card>

                {/* Card 3: Lucro */}
                <Card style={[styles.kpiCard, { borderLeftColor: '#1E88E5', borderLeftWidth: 4 }]}>
                  <Card.Content style={styles.kpiContent}>
                    <View style={styles.kpiHeader}>
                      <Text variant="titleSmall" style={styles.kpiLabel}>Lucro Líquido</Text>
                      <MaterialCommunityIcons name="trending-up" size={20} color="#1E88E5" />
                    </View>
                    <Text variant="titleLarge" style={[styles.kpiValue, { color: stats.lucroLiquido >= 0 ? '#2E7D32' : '#C62828' }]}>
                      {formatCurrency(stats.lucroLiquido)}
                    </Text>
                    <Text variant="bodySmall" style={styles.kpiSub}>
                      Margem líquida obtida
                    </Text>
                  </Card.Content>
                </Card>

                {/* Card 4: Margem % */}
                <Card style={[styles.kpiCard, { borderLeftColor: '#7E57C2', borderLeftWidth: 4 }]}>
                  <Card.Content style={styles.kpiContent}>
                    <View style={styles.kpiHeader}>
                      <Text variant="titleSmall" style={styles.kpiLabel}>Margem %</Text>
                      <MaterialCommunityIcons name="percent" size={20} color="#7E57C2" />
                    </View>
                    <Text variant="titleLarge" style={styles.kpiValue}>
                      {stats.margemPorcentagem.toFixed(1)}%
                    </Text>
                    <Text variant="bodySmall" style={styles.kpiSub}>
                      Eficiência financeira
                    </Text>
                  </Card.Content>
                </Card>
              </View>

              {/* Workers Accordion */}
              <List.Accordion
                title="Desempenho de Trabalhadoras"
                left={(props) => <List.Icon {...props} icon="account-group" />}
                expanded={expandedWorkers}
                onPress={() => setExpandedWorkers(!expandedWorkers)}
                style={styles.accordion}
              >
                {stats.trabalhadoras.length === 0 ? (
                  <View style={styles.emptyAccordionItem}>
                    <Text style={styles.emptyText}>Nenhum serviço no período.</Text>
                  </View>
                ) : (
                  stats.trabalhadoras.map((trab) => (
                    <View key={trab.id} style={styles.rowItem}>
                      <View style={styles.rowItemHeader}>
                        <Text variant="titleMedium" style={styles.rowItemTitle}>
                          {trab.nome}
                        </Text>
                        <Text variant="bodySmall" style={styles.rowItemBadge}>
                          {trab.servicosConcluidos} {trab.servicosConcluidos === 1 ? 'serviço' : 'serviços'}
                        </Text>
                      </View>
                      <View style={styles.rowItemDetails}>
                        <View>
                          <Text variant="bodySmall" style={styles.rowItemLabel}>Total Recebido</Text>
                          <Text variant="bodyMedium" style={styles.rowItemValue}>{formatCurrency(trab.totalRecebido)}</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text variant="bodySmall" style={styles.rowItemLabel}>Margem Gerada</Text>
                          <Text variant="bodyMedium" style={[styles.rowItemValue, { color: trab.margemGerada >= 0 ? '#2E7D32' : '#C62828', fontWeight: 'bold' }]}>
                            {formatCurrency(trab.margemGerada)}
                          </Text>
                        </View>
                      </View>
                      <Divider style={styles.divider} />
                    </View>
                  ))
                )}
              </List.Accordion>

              {/* Clients Accordion */}
              <List.Accordion
                title="Faturamento de Clientes"
                left={(props) => <List.Icon {...props} icon="office-building" />}
                expanded={expandedClients}
                onPress={() => setExpandedClients(!expandedClients)}
                style={styles.accordion}
              >
                {stats.clientes.length === 0 ? (
                  <View style={styles.emptyAccordionItem}>
                    <Text style={styles.emptyText}>Nenhum serviço no período.</Text>
                  </View>
                ) : (
                  stats.clientes.map((cli) => (
                    <View key={cli.id} style={styles.rowItem}>
                      <View style={styles.rowItemHeader}>
                        <Text variant="titleMedium" style={styles.rowItemTitle}>
                          {cli.nome}
                        </Text>
                        <Text variant="bodySmall" style={styles.rowItemBadge}>
                          {cli.servicosConcluidos} {cli.servicosConcluidos === 1 ? 'serviço' : 'serviços'}
                        </Text>
                      </View>
                      <View style={styles.rowItemDetails}>
                        <View>
                          <Text variant="bodySmall" style={styles.rowItemLabel}>Total Faturado</Text>
                          <Text variant="bodyMedium" style={styles.rowItemValue}>{formatCurrency(cli.totalFaturado)}</Text>
                        </View>
                      </View>
                      <Divider style={styles.divider} />
                    </View>
                  ))
                )}
              </List.Accordion>
            </>
          ) : (
            <View style={styles.noDataContainer}>
              <Text style={styles.emptyText}>Nenhum dado encontrado para o período filtrado.</Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  filterSurface: {
    padding: 16,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    backgroundColor: theme.colors.surface,
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  dateInput: {
    flex: 1,
    backgroundColor: theme.colors.surface,
  },
  filterButton: {
    borderRadius: 8,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  kpiCard: {
    width: '48%',
    backgroundColor: theme.colors.surface,
    elevation: 1,
  },
  kpiContent: {
    padding: 12,
  },
  kpiHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  kpiLabel: {
    color: theme.colors.outline,
    fontWeight: '500',
    fontSize: 12,
  },
  kpiValue: {
    fontWeight: 'bold',
    color: theme.colors.onSurface,
  },
  kpiSub: {
    color: theme.colors.outline,
    marginTop: 4,
    fontSize: 11,
  },
  accordion: {
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    marginTop: 8,
  },
  emptyAccordionItem: {
    padding: 16,
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
  },
  rowItem: {
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: theme.colors.surface,
  },
  rowItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  rowItemTitle: {
    color: theme.colors.onSurface,
    fontWeight: '600',
    flex: 1,
  },
  rowItemBadge: {
    backgroundColor: theme.colors.primaryContainer,
    color: theme.colors.onPrimaryContainer,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    fontSize: 12,
    overflow: 'hidden',
  },
  rowItemDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  rowItemLabel: {
    color: theme.colors.outline,
    fontSize: 12,
  },
  rowItemValue: {
    color: theme.colors.onSurface,
    fontWeight: '500',
  },
  divider: {
    marginTop: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    color: theme.colors.outline,
  },
  noDataContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    color: theme.colors.outline,
  },
});
