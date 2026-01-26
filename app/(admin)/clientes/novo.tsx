import { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert, Image } from 'react-native';
import { TextInput, Button, Text, Switch, HelperText, Surface } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { theme } from '../../../src/lib/theme';
import { createCliente } from '../../../src/services/clientes';
import { ChargeType } from '../../../src/types/database';

interface ClienteForm {
  nome: string;
  endereco: string;
  telefone: string;
  email: string;
  data_contratacao: string;
  tipo_servico: string;
  frequencia: string;
  duracao_horario: string;
  dia_semana: string;
  tipo_cobranca: 'hora' | 'diaria' | 'fixo' | null;
  valor_acordado: string;
  observacoes: string;
  aceite_lgpd: boolean;
}

const clienteSchema = z.object({
  nome: z.string().min(1, 'Nome e obrigatorio'),
  endereco: z.string().min(1, 'Endereco e obrigatorio'),
  telefone: z.string().min(1, 'Telefone e obrigatorio'),
  email: z.string().email('Email invalido').or(z.literal('')),
  data_contratacao: z.string().min(1, 'Data de contratacao e obrigatoria'),
  tipo_servico: z.string().min(1, 'Tipo de servico e obrigatorio'),
  frequencia: z.string().min(1, 'Frequencia e obrigatoria'),
  duracao_horario: z.string().min(1, 'Duracao/horario e obrigatorio'),
  dia_semana: z.string().min(1, 'Dia da semana e obrigatorio'),
  tipo_cobranca: z.enum(['hora', 'diaria', 'fixo']).nullable(),
  valor_acordado: z.string().min(1, 'Preco acordado e obrigatorio'),
  observacoes: z.string(),
  aceite_lgpd: z.boolean().refine((value) => value, {
    message: 'Aceite LGPD e obrigatorio',
  }),
});

const requiredLabel = (label: string) => `${label} *`;

const formatDateInput = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
};

const convertDateToISO = (dateStr: string): string => {
  if (!dateStr || dateStr.length !== 10) return dateStr;
  const [day, month, year] = dateStr.split('/');
  return `${year}-${month}-${day}`;
};

