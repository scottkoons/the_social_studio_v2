'use client';

import { AuthGuard, Navbar } from '@/components/layout';
import { PageHeader, Card, Button, EmptyState, DocumentIcon } from '@/components/ui';

export default function ReviewPage() {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Navbar />
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <PageHeader
            title="Review"
            subtitle="Generate and edit AI captions"
            actions={
              <div className="flex gap-3">
                <Button variant="secondary">Export</Button>
                <Button>Generate All</Button>
              </div>
            }
          />

          <Card padding="none">
            <EmptyState
              icon={<DocumentIcon className="h-6 w-6" />}
              title="No posts to review"
              description="Add content to your posts first, then generate captions"
              className="border-0"
            />
          </Card>
        </main>
      </div>
    </AuthGuard>
  );
}
