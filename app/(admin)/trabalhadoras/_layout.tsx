import { Stack } from 'expo-router';
import { theme } from '../../../src/lib/theme';

export default function TrabalhadoresLayout() {
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
          title: 'Equipe',
        }}
      />
      <Stack.Screen
        name="nova"
        options={{
          title: 'Nova Trabalhadora',
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
