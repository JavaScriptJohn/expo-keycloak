import {KeycloakContextValue} from "../types";
import {TokenType} from "../storage/tokenStorage";
import {tokenStorage} from "../storage";
import {isTokenExpired} from "./jwt-utils";

export class KeycloakOfflineError extends Error {}

const throwLoginError = () => {
    throw new KeycloakOfflineError('Can\'t login when offline');
}

const logout: () => Promise<void> = async (): Promise<void> => {
    await tokenStorage.reset();
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