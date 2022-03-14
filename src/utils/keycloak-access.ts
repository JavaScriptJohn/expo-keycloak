import {TokenType} from "..//storage/tokenStorage";
import {tokenStorage} from "../storage";
import {KeycloakConfiguration, KeycloakContextValue} from "../types";
import {isTokenExpired} from './jwt-utils';
import jwtDecode from './jwt-decode';
import {
    AuthRequest,
    AuthRequestConfig,
    AuthSessionResult,
    DiscoveryDocument,
    AuthRequestPromptOptions,
    loadAsync,
    revokeAsync,
    refreshAsync,
    fetchUserInfoAsync, fetchDiscoveryAsync
} from "expo-auth-session";
import { MutableRefObject } from "react";

const buildLogin: (
    isInternetReachable: boolean,
    refreshHandler?: MutableRefObject<number>,
    discovery?: DiscoveryDocument,
    config?: AuthRequestConfig
) => (options?: AuthRequestPromptOptions) => Promise<AuthSessionResult> = (
    isInternetReachable: boolean,
    refreshHandler?: MutableRefObject<number>,
    discovery?: DiscoveryDocument,
    config?: AuthRequestConfig
) => {
    return async (options?: AuthRequestPromptOptions): Promise<AuthSessionResult> => {
        if (!isInternetReachable) {
            throw Error('Can\'t login when offline');
        }

        clearTimeout(refreshHandler!.current);

        const request: AuthRequest = await loadAsync(config!, discovery!);
        return await request.promptAsync(discovery!, options);
    }
}

const buildLogout: (
    isInternetReachable: boolean,
    refreshHandler?: MutableRefObject<number>,
    discovery?: DiscoveryDocument,
    config?: AuthRequestConfig
) => () => Promise<void> = (
    isInternetReachable: boolean,
    refreshHandler?: MutableRefObject<number>,
    discovery?: DiscoveryDocument,
    config?: AuthRequestConfig
): () => Promise<void> => {
    return async () => {
        if (!isInternetReachable) {
            throw Error('Can\'t logout when offline');
        }

        try {
            const tokens = await tokenStorage.get();

            if (!tokens.accessToken) throw new Error('Not logged in.');

            await revokeAsync(
                {
                    token: tokens.accessToken,
                    ...config,
                },
                { revocationEndpoint: discovery?.revocationEndpoint },
            );

            if (tokens.refreshToken) {
                const body = `${encodeURIComponent('client_id')}=${encodeURIComponent(config!.clientId)}&` +
                    `${encodeURIComponent('refresh_token')}=${encodeURIComponent(tokens.refreshToken)}`;

                await fetch(
                    `${discovery?.endSessionEndpoint}`,
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
                        },
                        body,
                    }
                );

            }

            await tokenStorage.reset();
        } catch (error) {
            clearTimeout(refreshHandler!.current);
            throw error;
        }
    }
}

const buildRefreh = (
    isInternetReachable: boolean,
    logout?: () => Promise<void>,
    refreshHandler?: MutableRefObject<number>,
    discovery?: DiscoveryDocument,
    config?: AuthRequestConfig
): () => Promise<void> => {
   return async () => {
       if (!isInternetReachable) {
           throw Error('Can\'t refresh tokens when offline');
       }

       const tokens = await tokenStorage.get();
       if (!tokens) {
           throw Error('Can\'t refresh tokens when not logged in');
       }

       try {
           const _response = await refreshAsync(
               { refreshToken: tokens.refreshToken, ...config! },
               discovery!,
           );

       } catch (refreshError) {
           //Can't refresh because the session is gone in keycloak
           logout!();
           throw refreshError;
       }
   }
}

const buildLoadUserInfo: (
    isInternetReachable: boolean,
    logout?: () => Promise<void>,
    refreshHandler?: MutableRefObject<number>,
    discovery?: DiscoveryDocument,
    config?: AuthRequestConfig
) => () => Promise<Record<any, any>> = (
    isInternetReachable: boolean,
    logout?: () => Promise<void>,
    refreshHandler?: MutableRefObject<number>,
    discovery?: DiscoveryDocument,
    config?: AuthRequestConfig
): () => Promise<Record<any, any>> => {
    return async (): Promise<Record<any, any>> => {
        if (!isInternetReachable) {
            throw new Error('Can\'t load user info when offline');
        }
        const { accessToken } = await tokenStorage.get();

        try {


            return await fetchUserInfoAsync(
                { accessToken },
                { userInfoEndpoint: discovery!.userInfoEndpoint },
            );
        } catch (error) {
            await logout!()
            throw error
        }
    }
}

export const configureOfflineAccess = async (): Promise<KeycloakContextValue> => {
    const tokens: TokenType = await tokenStorage.get();
    let isLoggedIn = true;

    if (!tokens.refreshToken) {
        isLoggedIn = false;
    } else {
        const refreshTokenParsed = jwtDecode(tokens.refreshToken);

        if (isTokenExpired(refreshTokenParsed)) {
            isLoggedIn = false;
        }
    }

    return {
        isLoggedIn,
        login: buildLogin(false),
        logout: buildLogout(false),
        refresh: buildTokenRefreh(false),
        ready: true,
        tokens,
        loadUserInfo: buildLoadUserInfo(false),
    };
}

export const configureOnlineAccess = async (
    refreshHandler: MutableRefObject<number>,
    keycloakConfiguration: KeycloakConfiguration
): Promise<KeycloakContextValue> => {
    const discovery = await fetchDiscoveryAsync(keycloakConfiguration.url);
    const tokens: TokenType = await tokenStorage.get();
    let isLoggedIn = true;

    if (!tokens.refreshToken) {
        isLoggedIn = false;
    } else {
        const refreshTokenParsed = jwtDecode(tokens.refreshToken);

        if (isTokenExpired(refreshTokenParsed)) {
            isLoggedIn = false;
        }
    }

    const logout = buildLogout(true, refreshHandler, discovery, config);

    return {
        isLoggedIn,
        login: buildLogin(true, refreshHandler, discovery),
        logout,
        refresh: buildTokenRefreh(true, logout, refreshHandler, discovery, config),
        ready: true,
        tokens,
        loadUserInfo: buildLoadUserInfo(true, logout, refreshHandler, discovery, config),
    };
}