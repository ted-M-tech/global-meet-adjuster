'use client';

import { useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { VotingTable } from './voting-table';
import { VotingCard } from './voting-card';
import { GuestProfileDialog } from './guest-profile-dialog';
import { useEditToken } from '@/hooks/use-edit-token';
import { registerGuest } from '@/app/actions/guest';
import { updateGuestAnswer } from '@/app/actions/guest';
import type { Candidate, GuestDocument, VoteStatus, Answer } from '@/types';

interface VotingFormProps {
  eventId: string;
  candidates: Candidate[];
  guests: GuestDocument[];
  hostTimezone: string;
  isFixed: boolean;
  fixedCandidateId?: string;
}

type FormMode = 'view' | 'new' | 'edit';

export function VotingForm({
  eventId,
  candidates,
  guests,
  hostTimezone,
  isFixed,
  fixedCandidateId,
}: VotingFormProps) {
  const t = useTranslations('voting');
  const tError = useTranslations('error');
  const { getToken, saveToken, findMyGuestId } = useEditToken();

  const [mode, setMode] = useState<FormMode>('view');
  const [editingGuestId, setEditingGuestId] = useState<string | null>(null);
  const [editingAnswers, setEditingAnswers] = useState<Record<string, VoteStatus>>({});
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const [saving, setSaving] = useState(false);

  const myGuestId = findMyGuestId(
    eventId,
    guests.map((g) => g.id)
  );

  const handleNewResponse = useCallback(() => {
    setMode('new');
    setEditingGuestId(null);
    setEditingAnswers({});
  }, []);

  const handleGuestClick = useCallback(
    (guestId: string) => {
      if (isFixed) return;
      const token = getToken(eventId, guestId);
      if (!token) return;

      const guest = guests.find((g) => g.id === guestId);
      if (!guest) return;

      const answers: Record<string, VoteStatus> = {};
      for (const a of guest.answers) {
        answers[a.candidateId] = a.status;
      }

      setMode('edit');
      setEditingGuestId(guestId);
      setEditingAnswers(answers);
    },
    [eventId, guests, isFixed, getToken]
  );

  const handleAnswerChange = useCallback(
    (candidateId: string, status: VoteStatus | undefined) => {
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

  const handleSaveNew = useCallback(() => {
    setShowProfileDialog(true);
  }, []);

  const handleProfileSubmit = useCallback(
    async (name: string, email: string) => {
      setSaving(true);
      try {
        const answers: Answer[] = Object.entries(editingAnswers).map(
          ([candidateId, status]) => ({ candidateId, status })
        );

        const result = await registerGuest({
          eventId,
          name,
          email: email || undefined,
          answers,
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
        setMode('view');
        setEditingGuestId(null);
        setEditingAnswers({});
      } catch {
        toast.error(tError('generic'));
      } finally {
        setSaving(false);
      }
    },
    [editingAnswers, eventId, saveToken, t, tError]
  );

  const handleUpdateAnswer = useCallback(async () => {
    if (!editingGuestId) return;

    const token = getToken(eventId, editingGuestId);
    if (!token) return;

    setSaving(true);
    try {
      const answers: Answer[] = Object.entries(editingAnswers).map(
        ([candidateId, status]) => ({ candidateId, status })
      );

      const result = await updateGuestAnswer({
        eventId,
        guestId: editingGuestId,
        editToken: token,
        answers,
      });

      if (!result.success) {
        toast.error(tError('generic'));
        return;
      }

      setMode('view');
      setEditingGuestId(null);
      setEditingAnswers({});
    } catch {
      toast.error(tError('generic'));
    } finally {
      setSaving(false);
    }
  }, [editingGuestId, editingAnswers, eventId, getToken, tError]);

  const handleCancel = useCallback(() => {
    setMode('view');
    setEditingGuestId(null);
    setEditingAnswers({});
  }, []);

  const showTable = mode !== 'view' || guests.length > 0;
  const currentEditingGuestId = mode === 'new' ? '__new__' : editingGuestId;

  return (
    <div className="space-y-4">
      {showTable && (
        <>
          {/* PC: table */}
          <div className="hidden md:block">
            <VotingTable
              candidates={candidates}
              guests={mode === 'new' ? [...guests, createTempGuest(candidates)] : guests}
              hostTimezone={hostTimezone}
              editingGuestId={mode === 'new' ? '__new__' : editingGuestId}
              onAnswerChange={handleAnswerChange}
              editingAnswers={editingAnswers}
              onGuestClick={!isFixed ? handleGuestClick : undefined}
              fixedCandidateId={fixedCandidateId}
            />
          </div>
          {/* Mobile: card */}
          <div className="md:hidden">
            <VotingCard
              candidates={candidates}
              guests={mode === 'new' ? [...guests, createTempGuest(candidates)] : guests}
              hostTimezone={hostTimezone}
              editingGuestId={mode === 'new' ? '__new__' : editingGuestId}
              onAnswerChange={handleAnswerChange}
              editingAnswers={editingAnswers}
              onGuestClick={!isFixed ? handleGuestClick : undefined}
              fixedCandidateId={fixedCandidateId}
            />
          </div>
        </>
      )}

      {/* Action buttons */}
      {!isFixed && (
        <div className="flex gap-2">
          {mode === 'view' && (
            <Button onClick={handleNewResponse}>
              {myGuestId ? t('editResponse') : t('newResponse')}
            </Button>
          )}
          {mode === 'new' && (
            <>
              <Button onClick={handleSaveNew} disabled={saving}>
                {t('submit')}
              </Button>
              <Button variant="outline" onClick={handleCancel}>
                {t('noAnswer')}
              </Button>
            </>
          )}
          {mode === 'edit' && (
            <>
              <Button onClick={handleUpdateAnswer} disabled={saving}>
                {saving ? '...' : t('update')}
              </Button>
              <Button variant="outline" onClick={handleCancel}>
                {t('noAnswer')}
              </Button>
            </>
          )}
        </div>
      )}

      <GuestProfileDialog
        open={showProfileDialog}
        onOpenChange={setShowProfileDialog}
        onSubmit={handleProfileSubmit}
        loading={saving}
      />
    </div>
  );
}

function createTempGuest(candidates: Candidate[]): GuestDocument {
  return {
    id: '__new__',
    name: '---',
    editTokenHash: '',
    answers: [],
    registeredAt: new Date(),
    updatedAt: new Date(),
  };
}
