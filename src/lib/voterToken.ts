const STORAGE_KEY = 'pca_voter_token'

// Stable per-browser id used only for the /display presence count — not a
// vote credential, so it doesn't need to be tied to a verified email.
export function getVoterToken(): string {
  let token = localStorage.getItem(STORAGE_KEY)
  if (!token) {
    token = crypto.randomUUID()
    localStorage.setItem(STORAGE_KEY, token)
  }
  return token
}

const VOTER_AUTH_KEY = 'pca_voter_auth'

export type VoterAuth = {
  email: string
  voterToken: string
}

export function getVoterAuth(): VoterAuth | null {
  const raw = localStorage.getItem(VOTER_AUTH_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as VoterAuth
  } catch {
    return null
  }
}

export function saveVoterAuth(auth: VoterAuth) {
  localStorage.setItem(VOTER_AUTH_KEY, JSON.stringify(auth))
}
