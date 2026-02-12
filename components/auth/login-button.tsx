'use client';

import { useTranslations } from 'next-intl';
import { useAuth } from '@/providers/auth-provider';
import { Button } from '@/components/ui/button';

interface LoginButtonProps {
  size?: 'default' | 'sm' | 'lg' | 'icon';
  label?: string;
}

export function LoginButton({ size = 'default', label }: LoginButtonProps) {
  const t = useTranslations('auth');
  const { signIn } = useAuth();

  return (
    <Button size={size} onClick={signIn}>
      {label || t('loginWithGoogle')}
    </Button>
  );
}
