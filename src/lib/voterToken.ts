const STORAGE_KEY = 'pca_voter_token'

export function getVoterToken(): string {
  let token = localStorage.getItem(STORAGE_KEY)
  if (!token) {
    token = crypto.randomUUID()
    localStorage.setItem(STORAGE_KEY, token)
  }
  return token
}

function votedTeamsKey(sessionId: string) {
  return `pca_voted_${sessionId}`
}

export function getVotedTeamIds(sessionId: string): string[] {
  const raw = localStorage.getItem(votedTeamsKey(sessionId))
  return raw ? (JSON.parse(raw) as string[]) : []
}

export function saveVotedTeamIds(sessionId: string, teamIds: string[]) {
  localStorage.setItem(votedTeamsKey(sessionId), JSON.stringify(teamIds))
}
