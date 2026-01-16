'use client';

import { AuthGuard, Navbar } from '@/components/layout';
import { PageHeader, Card, Button, EmptyState, CalendarIcon } from '@/components/ui';

export default function CalendarPage() {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Navbar />
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <PageHeader
            title="Calendar"
            subtitle="Visual overview of your schedule"
            actions={
              <div className="flex gap-3">
                <Button variant="ghost">
                  <ChevronLeftIcon className="h-5 w-5" />
                </Button>
                <Button variant="secondary">Today</Button>
                <Button variant="ghost">
                  <ChevronRightIcon className="h-5 w-5" />
                </Button>
              </div>
            }
          />

          <Card padding="lg">
            <EmptyState
              icon={<CalendarIcon className="h-6 w-6" />}
              title="No scheduled posts"
              description="Create a schedule to see your posts on the calendar"
            />
          </Card>
        </main>
      </div>
    </AuthGuard>
  );
}

function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}
