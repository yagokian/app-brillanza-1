import { Stack } from 'expo-router';
import { theme } from '../../../src/lib/theme';

export default function RelatoriosLayout() {
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
          title: 'Relatorios',
        }}
      />
    </Stack>
  );
}
