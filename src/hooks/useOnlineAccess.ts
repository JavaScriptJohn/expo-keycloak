import { KeycloakConfiguration, KeycloakContextValue } from '../types';
import {Platform} from 'react-native';
import {useCallback, useEffect, useRef, useState} from "react";
import {useTokenStorage} from './useTokenStorage';
import * as AuthSession from 'expo-auth-session';
import {getRealmURL} from '../getRealmURL';
import {NATIVE_REDIRECT_PATH, REFRESH_TIME_BUFFER} from '../const';
import {TokenType} from '../storage/tokenStorage';
import {handleTokenExchange} from '../handleTokenExchange';
import {AuthSessionResult, AuthRequestConfig, AuthRequestPromptOptions} from "expo-auth-session";

export const useOnlineAccess = ({
    usePKCE = false,
    scopes = ['openid'],
    ...props 
}: KeycloakConfiguration): KeycloakContextValue => {
    const useProxy = Platform.select({ web: false, native: !props.scheme });
    const refreshHandle = useRef(0);

    const [session, setSession] = useState({ loading: true, exists: false });
    const {
        tokens,
        hydrated,
        getTokens,
        removeTokens,
        setTokens,
    } = useTokenStorage();

    let discovery = AuthSession.useAutoDiscovery(getRealmURL(props));
    const redirectUri = AuthSession.makeRedirectUri({
        native: `${props.scheme ?? 'exp'}://${
            props.nativeRedirectPath ?? NATIVE_REDIRECT_PATH
        }`,
        useProxy,
    });

    const config: AuthRequestConfig = { redirectUri, ...props };

    const [request, response, promptAsync] = AuthSession.useAuthRequest(
        { usePKCE, ...config },
        discovery,
    );

    const updateState = useCallback(async (_tokens?: TokenType) => {
        if (_tokens?.accessToken) {
            await setTokens(_tokens);
            if (!props.disableAutoRefresh && !!_tokens.expiresIn) {
                clearTimeout(refreshHandle.current);

                refreshHandle.current = setTimeout(
                    handleTokenRefresh,
                    (_tokens.expiresIn! -
                        (props.refreshTimeBuffer ?? REFRESH_TIME_BUFFER)) *
                    1000,
                ) as any;
            }
        } else {
            await removeTokens();
            clearTimeout(refreshHandle.current);
            refreshHandle.current = 0;
        }
    }, []);

    const handleTokenRefresh = useCallback(async () => {
        try {
            if (!hydrated) return;

            const _tokens = await getTokens();
            if (!_tokens.accessToken && hydrated) {
                await updateState();
                return;
            }
            if (
                AuthSession.TokenResponse.isTokenFresh({
                    issuedAt: _tokens.issuedAt,
                    expiresIn: _tokens.expiresIn,
                })
            ) {
                await updateState(_tokens);
            }
            if (!discovery) {
                discovery = await AuthSession.fetchDiscoveryAsync(getRealmURL(props));
                if (!discovery) {
                    return;
                }
            }
            try {
                const _response = await AuthSession.refreshAsync(
                    { refreshToken: _tokens.refreshToken, ...config },
                    discovery!,
                );
                await updateState(_response as TokenType);
            } catch (refreshError) {
                //Can't refresh because the session is gone in keycloak
                handleLogout();
            }
        } catch (error) {
            console.log(error);
        }
    }, [discovery, hydrated]);

    const handleLogin = useCallback(async (options?: AuthRequestPromptOptions): Promise<AuthSessionResult> => {
        clearTimeout(refreshHandle.current);

        return promptAsync({ useProxy });
    }, [promptAsync]);

    const handleLogout = useCallback(async () => {
        try {
            const _tokens = await getTokens();

            if (!_tokens.accessToken) throw new Error('Not logged in.');
            await AuthSession.revokeAsync(
                {
                    token: _tokens.accessToken,
                    ...config,
                },
                { revocationEndpoint: discovery?.revocationEndpoint },
            );

            if (_tokens.refreshToken) {
                const body = `${encodeURIComponent('client_id')}=${encodeURIComponent(props.clientId)}&` +
                    `${encodeURIComponent('refresh_token')}=${encodeURIComponent(_tokens.refreshToken)}`;

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

            await removeTokens();
            setSession((prev) => ({ ...prev, exists: false }));
        } catch (error) {
            console.log(error);
        }
    }, [discovery]);

    useEffect(() => {
        if (hydrated) handleTokenRefresh();
    }, [hydrated]);

    const fetchTokenExchange = async () => {
        try {
            const _tokens = await handleTokenExchange({
                response,
                discovery,
                config,
                request,
                usePKCE,
            });
            if (_tokens) {
                await updateState(_tokens);
                setSession((prev) => ({ ...prev, exists: true }));
            }
        } catch (error) {
            console.log(error);
        }
    };
    useEffect(() => {
        if (response?.type === 'success') {
            fetchTokenExchange();
        }
    }, [response]);

    const checkTokens = async () => {
        try {
            const { accessToken } = await getTokens();
            if (accessToken) {
                await loadUserInfo();

                setSession({ loading: false, exists: true });
                return;
            }
            setSession({ loading: false, exists: false });
        } catch (error) {
            console.log(error);
            setSession({ loading: false, exists: false });
        }
    };

    useEffect(() => {
        checkTokens();
    }, []);

    const loadUserInfo = useCallback(async () => {
        const { accessToken } = await getTokens();
        const { userInfoEndpoint } = await AuthSession.fetchDiscoveryAsync(
            getRealmURL(props),
        );
        return AuthSession.fetchUserInfoAsync(
            { accessToken },
            { userInfoEndpoint },
        );
    }, []);
    

    return {
        isLoggedIn: session.exists,
        login: handleLogin,
        logout: handleLogout,
        refresh: handleTokenRefresh,
        ready: request !== null && session.loading === false,
        tokens,
        loadUserInfo,
    };
}