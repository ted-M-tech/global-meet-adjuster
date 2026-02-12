'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { VotingTimeGrid } from './voting-time-grid';
import { VotingTimeGridMobile } from './voting-time-grid-mobile';
import { GuestProfileDialog } from './guest-profile-dialog';
import { useEditToken } from '@/hooks/use-edit-token';
import { registerGuest } from '@/app/actions/guest';
import { updateGuestAnswer } from '@/app/actions/guest';
import { getBrowserTimezone, getTimezoneName, COMMON_TIMEZONES } from '@/lib/timezone';
import type { Candidate, GuestDocument, VoteStatus, Answer } from '@/types';
import type { Locale } from '@/types';
import { useLocale } from 'next-intl';

interface VotingFormProps {
  eventId: string;
  candidates: Candidate[];
  guests: GuestDocument[];
  hostTimezone: string;
  isFixed: boolean;
  fixedCandidateId?: string;
  secondaryTz: string | null;
  onSecondaryTzChange: (tz: string | null) => void;
}

type FormMode = 'view' | 'edit';

export function VotingForm({
  eventId,
  candidates,
  guests,
  hostTimezone,
  isFixed,
  fixedCandidateId,
  secondaryTz,
  onSecondaryTzChange,
}: VotingFormProps) {
  const t = useTranslations('voting');
  const tError = useTranslations('error');
  const locale = useLocale() as Locale;
  const { getToken, saveToken, findMyGuestId } = useEditToken();

  const [mode, setMode] = useState<FormMode>('view');
  const [editingGuestId, setEditingGuestId] = useState<string | null>(null);
  const [editingAnswers, setEditingAnswers] = useState<Record<string, VoteStatus>>({});
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  const myGuestId = findMyGuestId(
    eventId,
    guests.map((g) => g.id)
  );

  // Auto-show profile dialog for new visitors
  const hasShownDialogRef = useRef(false);
  useEffect(() => {
    if (!isFixed && !myGuestId && !hasShownDialogRef.current) {
      hasShownDialogRef.current = true;
      setShowProfileDialog(true);
    }
  }, [isFixed, myGuestId]);

  // Profile submit: register guest immediately, then enter edit mode
  const handleProfileSubmit = useCallback(
    async (name: string, email: string) => {
      setRegistering(true);
      try {
        const result = await registerGuest({
          eventId,
          name,
          email: email || undefined,
          answers: [],
        });

        if (!result.success) {
          if (result.error === 'duplicateEmail') {
            toast.error(t('duplicateEmail'));
          } else {
            toast.error(tError('generic'));
          }
          return;
        }

        saveToken(eventId, result.data.guestId, result.data.editToken);
        setShowProfileDialog(false);
        setEditingGuestId(result.data.guestId);
        setEditingAnswers({});
        setMode('edit');
      } catch {
        toast.error(tError('generic'));
      } finally {
        setRegistering(false);
      }
    },
    [eventId, saveToken, t, tError]
  );

  // Enter edit mode for existing guest
  const handleEditClick = useCallback(() => {
    if (!myGuestId) {
      setShowProfileDialog(true);
      return;
    }
    const guest = guests.find((g) => g.id === myGuestId);
    if (!guest) return;
    const token = getToken(eventId, myGuestId);
    if (!token) {
      toast.error(t('editTokenExpired'));
      return;
    }

    const answers: Record<string, VoteStatus> = {};
    for (const a of guest.answers) {
      answers[a.candidateId] = a.status;
    }

    setMode('edit');
    setEditingGuestId(myGuestId);
    setEditingAnswers(answers);
  }, [myGuestId, guests, eventId, getToken, t]);

  // Answer change handler
  const dirtyRef = useRef(false);
  const handleAnswerChange = useCallback(
    (candidateId: string, status: VoteStatus | undefined) => {
      dirtyRef.current = true;
      setEditingAnswers((prev) => {
        const next = { ...prev };
        if (status === undefined) {
          delete next[candidateId];
        } else {
          next[candidateId] = status;
        }
        return next;
      });
    },
    []
  );

  // Auto-save effect (debounced)
  const editingGuestIdRef = useRef(editingGuestId);
  editingGuestIdRef.current = editingGuestId;
  const editingAnswersRef = useRef(editingAnswers);
  editingAnswersRef.current = editingAnswers;

  useEffect(() => {
    if (!dirtyRef.current || mode !== 'edit') return;

    const timer = setTimeout(async () => {
      dirtyRef.current = false;
      const guestId = editingGuestIdRef.current;
      if (!guestId) return;

      const token = getToken(eventId, guestId);
      if (!token) return;

      setSaveStatus('saving');
      try {
        const answers: Answer[] = Object.entries(editingAnswersRef.current).map(
          ([candidateId, status]) => ({ candidateId, status })
        );
        const result = await updateGuestAnswer({
          eventId,
          guestId,
          editToken: token,
          answers,
        });
        if (!result.success) {
          toast.error(tError('generic'));
          setSaveStatus('idle');
        } else {
          setSaveStatus('saved');
          setTimeout(() => setSaveStatus((s) => (s === 'saved' ? 'idle' : s)), 2000);
        }
      } catch {
        toast.error(tError('generic'));
        setSaveStatus('idle');
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [editingAnswers, mode, eventId, getToken, tError]);

  // Done: exit edit mode
  const handleDone = useCallback(() => {
    setMode('view');
    setEditingGuestId(null);
    setEditingAnswers({});
    setSaveStatus('idle');
  }, []);

  const currentEditingGuestId = editingGuestId;

  const browserTz = useMemo(() => getBrowserTimezone(), []);

  const tzOptions = useMemo(() => {
    const pinned: string[] = [];
    if (!COMMON_TIMEZONES.includes(browserTz as typeof COMMON_TIMEZONES[number])) {
      pinned.push(browserTz);
    }
    if (hostTimezone !== browserTz && !COMMON_TIMEZONES.includes(hostTimezone as typeof COMMON_TIMEZONES[number])) {
      pinned.push(hostTimezone);
    }
    return { pinned, common: COMMON_TIMEZONES as readonly string[] };
  }, [browserTz, hostTimezone]);

  return (
    <div className="space-y-4">
      {/* Secondary timezone selector */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground whitespace-nowrap">{t('secondaryTimezone')}:</span>
        <Select
          value={secondaryTz ?? '__none__'}
          onValueChange={(val) => onSecondaryTzChange(val === '__none__' ? null : val)}
        >
          <SelectTrigger size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectItem value="__none__">{t('secondaryTzNone')}</SelectItem>
            <SelectSeparator />
            {tzOptions.pinned.length > 0 && (
              <>
                {tzOptions.pinned.map((tz) => (
                  <SelectItem key={tz} value={tz}>
                    {getTimezoneName(tz, locale)}
                  </SelectItem>
                ))}
                <SelectSeparator />
              </>
            )}
            {tzOptions.common.map((tz) => (
              <SelectItem key={tz} value={tz}>
                {getTimezoneName(tz, locale)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* PC: time grid */}
      <div className="hidden md:block">
        <VotingTimeGrid
          candidates={candidates}
          guests={guests}
          hostTimezone={hostTimezone}
          editingGuestId={currentEditingGuestId}
          onAnswerChange={handleAnswerChange}
          editingAnswers={editingAnswers}
          fixedCandidateId={fixedCandidateId}
          isFixed={isFixed}
          secondaryTz={secondaryTz}
        />
      </div>
      {/* Mobile: time grid */}
      <div className="md:hidden">
        <VotingTimeGridMobile
          candidates={candidates}
          guests={guests}
          hostTimezone={hostTimezone}
          editingGuestId={currentEditingGuestId}
          onAnswerChange={handleAnswerChange}
          editingAnswers={editingAnswers}
          fixedCandidateId={fixedCandidateId}
          isFixed={isFixed}
          secondaryTz={secondaryTz}
        />
      </div>

      {/* Action buttons */}
      {!isFixed && (
        <div className="flex items-center gap-3">
          {mode === 'view' && (
            <Button onClick={handleEditClick}>
              {myGuestId ? t('editResponse') : t('newResponse')}
            </Button>
          )}
          {mode === 'edit' && (
            <>
              <Button onClick={handleDone}>
                {t('done')}
              </Button>
              {saveStatus === 'saving' && (
                <span className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {t('autoSaving')}
                </span>
              )}
              {saveStatus === 'saved' && (
                <span className="flex items-center gap-1 text-sm text-green-600">
                  <Check className="h-3 w-3" />
                  {t('autoSaved')}
                </span>
              )}
            </>
          )}
        </div>
      )}

      <GuestProfileDialog
        open={showProfileDialog}
        onOpenChange={setShowProfileDialog}
        onSubmit={handleProfileSubmit}
        loading={registering}
      />
    </div>
  );
}
