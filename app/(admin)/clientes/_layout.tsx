import { Stack } from 'expo-router';
import { theme } from '../../../src/lib/theme';

export default function ClientesLayout() {
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
          title: 'Clientes',
        }}
      />
      <Stack.Screen
        name="novo"
        options={{
          title: 'Novo Cliente',
          presentation: 'modal',
        }}
      />
      <Stack.Screen
        name="[id]"
        options={{
          title: 'Detalhes do Cliente',
        }}
      />
    </Stack>
  );
}
