import { AuthRedirect } from '@/components/auth/auth-redirect'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Create a PICK account',
  description: 'Create your PICK account using Tiwlo secure sign-up.',
}

export default function SignupPage() {
  return <AuthRedirect mode="signup" />
}
