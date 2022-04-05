import {tokenStorage} from "../storage";
import {KeycloakConfiguration, KeycloakContextValue} from "../types";
import {
    AuthRequest,
    AuthRequestConfig,
    AuthSessionResult,
    AuthRequestPromptOptions,
    loadAsync,
    revokeAsync,
    refreshAsync,
    fetchUserInfoAsync,
    fetchDiscoveryAsync,
    makeRedirectUri,
    TokenResponse,
    exchangeCodeAsync,
} from "expo-auth-session";
import { MutableRefObject } from "react";
import {KC_INITIAL_VALUE, NATIVE_REDIRECT_PATH, REFRESH_TIME_BUFFER} from "../const";
import { getRealmURL } from "../getRealmURL";
import {TokenType} from "../storage/tokenStorage";
import {isTokenExpired} from "./jwt-utils";
import jwtDecode from "./jwt-decode";

export const configureOnlineAccess = async (
    refreshHandler: MutableRefObject<number>,
    config: KeycloakConfiguration,
    setKeycloakContextValue: (value: KeycloakContextValue | ((prev: KeycloakContextValue) => KeycloakContextValue)) => void
): Promise<void> => {
    const discovery = await fetchDiscoveryAsync(getRealmURL(config));

    config.redirectUri = makeRedirectUri({
        native: `${config.scheme ?? 'exp'}://${
            config.nativeRedirectPath ?? NATIVE_REDIRECT_PATH
        }`,
        useProxy: config.useProxy
    });

    let updateTimer: (tokens?: TokenType) => Promise<void>;

    const exchangeCode: (
        request: AuthRequest,
        response: any
    ) => Promise<TokenResponse> = (
        request: AuthRequest,
        response: any
    ): Promise<TokenResponse> => {
        return exchangeCodeAsync(
            {
                ...(config as AuthRequestConfig),
                ...(config.usePKCE ? {code_verifier: request.codeVerifier} : {}),
                code: (response as any).params.code
            },
            discovery,
        )
    }

    const login: (options?: AuthRequestPromptOptions) => Promise<AuthSessionResult> = async (options?: AuthRequestPromptOptions): Promise<AuthSessionResult> => {
        try {
            clearTimeout(refreshHandler!.current);

            const request: AuthRequest = await loadAsync(config as AuthRequestConfig, discovery);

            const response: AuthSessionResult = await request.promptAsync(discovery, {useProxy: config.useProxy, ...options});

            const tokens = await exchangeCode(request, response) as TokenType;

            await tokenStorage.set(tokens);

            if (!config.disableAutoRefresh) {
                await updateTimer();
            }

            setKeycloakContextValue((prev: KeycloakContextValue) =>
                ({ ...prev, ready: true, isLoggedIn: true, tokens }));

            return response
        } catch(e) {
            clearTimeout(refreshHandler.current);
            throw e;
        }
    }


    const logout: () => Promise<void> = async () => {
        try {
            const tokens = await tokenStorage.get();

            if (!tokens.accessToken) {
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

            setKeycloakContextValue((prev: KeycloakContextValue) =>
                ({ ...prev, ready: true, isLoggedIn: false, tokens: KC_INITIAL_VALUE.tokens }))
        } catch(e) {
            clearTimeout(refreshHandler.current);
            throw e;
        }
    }

    const refresh: () => Promise<TokenResponse> = async () => {
        try {
            clearTimeout(refreshHandler.current)

            const tokens = await tokenStorage.get();

            if (!tokens.refreshToken) {
                throw new Error('Not logged in');
            }

            const response = await refreshAsync(
                { refreshToken: tokens.refreshToken, ...config! },
                discovery!,
            );

            await tokenStorage.set(response as TokenType);

            if (!config.disableAutoRefresh) {
                await updateTimer(response as TokenType);
            }

            setKeycloakContextValue((prev: KeycloakContextValue) =>
                ({ ...prev, ready: true, isLoggedIn: true, tokens: response as TokenType }));

            return response;
        } catch (e) {
            //Can't refresh because the session is gone in keycloak
            await logout();
            throw e;
        }
    }

    const loadUserInfo: () => Promise<Record<any, any>> = async (): Promise<Record<any, any>> => {
        try {
            const { accessToken } = await tokenStorage.get();

            return await fetchUserInfoAsync(
                { accessToken },
                { userInfoEndpoint: discovery!.userInfoEndpoint },
            );
        } catch (e) {
            await logout()
            throw e
        }
    }

    updateTimer = async (tokens?: TokenType) => {
        clearTimeout(refreshHandler.current);

        if (!tokens) {
            tokens = await tokenStorage.get();
        }

        refreshHandler.current = setTimeout(
            refresh,
            (tokens.expiresIn! -
                (config.refreshTimeBuffer ?? REFRESH_TIME_BUFFER)) *
            1000,
        ) as any;
    }

    const tokens = await tokenStorage.get();

    if (tokens.refreshToken && !isTokenExpired(jwtDecode(tokens.refreshToken))) {
        refresh();
    } else {
        setKeycloakContextValue({
            isLoggedIn: false,
            login,
            logout,
            refresh,
            ready: true,
            tokens,
            loadUserInfo,
        });
    }
}