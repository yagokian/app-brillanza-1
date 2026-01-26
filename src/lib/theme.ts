import { MD3LightTheme, configureFonts } from 'react-native-paper';

const fontConfig = {
  fontFamily: 'System',
};

export const theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#1E88E5',
    primaryContainer: '#D6E9FF',
    secondary: '#2E2E2E',
    secondaryContainer: '#F2F4F7',
    surface: '#F2F4F7',
    surfaceVariant: '#F2F4F7',
    background: '#FFFFFF',
    onSurface: '#2E2E2E',
    onBackground: '#2E2E2E',
    outline: '#9AA0A6',
    outlineVariant: '#E0E0E0',
  },
  fonts: configureFonts({ config: fontConfig }),
};

export const statusColors = {
  agendado: '#7E57C2',
  em_andamento: '#F9A825',
  concluido: '#2E7D32',
  cancelado: '#C62828',
};
