import { get } from './api'

interface PublicKeyResponse {
  algorithm: string
  publicKey: string
}

export async function encryptPassword(password: string): Promise<string> {
  const response = await get<PublicKeyResponse>('/api/auth/public-key')
  if (response.algorithm !== 'RSA-OAEP-256') {
    throw new Error('Unsupported password encryption algorithm.')
  }
  if (typeof response.publicKey !== 'string' || response.publicKey.length === 0) {
    throw new Error('Server did not return a valid public encryption key.')
  }

  const subtle = globalThis.crypto?.subtle
  if (subtle === undefined) {
    throw new Error('Web Crypto is unavailable in this browser. Please use a modern browser with HTTPS or localhost support.')
  }

  const keyBytes = Uint8Array.from(atob(response.publicKey), (character) => character.charCodeAt(0))
  const publicKey = await subtle.importKey(
    'spki',
    keyBytes,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['encrypt'],
  )
  const ciphertext = await subtle.encrypt(
    { name: 'RSA-OAEP' },
    publicKey,
    new TextEncoder().encode(password),
  )
  return btoa(String.fromCharCode(...new Uint8Array(ciphertext)))
}
