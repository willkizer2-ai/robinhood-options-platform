import { SignIn } from '@clerk/nextjs';

export const metadata = { title: 'Sign in — Web Trace' };

export default function LoginPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-page)', padding: 20 }}>
      <SignIn
        routing="path"
        path="/login"
        signUpUrl="/signup"
        forceRedirectUrl="/setup"
      />
    </div>
  );
}
