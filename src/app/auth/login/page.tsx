import { LoginForm } from '@/components/auth/LoginForm';

type Props = {
  searchParams: Promise<{ redirect?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const { redirect: redirectTo } = await searchParams;

  return <LoginForm redirectTo={redirectTo} />;
}
