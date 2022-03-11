import { createContext } from 'react'
import { KC_INITIAL_VALUE } from './const'
import {KeycloakInfo} from './types';

export const KeycloakContext = createContext<KeycloakInfo>(KC_INITIAL_VALUE)
