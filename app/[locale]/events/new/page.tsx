import { AuthGuard } from '@/components/auth/auth-guard';
import { EventForm } from '@/components/events/event-form';

export default function NewEventPage() {
  return (
    <AuthGuard>
      <EventForm mode="create" />
    </AuthGuard>
  );
}
