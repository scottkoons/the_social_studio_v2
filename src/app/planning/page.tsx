'use client';

import { AuthGuard, Navbar } from '@/components/layout';
import { PageHeader, Card, EmptyState, CalendarIcon } from '@/components/ui';

export default function PlanningPage() {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Navbar />
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <PageHeader
            title="Planning"
            subtitle="Create your posting schedule with AI-optimized timing"
          />

          <div className="grid gap-8 lg:grid-cols-2">
            {/* Controls Panel */}
            <Card padding="lg">
              <h2 className="mb-6 text-lg font-semibold text-gray-900 dark:text-white">
                Schedule Settings
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Planning functionality coming in Phase 3
              </p>
            </Card>

            {/* Preview Panel */}
            <Card padding="lg">
              <h2 className="mb-6 text-lg font-semibold text-gray-900 dark:text-white">
                Schedule Preview
              </h2>
              <EmptyState
                icon={<CalendarIcon className="h-6 w-6" />}
                title="No schedule generated"
                description="Configure your settings and generate a schedule"
              />
            </Card>
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}
