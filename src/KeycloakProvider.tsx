import { useNetInfo } from '@react-native-community/netinfo';
import React, { FC, PropsWithChildren, useEffect, useRef, useState } from 'react';
import { KeycloakContext } from './KeycloakContext';
import { KC_INITIAL_VALUE } from "./const";
import { KeycloakConfiguration, KeycloakContextValue } from './types';
import { configureOfflineAccess } from "./utils/offline-access";
import { configureOnlineAccess } from "./utils/online-access";

export const KeycloakProvider: FC<PropsWithChildren<KeycloakConfiguration>> = ({
    children,
    ...props
}) => {
    const refreshHandler = useRef<number>(0)
    const netInfo = useNetInfo();
    const [keycloakContextValue, setKeycloakContextValue] = useState<KeycloakContextValue>(KC_INITIAL_VALUE);

    useEffect(() => {
        const asyncFunction = async () => {
            await configureOfflineAccess(setKeycloakContextValue);

            if (netInfo.isInternetReachable) {
                await configureOnlineAccess(refreshHandler, props, setKeycloakContextValue);
            }
        }

        asyncFunction().catch(() => {
            clearTimeout(refreshHandler.current)
        })

        return () => {
            clearTimeout(refreshHandler.current)
        }
    }, [
        netInfo.isInternetReachable,
        props.url,
        props.usePKCE,
        props.clientId,
        props.disableAutoRefresh,
        props.nativeRedirectPath,
        props.realm,
        props.refreshTimeBuffer,
        props.tokenStorageKey
    ])

    return (
        <KeycloakContext.Provider
            value={{
                ...keycloakContextValue
            }}
        >
            {children}
        </KeycloakContext.Provider>
    );
};
