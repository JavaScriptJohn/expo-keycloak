import {tokenStorage} from "../storage";
import {KeycloakConfiguration, KeycloakContextValue} from "../types";
import {isTokenExpired} from './jwt-utils';
import {
    AuthRequest,
    AuthRequestConfig,
    AuthSessionResult,
    AuthRequestPromptOptions,
    loadAsync,
    revokeAsync,
    refreshAsync,
    fetchUserInfoAsync, fetchDiscoveryAsync, makeRedirectUri, TokenResponse
} from "expo-auth-session";
import { MutableRefObject } from "react";
import {NATIVE_REDIRECT_PATH, REFRESH_TIME_BUFFER} from "../const";
import {Platform} from "react-native";

export const configureOnlineAccess = async (
    refreshHandler: MutableRefObject<number>,
    config: KeycloakConfiguration,
    setKeycloakContextValue: (value: KeycloakContextValue | ((prev: KeycloakContextValue) => KeycloakContextValue)) => void
): Promise<void> => {
    const discovery = await fetchDiscoveryAsync(config.url);
    const useProxy = Platform.select({ web: false, native: !config.scheme });

    config.redirectUri = makeRedirectUri({
        native: `${config.scheme ?? 'exp'}://${
            config.nativeRedirectPath ?? NATIVE_REDIRECT_PATH
        }`,
        useProxy,
    });

    let updateTimer: () => Promise<void>;

    const isLoggedIn: () => Promise<boolean> = async (): Promise<boolean> => {
        const tokens = await tokenStorage.get();

        return TokenResponse.isTokenFresh(tokens) || (!!tokens.refreshToken && !isTokenExpired(tokens.refreshToken));
    }

    const login: (options?: AuthRequestPromptOptions) => Promise<AuthSessionResult> = async (options?: AuthRequestPromptOptions): Promise<AuthSessionResult> => {
        clearTimeout(refreshHandler!.current);

        const request: AuthRequest = await loadAsync(config as AuthRequestConfig, discovery);

        const response = await request.promptAsync(discovery, options);

        console.log(response)

        updateTimer();

        return response
    }


    const logout: () => Promise<void> = async () => {
        try {
            const tokens = await tokenStorage.get();

            if (!tokens.accessToken) {
                clearTimeout(refreshHandler.current);
                throw new Error('Not logged in.');
            }

            await revokeAsync(
                {
                    token: tokens.accessToken,
                    ...config,
                },
                {revocationEndpoint: discovery?.revocationEndpoint},
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
        } catch(e) {
            clearTimeout(refreshHandler.current);
            throw e;
        }
    }

    const refresh: () => Promise<TokenResponse> = async () => {
        try {
            const tokens = await tokenStorage.get();

            if (!tokens.refreshToken) {
                throw Error('Not logged in');
            }

            const response = await refreshAsync(
                { refreshToken: tokens.refreshToken, ...config! },
                discovery!,
            );

            if (!config.disableAutoRefresh) {
                updateTimer();
            }

            return response;
        } catch (refreshError) {
            //Can't refresh because the session is gone in keycloak
            await logout();
            throw refreshError;
        }
    }

    const loadUserInfo: () => Promise<Record<any, any>> = async (): Promise<Record<any, any>> => {
        try {
            const { accessToken } = await tokenStorage.get();

            return await fetchUserInfoAsync(
                { accessToken },
                { userInfoEndpoint: discovery!.userInfoEndpoint },
            );
        } catch (error) {
            await logout()
            throw error
        }
    }

    updateTimer = async () => {
        clearTimeout(refreshHandler.current);

        const tokens = await tokenStorage.get();

        refreshHandler.current = setTimeout(
            refresh,
            (tokens.expiresIn! -
                (config.refreshTimeBuffer ?? REFRESH_TIME_BUFFER)) *
            1000,
        ) as any;
    }

    setKeycloakContextValue({
        isLoggedIn: false,
        login,
        logout,
        refresh,
        ready: true,
        loadUserInfo,
    });
}