'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { deleteEvent } from '@/app/actions/event';
import type { EventStatus } from '@/types';

interface DeleteEventDialogProps {
  eventId: string;
  eventStatus: EventStatus;
  trigger?: React.ReactNode;
}

export function DeleteEventDialog({
  eventId,
  eventStatus,
  trigger,
}: DeleteEventDialogProps) {
  const t = useTranslations('event.delete');
  const tCommon = useTranslations('common');
  const tError = useTranslations('error');
  const router = useRouter();
  const locale = useLocale();
  const [loading, setLoading] = useState(false);

  const isFixed = eventStatus === 'fixed';

  const handleDelete = useCallback(async () => {
    setLoading(true);
    try {
      const result = await deleteEvent({ eventId });
      if (result.success) {
        router.push(`/${locale}/dashboard`);
      } else {
        toast.error(tError('generic'));
      }
    } catch {
      toast.error(tError('generic'));
    } finally {
      setLoading(false);
    }
  }, [eventId, router, locale, tError]);

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        {trigger || (
          <Button variant="destructive" size="sm">
            {tCommon('delete')}
          </Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('title')}</AlertDialogTitle>
          <AlertDialogDescription>
            {isFixed ? t('fixedWarning') : t('message')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>
            {tCommon('cancel')}
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={handleDelete}
            disabled={loading}
          >
            {t('confirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
