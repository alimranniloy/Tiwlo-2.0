import { AuthRedirect } from '@/components/auth/auth-redirect'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sign in to PICK',
  description: 'Sign in to PICK securely with your Tiwlo account.',
}

export default function LoginPage() {
  return <AuthRedirect mode="login" />
}
