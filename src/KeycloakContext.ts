import { createContext } from 'react'
import { KC_INITIAL_VALUE } from './const'
import {KeycloakContextValue} from './types';

export const KeycloakContext = createContext<KeycloakContextValue>(KC_INITIAL_VALUE)
