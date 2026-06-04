import GeneralNotificationsPage from '@/components/notifications/GeneralNotificationsPage';

export default function DashboardNotificationsPage() {
  return (
    <GeneralNotificationsPage
      basePath="/dashboard"
      title="My Notifications"
      subtitle="View your Fund Space reminders, payment updates, verification messages, and general TrustPoint alerts."
    />
  );
}