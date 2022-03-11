import {AuthRequestConfig, AuthRequestPromptOptions} from "expo-auth-session/src/AuthRequest.types";
import {TokenType} from "./storage/tokenStorage";
import {AuthSessionResult} from 'expo-auth-session';

export type KeycloakInfo = {
    isLoggedIn: boolean;
    login: (options?: AuthRequestPromptOptions) => Promise<AuthSessionResult>;
    logout: () => Promise<void>;
    refresh: () => Promise<void>;
    ready: boolean;
    tokens: TokenType;
    loadUserInfo: () => Promise<Record<string, any>>
}

export type KeycloakConfiguration  =  Partial<AuthRequestConfig> & {
    usePKCE?: boolean;
    clientId: string;
    disableAutoRefresh?: boolean;
    nativeRedirectPath?: string;
    realm: string;
    refreshTimeBuffer?: number;
    scheme?: string;
    tokenStorageKey?: string;
    url: string;
}