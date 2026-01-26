import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { theme } from '../../../src/lib/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function RelatoriosScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.emptyContainer}>
        <MaterialCommunityIcons
          name="chart-bar"
          size={64}
          color={theme.colors.outline}
        />
        <Text variant="titleMedium" style={styles.emptyTitle}>
          Relatorios e Metricas
        </Text>
        <Text variant="bodyMedium" style={styles.emptySubtitle}>
          Sera implementado na Fase 4
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
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
});
