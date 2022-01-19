import BaseStorage from './BaseStorage'

const TOKEN_KEY = '$KEYCLOAK_AUTH_TOKEN$'

export type TokenType = {
  accessToken: string
  expiresIn: number
  issuedAt: number
  refreshToken: string
  scope: string
  tokenType: string
  idToken: string
}

export const initialStorage: TokenType = {
  accessToken: '',
  expiresIn: 0,
  issuedAt: 0,
  refreshToken: '',
  scope: '',
  tokenType: '',
  idToken: '',
}

class TokenStorage extends BaseStorage<TokenType> {
  async set(tokens: TokenType) {
    const prevSession = await this.getValue()
    await this.setValue({ ...prevSession, ...tokens })
  }

  async get() {
    return this.getValue()
  }
}

const tokenStorage = new TokenStorage(initialStorage, TOKEN_KEY)

export default tokenStorage
