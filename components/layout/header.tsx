'use client';

import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { useAuth } from '@/providers/auth-provider';
import { LoginButton } from '@/components/auth/login-button';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';

export function Header() {
  const t = useTranslations();
  const locale = useLocale();
  const { user, loading, signOut } = useAuth();

  return (
    <header className="border-b">
      <div className="container mx-auto px-4 h-14 flex items-center justify-between">
        <Link href={`/${locale}`} className="font-bold text-lg">
          {t('common.appName')}
        </Link>

        <div className="flex items-center gap-3">
          <LocaleSwitcher />

          {!loading && (
            <>
              {user ? (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground hidden sm:inline">
                    {user.displayName}
                  </span>
                  <Button variant="ghost" size="sm" onClick={signOut}>
                    <LogOut className="h-4 w-4 mr-1" />
                    <span className="hidden sm:inline">{t('auth.logout')}</span>
                  </Button>
                </div>
              ) : (
                <LoginButton size="sm" />
              )}
            </>
          )}
        </div>
      </div>
    </header>
  );
}
