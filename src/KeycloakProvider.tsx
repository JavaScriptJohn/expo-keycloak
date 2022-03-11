import React, { FC } from 'react';
import { KeycloakConfiguration } from './types';
import { useOnlineAccess } from './hooks';
import { KeycloakContext } from './KeycloakContext';


export const KeycloakProvider: FC<KeycloakConfiguration> = (props) => {
  const onlineAccessKeycloakInfo = useOnlineAccess(props);

  return (
    <KeycloakContext.Provider
      value={onlineAccessKeycloakInfo}
    >
      {props.children}
    </KeycloakContext.Provider>
  );
};
