import { SignUp } from '@clerk/nextjs';

export const metadata = { title: 'Create account — Web Trace' };

export default function SignupPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-page)', padding: 20 }}>
      <SignUp
        routing="path"
        path="/signup"
        signInUrl="/login"
        forceRedirectUrl="/setup"
      />
    </div>
  );
}
