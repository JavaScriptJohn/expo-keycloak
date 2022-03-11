import {AuthRequestConfig, AuthRequestPromptOptions} from "expo-auth-session/src/AuthRequest.types";
import {TokenType} from "./storage/tokenStorage";
import {AuthSessionResult} from 'expo-auth-session';

export type KeycloakContextValue = {
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

export type KeycloakResourceAccess = {
    [key: string]: KeycloakRoles
}

export type  KeycloakRoles = {
    roles: string[];
}

export type AccessTokenParsed = {
    iss?: string;
    sub?: string;
    aud?: string;
    exp?: number;
    iat?: number;
    auth_time?: number;
    nonce?: string;
    acr?: string;
    amr?: string;
    azp?: string;
    session_state?: string;
    realm_access?: KeycloakRoles;
    resource_access?: KeycloakResourceAccess;
    [key: string]: any; // Add other attributes here.
};

export type KeycloakHook = {
    isLoggedIn: boolean,
    login: (options?: AuthRequestPromptOptions) => Promise<AuthSessionResult>,
    logout: () => Promise<void>,
    refresh: () => Promise<void>,
    ready: boolean,
    accessToken: string,
    accessTokenParsed: AccessTokenParsed,
    hasRealmRole: (role: string) => boolean,
    loadUserInfo: () => Promise<Record<string, any>>,
}