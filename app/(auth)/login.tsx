import { useRef, useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Image } from 'react-native';
import { TextInput, Button, Text, Surface, HelperText } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../src/contexts/AuthContext';
import { theme } from '../../src/lib/theme';

export default function LoginScreen() {
  const { signIn, loading } = useAuth();
  const { t } = useTranslation();
  const passwordRef = useRef<any>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  async function handleLogin() {
    if (!email || !password) {
      setError(t('login.errorRequired'));
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      await signIn(email.trim(), password);
    } catch (err: any) {
      console.error('Login error:', err);
      if (err.message?.includes('Invalid login')) {
        setError(t('login.errorInvalid'));
      } else if (err.message?.includes('Email not confirmed')) {
        setError(t('login.errorUnconfirmed'));
      } else {
        setError(t('login.errorGeneric'));
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.background} pointerEvents="none">
        <View style={styles.blobPrimary} />
        <View style={styles.blobAccent} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.hero}>
            <Image
              source={require('../../assets/logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text variant="bodyMedium" style={styles.heroText}>
              {t('login.hero')}
            </Text>
          </View>

          <Surface style={styles.formContainer} elevation={2}>
            <TextInput
              label={t('login.email')}
              value={email}
              onChangeText={setEmail}
              mode="outlined"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => passwordRef.current?.focus()}
              style={styles.input}
              left={<TextInput.Icon icon="email" />}
            />

            <TextInput
              label={t('login.password')}
              value={password}
              onChangeText={setPassword}
              mode="outlined"
              secureTextEntry={!showPassword}
              ref={passwordRef}
              returnKeyType="done"
              onSubmitEditing={handleLogin}
              style={styles.input}
              left={<TextInput.Icon icon="lock" />}
              right={
                <TextInput.Icon
                  icon={showPassword ? 'eye-off' : 'eye'}
                  onPress={() => setShowPassword(!showPassword)}
                />
              }
            />

            {error ? (
              <HelperText type="error" visible={!!error}>
                {error}
              </HelperText>
            ) : null}

            <Button
              mode="contained"
              onPress={handleLogin}
              loading={isLoading || loading}
              disabled={isLoading || loading}
              style={styles.button}
              contentStyle={styles.buttonContent}
            >
              {t('login.submit')}
            </Button>
          </Surface>

          <Text variant="bodySmall" style={styles.footer}>
            {t('login.footer')}
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  background: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.background,
  },
  blobPrimary: {
    position: 'absolute',
    top: -120,
    right: -80,
    width: 240,
    height: 240,
    borderRadius: 999,
    backgroundColor: theme.colors.primary,
    opacity: 0.12,
  },
  blobAccent: {
    position: 'absolute',
    bottom: -140,
    left: -90,
    width: 260,
    height: 260,
    borderRadius: 999,
    backgroundColor: theme.colors.primary,
    opacity: 0.08,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  hero: {
    marginBottom: 24,
    alignItems: 'center',
  },
  logo: {
    width: 220,
    height: 120,
  },
  heroText: {
    marginTop: 16,
    color: theme.colors.outline,
    textAlign: 'center',
  },
  formContainer: {
    padding: 24,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  input: {
    marginBottom: 16,
  },
  button: {
    marginTop: 4,
  },
  buttonContent: {
    paddingVertical: 10,
  },
  footer: {
    textAlign: 'center',
    marginTop: 24,
    color: theme.colors.outline,
  },
});
