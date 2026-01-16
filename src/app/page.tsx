'use client';

import { AuthGuard, Navbar } from '@/components/layout';
import { Card, PageHeader, Button, EmptyState, CalendarIcon } from '@/components/ui';
import Link from 'next/link';

export default function DashboardPage() {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Navbar />
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <PageHeader
            title="Dashboard"
            subtitle="Overview of your social media schedule"
            actions={
              <Link href="/planning">
                <Button>Create Schedule</Button>
              </Link>
            }
          />

          {/* Summary Cards */}
          <div className="mb-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard
              title="Posts This Week"
              value="0"
              description="Scheduled posts"
              color="primary"
            />
            <SummaryCard
              title="Pending Generation"
              value="0"
              description="Awaiting AI captions"
              color="warning"
            />
            <SummaryCard
              title="Ready to Export"
              value="0"
              description="Complete posts"
              color="success"
            />
            <SummaryCard
              title="Total Posts"
              value="0"
              description="All time"
              color="default"
            />
          </div>

          {/* Quick Actions */}
          <div className="mb-8">
            <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
              Quick Actions
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <QuickActionCard
                href="/planning"
                title="Create Schedule"
                description="Plan your posting schedule"
                icon={<CalendarPlusIcon />}
              />
              <QuickActionCard
                href="/input"
                title="Add Content"
                description="Add images and text to posts"
                icon={<PencilIcon />}
              />
              <QuickActionCard
                href="/review"
                title="Generate Captions"
                description="AI-powered caption generation"
                icon={<SparklesIcon />}
              />
              <QuickActionCard
                href="/calendar"
                title="View Calendar"
                description="See your full schedule"
                icon={<CalendarIcon className="h-6 w-6" />}
              />
            </div>
          </div>

          {/* Recent Activity */}
          <div>
            <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
              Recent Activity
            </h2>
            <EmptyState
              icon={<CalendarIcon className="h-6 w-6" />}
              title="No recent activity"
              description="Create your first schedule to get started"
              action={
                <Link href="/planning">
                  <Button>Get Started</Button>
                </Link>
              }
            />
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}

interface SummaryCardProps {
  title: string;
  value: string;
  description: string;
  color: 'primary' | 'success' | 'warning' | 'default';
}

function SummaryCard({ title, value, description, color }: SummaryCardProps) {
  const colorStyles = {
    primary: 'bg-primary-50 text-primary-600 dark:bg-primary-900/20 dark:text-primary-400',
    success: 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400',
    warning: 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400',
    default: 'bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  };

  return (
    <Card padding="md">
      <div className="flex items-center gap-4">
        <div className={`rounded-lg p-3 ${colorStyles[color]}`}>
          <span className="text-2xl font-bold">{value}</span>
        </div>
        <div>
          <p className="font-medium text-gray-900 dark:text-white">{title}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>
        </div>
      </div>
    </Card>
  );
}

interface QuickActionCardProps {
  href: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}

function QuickActionCard({ href, title, description, icon }: QuickActionCardProps) {
  return (
    <Link href={href}>
      <Card hover padding="md" className="h-full cursor-pointer">
        <div className="flex items-start gap-4">
          <div className="rounded-lg bg-gray-100 p-3 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
            {icon}
          </div>
          <div>
            <p className="font-medium text-gray-900 dark:text-white">{title}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>
          </div>
        </div>
      </Card>
    </Link>
  );
}

function CalendarPlusIcon() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 11v6m3-3H9" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
      />
    </svg>
  );
}

function SparklesIcon() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
      />
    </svg>
  );
}
