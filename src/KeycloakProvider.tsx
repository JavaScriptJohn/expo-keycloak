import React, {FC, useEffect, useRef, useState} from 'react';
import {KeycloakConfiguration, KeycloakContextValue} from './types';
import {KeycloakContext} from './KeycloakContext';
import {KC_INITIAL_VALUE} from "./const";
import {configureOfflineAccess} from "./utils/offline-access";
import {configureOnlineAccess} from "./utils/online-access";
import {useNetInfo} from '@react-native-community/netinfo';

export const KeycloakProvider: FC<KeycloakConfiguration> = ({
    usePKCE = false,
    scopes = ['openid'],
    ...props
}) => {
    const refreshHandler = useRef<number>(0)
    const netInfo = useNetInfo();
    const [keycloakContextValue, setKeycloakContextValue] = useState<KeycloakContextValue>(KC_INITIAL_VALUE);


    useEffect(() => {

        const asyncFunction = async () => {
            if (netInfo.isInternetReachable) {
                await configureOnlineAccess(refreshHandler, props, setKeycloakContextValue);
            } else {
                await configureOfflineAccess(setKeycloakContextValue);
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
        usePKCE,
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
            {props.children}
        </KeycloakContext.Provider>
    );
};
