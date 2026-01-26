import i18n, { InitOptions } from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';

const resources = {
  pt: {
    translation: {
      login: {
        hero: 'Gestao clara, rapida e organizada para sua equipe',
        email: 'Email',
        password: 'Senha',
        submit: 'Entrar',
        footer: 'Sistema de Gestao Interna',
        errorRequired: 'Preencha todos os campos',
        errorInvalid: 'Email ou senha incorretos',
        errorUnconfirmed: 'Email nao confirmado. Verifique sua caixa de entrada.',
        errorGeneric: 'Erro ao fazer login. Tente novamente.',
      },
    },
  },
  es: {
    translation: {
      login: {
        hero: 'Gestion clara, rapida y organizada para tu equipo',
        email: 'Email',
        password: 'Contrasena',
        submit: 'Entrar',
        footer: 'Sistema de Gestion Interna',
        errorRequired: 'Completa todos los campos',
        errorInvalid: 'Email o contrasena incorrectos',
        errorUnconfirmed: 'Email no confirmado. Revisa tu bandeja de entrada.',
        errorGeneric: 'Error al iniciar sesion. Intentalo de nuevo.',
      },
    },
  },
};

const deviceLanguage =
  Localization.getLocales?.()[0]?.languageCode?.toLowerCase() || 'pt';
const fallbackLanguage = resources[deviceLanguage as keyof typeof resources]
  ? deviceLanguage
  : 'pt';

if (!i18n.isInitialized) {
  const options: InitOptions = {
    resources,
    lng: fallbackLanguage,
    fallbackLng: 'pt',
    interpolation: {
      escapeValue: false,
    },
    compatibilityJSON: 'v4',
  };

  i18n.use(initReactI18next).init(options);
}

export default i18n;
