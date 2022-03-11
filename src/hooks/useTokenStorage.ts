import { useEffect, useState } from 'react'
import { tokenStorage } from '../storage'
import { TokenType, initialStorage } from '../storage/tokenStorage'

export const useTokenStorage = () => {
  const [state, setState] = useState({
    hydrated: true,
    tokens: initialStorage,
  })

  const restoreTokens = async () => {
    const tokens = await tokenStorage.get()
    setState({ hydrated: true, tokens })
  }

  const setTokens = async (tokens: TokenType) => {
    await tokenStorage.set(tokens)
    setState({ hydrated: true, tokens })
  }

  const getTokens = () => tokenStorage.get()

  const removeTokens = async () => {
    await tokenStorage.reset()
    setState({ hydrated: true, tokens: initialStorage })
  }

  useEffect(() => {
    restoreTokens()
  }, [])

  return {
    tokens: state.tokens,
    hydrated: state.hydrated,
    setTokens,
    removeTokens,
    getTokens,
  }
}
