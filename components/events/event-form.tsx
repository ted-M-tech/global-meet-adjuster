'use client';

import { useCallback, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TimeGridPicker } from './time-grid-picker';
import { SharePanel } from './share-panel';
import { createEvent, updateEvent } from '@/app/actions/event';
import { getBrowserTimezone } from '@/lib/timezone';
import { DURATIONS, HOST_TOKEN_STORAGE_PREFIX } from '@/lib/constants';
import type { Candidate, Duration, EventDocument } from '@/types';

const formSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().max(500).default(''),
  duration: z.enum(['30', '60', '90', '120']).transform(Number),
  hostName: z.string().max(50).default(''),
});

type FormValues = {
  title: string;
  description: string;
  duration: Duration;
  hostName: string;
};

interface EventFormProps {
  mode: 'create' | 'edit';
  event?: EventDocument;
}

export function EventForm({ mode, event }: EventFormProps) {
  const t = useTranslations('event');
  const tVoting = useTranslations('voting');
  const tValidation = useTranslations('validation');
  const tError = useTranslations('error');
  const router = useRouter();
  const locale = useLocale();
  const [isPending, startTransition] = useTransition();

  const [candidates, setCandidates] = useState<Candidate[]>(
    event?.candidates ?? []
  );
  const [removedCandidateIds, setRemovedCandidateIds] = useState<string[]>([]);
  const [createdEventId, setCreatedEventId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: event?.title ?? '',
      description: event?.description ?? '',
      duration: String(event?.duration ?? 60) as '30' | '60' | '90' | '120',
      hostName: '',
    },
  });

  const durationStr = watch('duration');
  const duration = (Number(durationStr) || 60) as Duration;
  const title = watch('title') as string;

  const handleAddCandidate = useCallback(
    (start: Date, end: Date) => {
      const id = crypto.randomUUID();
      setCandidates((prev) => [...prev, { id, start, end }]);
    },
    []
  );

  const handleRemoveCandidate = useCallback(
    (id: string) => {
      setCandidates((prev) => prev.filter((c) => c.id !== id));
      if (mode === 'edit' && event?.candidates.some((c) => c.id === id)) {
        setRemovedCandidateIds((prev) => [...prev, id]);
      }
    },
    [mode, event]
  );

  const getHostEditToken = useCallback((eventId: string) => {
    if (typeof window === 'undefined') return undefined;
    return localStorage.getItem(`${HOST_TOKEN_STORAGE_PREFIX}${eventId}`) || undefined;
  }, []);

  const onSubmit = useCallback(
    (data: Record<string, unknown>) => {
      const values = data as unknown as FormValues;
      if (candidates.length === 0) {
        toast.error(tValidation('minCandidates'));
        return;
      }

      startTransition(async () => {
        try {
          if (mode === 'create') {
            const timezone = getBrowserTimezone();
            const result = await createEvent({
              title: values.title,
              description: values.description,
              duration: values.duration,
              timezone,
              candidates: candidates.map((c) => ({
                start: c.start,
                end: c.end,
              })),
              hostName: values.hostName || undefined,
            });

            if (result.success) {
              // Store host edit token for guest hosts
              if (result.data.hostEditToken) {
                localStorage.setItem(
                  `${HOST_TOKEN_STORAGE_PREFIX}${result.data.eventId}`,
                  result.data.hostEditToken
                );
              }
              setCreatedEventId(result.data.eventId);
            } else {
              toast.error(tError('generic'));
            }
          } else if (event) {
            const newCandidates = candidates.filter(
              (c) => !event.candidates.some((ec) => ec.id === c.id)
            );

            const result = await updateEvent({
              eventId: event.id,
              title: values.title,
              description: values.description,
              duration: values.duration,
              candidatesToAdd: newCandidates.length
                ? newCandidates.map((c) => ({ start: c.start, end: c.end }))
                : undefined,
              candidateIdsToRemove: removedCandidateIds.length
                ? removedCandidateIds
                : undefined,
              hostEditToken: getHostEditToken(event.id),
            });

            if (result.success) {
              router.push(`/${locale}/events/${event.id}`);
            } else {
              toast.error(tError('generic'));
            }
          }
        } catch {
          toast.error(tError('generic'));
        }
      });
    },
    [candidates, mode, event, removedCandidateIds, locale, router, tValidation, tError, getHostEditToken]
  );

  if (createdEventId) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <SharePanel eventId={createdEventId} eventTitle={title} />
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={() => router.push(`/${locale}/events/${createdEventId}`)}
          >
            {t('create.goToEvent')}
          </Button>
        </div>
      </div>
    );
  }

  const isCreate = mode === 'create';

  return (
    <div className="max-w-4xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>
            {isCreate ? t('create.title') : t('edit.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {isCreate && (
              <div className="space-y-2">
                <Label htmlFor="hostName">{tVoting('guestName')}</Label>
                <Input
                  id="hostName"
                  placeholder={tVoting('guestNamePlaceholder')}
                  maxLength={50}
                  {...register('hostName')}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="title">{t('create.eventTitle')}</Label>
              <Input
                id="title"
                placeholder={t('create.eventTitlePlaceholder')}
                {...register('title')}
              />
              {errors.title && (
                <p className="text-sm text-destructive">
                  {tValidation('required')}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">{t('create.memo')}</Label>
              <Textarea
                id="description"
                placeholder={t('create.memoPlaceholder')}
                rows={3}
                {...register('description')}
              />
              {errors.description && (
                <p className="text-sm text-destructive">
                  {tValidation('maxLength')}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>{t('create.duration')}</Label>
              <Select
                value={durationStr as string}
                onValueChange={(v) => setValue('duration', v as '30' | '60' | '90' | '120')}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DURATIONS.map((d) => (
                    <SelectItem key={d} value={String(d)}>
                      {t(`create.durationOptions.${d}` as const)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label>{t('create.candidates')}</Label>
              <TimeGridPicker
                candidates={candidates}
                duration={duration}
                onAdd={handleAddCandidate}
                onRemove={handleRemoveCandidate}
              />
            </div>

            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending
                ? '...'
                : isCreate
                  ? t('create.submit')
                  : t('edit.submit')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
