import { Stack } from 'expo-router';
import { theme } from '../../src/lib/theme';

export default function WorkerLayout() {
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
          title: 'Minha Agenda',
        }}
      />
      <Stack.Screen
        name="servico/[id]"
        options={{
          title: 'Detalhes do Servico',
        }}
      />
    </Stack>
  );
}
