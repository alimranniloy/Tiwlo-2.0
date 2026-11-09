const PICK_DASHBOARD_URL = 'https://pick.tiwlo.com/dashboard'
const TIWLO_AUTH_ORIGIN = 'https://auth.tiwlo.com'

export function getTiwloAuthUrl(mode: 'login' | 'signup'): string {
  const url = new URL(mode === 'signup' ? '/create-account' : '/login', TIWLO_AUTH_ORIGIN)
  url.searchParams.set('return_to', PICK_DASHBOARD_URL)
  url.searchParams.set('sso_login', '1')
  return url.toString()
}

export function startTiwloAuth(mode: 'login' | 'signup'): void {
  window.location.assign(getTiwloAuthUrl(mode))
}
