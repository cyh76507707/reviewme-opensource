import { sdk } from '@farcaster/miniapp-sdk'

export { sdk }

export async function initMiniApp() {
  try {
    await sdk.actions.ready()
    console.log('Mini App SDK initialized')
    return true
  } catch (error) {
    console.error('Failed to initialize Mini App SDK:', error)
    return false
  }
}

export async function getUserContext() {
  try {
    const context = await sdk.context
    return context
  } catch (error) {
    console.error('Failed to get user context:', error)
    return null
  }
}

