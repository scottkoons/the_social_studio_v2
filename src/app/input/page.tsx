'use client';

import { AuthGuard, Navbar } from '@/components/layout';
import { PageHeader, Card, Button, EmptyState, PhotoIcon } from '@/components/ui';

export default function InputPage() {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Navbar />
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <PageHeader
            title="Input"
            subtitle="Add content to your scheduled posts"
            actions={
              <Button variant="secondary">Add Post</Button>
            }
          />

          <Card padding="none">
            <EmptyState
              icon={<PhotoIcon className="h-6 w-6" />}
              title="No posts yet"
              description="Create a schedule first, then add content here"
              className="border-0"
            />
          </Card>
        </main>
      </div>
    </AuthGuard>
  );
}
