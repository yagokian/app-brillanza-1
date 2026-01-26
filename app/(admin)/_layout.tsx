import { Tabs, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '../../src/lib/theme';

const HomeIcon = ({ color, size }: { color: string; size: number }) => (
  <MaterialCommunityIcons name="home" size={size} color={color} />
);

const ClientesIcon = ({ color, size }: { color: string; size: number }) => (
  <MaterialCommunityIcons name="account-group" size={size} color={color} />
);

const TrabalhadorasIcon = ({ color, size }: { color: string; size: number }) => (
  <MaterialCommunityIcons name="account-hard-hat" size={size} color={color} />
);

const ServicosIcon = ({ color, size }: { color: string; size: number }) => (
  <MaterialCommunityIcons name="calendar-check" size={size} color={color} />
);

const RelatoriosIcon = ({ color, size }: { color: string; size: number }) => (
  <MaterialCommunityIcons name="chart-bar" size={size} color={color} />
);

export default function AdminLayout() {
  const router = useRouter();

  // Função para resetar stack ao clicar na aba
  const resetStack = (route: string) => ({
    tabPress: (e: { preventDefault: () => void }) => {
      e.preventDefault();
      router.replace(route as any);
    },
  });

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.outline,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.outlineVariant,
        },
        headerStyle: {
          backgroundColor: theme.colors.surface,
        },
        headerTintColor: theme.colors.onSurface,
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Inicio',
          tabBarIcon: HomeIcon,
        }}
      />
      <Tabs.Screen
        name="clientes"
        options={{
          title: 'Clientes',
          headerShown: false,
          tabBarIcon: ClientesIcon,
        }}
        listeners={resetStack('/(admin)/clientes')}
      />
      <Tabs.Screen
        name="trabalhadoras"
        options={{
          title: 'Equipe',
          headerShown: false,
          tabBarIcon: TrabalhadorasIcon,
        }}
        listeners={resetStack('/(admin)/trabalhadoras')}
      />
      <Tabs.Screen
        name="servicos"
        options={{
          title: 'Servicos',
          headerShown: false,
          tabBarIcon: ServicosIcon,
        }}
        listeners={resetStack('/(admin)/servicos')}
      />
      <Tabs.Screen
        name="relatorios"
        options={{
          title: 'Relatorios',
          headerShown: false,
          tabBarIcon: RelatoriosIcon,
        }}
        listeners={resetStack('/(admin)/relatorios')}
      />
    </Tabs>
  );
}
