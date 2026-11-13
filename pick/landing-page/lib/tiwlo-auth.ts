const PICK_DASHBOARD_URL = 'https://pick.tiwlo.com/dashboard'
const TIWLO_AUTH_ORIGIN = 'https://auth.tiwlo.com'

export interface TiwloSessionUser {
  id: string
  name: string
  email: string
  role: string
  avatar?: string
}

export function getTiwloAuthUrl(mode: 'login' | 'signup'): string {
  const url = new URL(mode === 'signup' ? '/create-account' : '/login', TIWLO_AUTH_ORIGIN)
  url.searchParams.set('return_to', PICK_DASHBOARD_URL)
  return url.toString()
}

export function startTiwloAuth(mode: 'login' | 'signup'): void {
  window.location.assign(getTiwloAuthUrl(mode))
}

export async function fetchTiwloSession(): Promise<TiwloSessionUser | null> {
  try {
    const response = await fetch('/api/auth/session', {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) return null
    const data = await response.json()
    if (data?.authenticated && data?.user) {
      return {
        id: String(data.user.id || ''),
        name: String(data.user.name || data.user.storeName || 'Tiwlo User'),
        email: String(data.user.email || ''),
        role: String(data.user.role || 'owner'),
        avatar: data.user.avatar ? String(data.user.avatar) : undefined,
      }
    }
    return null
  } catch {
    return null
  }
}
