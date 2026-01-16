'use client';

import { AuthGuard, Navbar } from '@/components/layout';
import { PageHeader, Card, Button, EmptyState, DocumentIcon } from '@/components/ui';

export default function ExportPage() {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Navbar />
        <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
          <PageHeader
            title="Export"
            subtitle="Download Buffer-compatible CSV files"
          />

          <Card padding="lg">
            <div className="mb-6">
              <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
                Export Options
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Select which platforms to include in your export
              </p>
            </div>

            <div className="mb-8 space-y-3">
              <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-gray-200 p-4 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800">
                <input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500" defaultChecked />
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-blue-100 text-xs font-bold text-blue-600">FB</span>
                  <span className="font-medium text-gray-900 dark:text-white">Facebook</span>
                </div>
              </label>

              <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-gray-200 p-4 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800">
                <input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500" defaultChecked />
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-pink-100 text-xs font-bold text-pink-600">IG</span>
                  <span className="font-medium text-gray-900 dark:text-white">Instagram</span>
                </div>
              </label>
            </div>

            <EmptyState
              icon={<DocumentIcon className="h-6 w-6" />}
              title="No posts ready for export"
              description="Generate AI captions for your posts first"
            />

            <div className="mt-8 flex justify-end gap-3">
              <Button variant="secondary" disabled>
                Preview Export
              </Button>
              <Button disabled>
                Download CSV
              </Button>
            </div>
          </Card>
        </main>
      </div>
    </AuthGuard>
  );
}
