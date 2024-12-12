import { KeycloakContextValue } from "../types";
import tokenStorage, { TokenType } from "../storage/tokenStorage";
import { isTokenExpired } from "./jwt-utils";
import { KC_INITIAL_VALUE } from "../const";

export class KeycloakOfflineError extends Error { }

const throwLoginError = () => {
    throw new KeycloakOfflineError('Can\'t login when offline');
}

const throwRefreshError = () => {
    throw new KeycloakOfflineError('Can\'t refresh tokens when offline');
}

const throwLoadUserInfoError = () => {
    throw new KeycloakOfflineError('Can\'t load user info when offline')
}

export const configureOfflineAccess = async (
    setKeycloakContextValue: (value: KeycloakContextValue | ((prev: KeycloakContextValue) => KeycloakContextValue)) => void
): Promise<void> => {
    const tokens: TokenType = await tokenStorage.get();
    let isLoggedIn = false;

    if (tokens.refreshToken && !isTokenExpired(tokens.refreshToken)) {
        isLoggedIn = true;
    }

    const logout: () => Promise<void> = async () => {
        await tokenStorage.reset();
        setKeycloakContextValue((prev: KeycloakContextValue) => ({ ...prev, isLoggedIn: false, tokens: KC_INITIAL_VALUE.tokens }));
    }

    setKeycloakContextValue({
        isLoggedIn,
        login: throwLoginError,
        logout,
        refresh: throwRefreshError,
        ready: true,
        tokens,
        loadUserInfo: throwLoadUserInfoError,
    });
}