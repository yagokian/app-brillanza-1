import { Stack } from 'expo-router';
import { theme } from '../../../src/lib/theme';

export default function ServicosLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.colors.surface,
        },
        headerTintColor: theme.colors.onSurface,
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: 'Servicos',
        }}
      />
      <Stack.Screen
        name="novo"
        options={{
          title: 'Novo Servico',
          presentation: 'modal',
        }}
      />
      <Stack.Screen
        name="[id]"
        options={{
          title: 'Detalhes',
        }}
      />
    </Stack>
  );
}
