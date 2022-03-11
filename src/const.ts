import {AuthSessionResult} from "expo-auth-session/src/AuthSession.types";
import {TokenType} from "expo-auth-session";
import { KeycloakInfo } from './types';

export const KC_INITIAL_VALUE: KeycloakInfo = {
  ready: false,
  isLoggedIn: false,
  login: () => console.error('KC Not Initialized.'),
  logout: () => console.error('Not Logged In.'),
  refresh: () => console.error('Not Logged In.'),
  tokens: null,
} as any
export const NATIVE_REDIRECT_PATH = 'auth/redirect'
export const TOKEN_STORAGE_KEY = '$KEYCLOAK_AUTH_TOKEN$'
export const REFRESH_TIME_BUFFER = 10
