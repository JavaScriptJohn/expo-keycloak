import { KeycloakConfiguration } from './types'

export const getRealmURL = (config: KeycloakConfiguration) => {
  const { url, realm } = config
  const slash = url.endsWith('/') ? '' : '/'
  return `${url + slash}realms/${encodeURIComponent(realm)}`
}