const formatPhoneInput = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) {
    return `${digits.slice(0, 2)} ${digits.slice(2)}`;
  }
  if (digits.length <= 10) {
    return `${digits.slice(0, 2)} ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `${digits.slice(0, 2)} ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

const formatDecimalInput = (value: string) => {
  const normalized = value.replace(/,/g, '.').replace(/[^\d.]/g, '');
  const [intPart, decimalPart] = normalized.split('.');
  if (!decimalPart) return intPart || '';
  return `${intPart || '0'}.${decimalPart.slice(0, 2)}`;
};

export default function NovoClienteScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState('');

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ClienteForm>({
    resolver: zodResolver(clienteSchema),
    defaultValues: {
      nome: '',
      endereco: '',
      telefone: '',
      email: '',
      data_contratacao: '',
      tipo_servico: '',
      frequencia: '',
      duracao_horario: '',
      dia_semana: '',
      tipo_cobranca: null,
      valor_acordado: '',
      observacoes: '',
      aceite_lgpd: false,
    },
  });

  async function onSubmit(data: ClienteForm) {
    setLoading(true);
    setSubmitError('');
    setSubmitSuccess('');
    try {
      await createCliente({
        nome: data.nome,
        endereco: data.endereco || null,
        telefone: data.telefone || null,
        email: data.email || null,
        data_contratacao: data.data_contratacao ? convertDateToISO(data.data_contratacao) : null,
        tipo_servico: data.tipo_servico || null,
        frequencia: data.frequencia || null,
        duracao_horario: data.duracao_horario || null,
        dia_semana: data.dia_semana || null,
        tipo_cobranca: data.tipo_cobranca as ChargeType || null,
        valor_acordado: data.valor_acordado ? parseFloat(data.valor_acordado) : null,
        observacoes: data.observacoes || null,
        aceite_lgpd: data.aceite_lgpd,
        data_aceite_lgpd: data.aceite_lgpd ? new Date().toISOString() : null,
      });
      setSubmitSuccess('Cliente cadastrado com sucesso.');
      Alert.alert('Sucesso', 'Cliente cadastrado com sucesso.');
      router.back();
    } catch (error: any) {
      console.error('Error creating cliente:', error);
      setSubmitError(error?.message || 'Erro desconhecido.');
      Alert.alert('Erro', error?.message || 'Nao foi possivel criar o cliente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Surface style={styles.header} elevation={0}>
          <Image
            source={require('../../../assets/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text variant="titleMedium" style={styles.headerTitle}>
            Ficha de Cliente / Fitxa de Client
          </Text>
        </Surface>

        <Controller
          control={control}
          name="nome"
          render={({ field: { onChange, onBlur, value } }) => (
            <View style={styles.inputContainer}>
              <TextInput
                label={requiredLabel('Nombre completo / Nom complet')}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                mode="outlined"
                error={!!errors.nome}
              />
              {errors.nome && (
                <HelperText type="error">{errors.nome.message}</HelperText>
              )}
            </View>
          )}
        />

        <Controller
          control={control}
          name="telefone"
          render={({ field: { onChange, onBlur, value } }) => (
            <View style={styles.inputContainer}>
              <TextInput
                label={requiredLabel('Telefono / Mobil')}
                value={value}
                onChangeText={(text) => onChange(formatPhoneInput(text))}
                onBlur={onBlur}
                mode="outlined"
                keyboardType="phone-pad"
                error={!!errors.telefone}
              />
              {errors.telefone && (
                <HelperText type="error">{errors.telefone.message}</HelperText>
              )}
            </View>
          )}
        />

        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, onBlur, value } }) => (
            <View style={styles.inputContainer}>
              <TextInput
                label="Correo electronico / Correu electronic"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                mode="outlined"
                keyboardType="email-address"
                autoCapitalize="none"
                error={!!errors.email}
              />
              {errors.email && (
                <HelperText type="error">{errors.email.message}</HelperText>
              )}
            </View>
          )}
        />

        <Controller
          control={control}
          name="endereco"
          render={({ field: { onChange, onBlur, value } }) => (
            <View style={styles.inputContainer}>
              <TextInput
                label={requiredLabel('Direccion / Adreca')}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                mode="outlined"
                multiline
                numberOfLines={2}
                error={!!errors.endereco}
              />
              {errors.endereco && (
                <HelperText type="error">{errors.endereco.message}</HelperText>
              )}
            </View>
          )}
        />

        <Controller
          control={control}
          name="data_contratacao"
          render={({ field: { onChange, onBlur, value } }) => (
            <View style={styles.inputContainer}>
              <TextInput
                label={requiredLabel('Fecha de contratacion / Data de contractacio')}
                value={value}
                onChangeText={(text) => onChange(formatDateInput(text))}
                onBlur={onBlur}
                mode="outlined"
                placeholder="AAAA-MM-DD"
                keyboardType="number-pad"
                maxLength={10}
                error={!!errors.data_contratacao}
              />
              {errors.data_contratacao && (
                <HelperText type="error">{errors.data_contratacao.message}</HelperText>
              )}
            </View>
          )}
        />

        <Controller
          control={control}
          name="tipo_servico"
          render={({ field: { onChange, onBlur, value } }) => (
            <View style={styles.inputContainer}>
              <TextInput
                label={requiredLabel('Tipo de servicio / Tipus de servei')}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                mode="outlined"
                placeholder="Ej: Residencial, comercial..."
                error={!!errors.tipo_servico}
              />
              {errors.tipo_servico && (
                <HelperText type="error">{errors.tipo_servico.message}</HelperText>
              )}
            </View>
          )}
        />

        <Controller
          control={control}
          name="frequencia"
          render={({ field: { onChange, onBlur, value } }) => (
            <View style={styles.inputContainer}>
              <TextInput
                label={requiredLabel('Frecuencia del servicio / Frequencia del servei')}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                mode="outlined"
                placeholder="Ej: Semanal, quincenal, mensual..."
                error={!!errors.frequencia}
              />
              {errors.frequencia && (
                <HelperText type="error">{errors.frequencia.message}</HelperText>
              )}
            </View>
          )}
        />

        <Controller
          control={control}
          name="duracao_horario"
          render={({ field: { onChange, onBlur, value } }) => (
            <View style={styles.inputContainer}>
              <TextInput
                label={requiredLabel('Duracion / Horario')}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                mode="outlined"
                error={!!errors.duracao_horario}
              />
              {errors.duracao_horario && (
                <HelperText type="error">{errors.duracao_horario.message}</HelperText>
              )}
            </View>
          )}
        />

        <Controller
          control={control}
          name="dia_semana"
          render={({ field: { onChange, onBlur, value } }) => (
            <View style={styles.inputContainer}>
              <TextInput
                label={requiredLabel('Dia de la semana / Dia de la setmana')}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                mode="outlined"
                error={!!errors.dia_semana}
              />
              {errors.dia_semana && (
                <HelperText type="error">{errors.dia_semana.message}</HelperText>
              )}
            </View>
          )}
        />

        <Controller
          control={control}
          name="valor_acordado"
          render={({ field: { onChange, onBlur, value } }) => (
            <View style={styles.inputContainer}>
              <TextInput
                label={requiredLabel('Precio acordado / Preu acordat')}
                value={value}
                onChangeText={(text) => onChange(formatDecimalInput(text))}
                onBlur={onBlur}
                mode="outlined"
                keyboardType="decimal-pad"
                error={!!errors.valor_acordado}
              />
              {errors.valor_acordado && (
                <HelperText type="error">{errors.valor_acordado.message}</HelperText>
              )}
            </View>
          )}
        />

        <Controller
          control={control}
          name="observacoes"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              label="Notas importantes / Notes importants"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              mode="outlined"
              multiline
              numberOfLines={3}
              style={styles.input}
            />
          )}
        />

        <Controller
          control={control}
          name="aceite_lgpd"
          render={({ field: { onChange, value } }) => (
            <View style={styles.switchContainer}>
              <View style={styles.switchLabel}>
                <Text variant="bodyMedium">
                  {requiredLabel('Acepto la politica de proteccion de datos')}
                </Text>
                <Text variant="bodySmall" style={styles.switchHint}>
                  Brillanza Limpiezas tratara sus datos solo para gestionar el
                  servicio contratado
                </Text>
                {errors.aceite_lgpd && (
                  <HelperText type="error">{errors.aceite_lgpd.message}</HelperText>
                )}
              </View>
              <Switch value={value} onValueChange={onChange} />
            </View>
          )}
        />

        <View style={styles.buttonContainer}>
          <Button
            mode="outlined"
            onPress={() => router.back()}
            style={styles.button}
          >
            Cancelar
          </Button>
          <Button
            mode="contained"
            onPress={handleSubmit(onSubmit)}
            loading={loading}
            disabled={loading}
            style={styles.button}
          >
            Salvar
          </Button>
        </View>
        {submitError ? (
          <HelperText type="error">{submitError}</HelperText>
        ) : null}
        {submitSuccess ? (
          <HelperText type="info">{submitSuccess}</HelperText>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    padding: 16,
  },
  header: {
    backgroundColor: 'transparent',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  logo: {
    width: 90,
    height: 60,
    marginBottom: 8,
  },
  headerTitle: {
    color: theme.colors.onSurface,
    fontWeight: '600',
  },
  inputContainer: {
    marginBottom: 16,
  },
  input: {
    marginBottom: 16,
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 16,
  },
  switchLabel: {
    flex: 1,
  },
  switchHint: {
    color: theme.colors.outline,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  button: {
    flex: 1,
  },
});
