export const isTokenExpired = (token: any): boolean => {
    if (!token) {
        return true;
    }

    if (!token.exp) {
        return false;
    }

    return ((token.exp * 1000) - Date.now()) < 0;
}