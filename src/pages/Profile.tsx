import { PageHeader } from '../components/common/Feedback';
import { CodingProfiles } from '../components/integrations/CodingProfiles';
import { ProfileHeader } from '../components/profile/ProfileHeader';
import { ProfileStats } from '../components/profile/ProfileStats';
import { BadgesCard } from '../components/profile/BadgesCard';
import { useActivity } from '../components/profile/useActivity';
import { ActivityHeatmap } from '../components/charts/ActivityHeatmap';
import { useToday } from '../hooks/useToday';

/** Profile: who you are, your level, your year at a glance and your badges. */
export default function Profile() {
  const today = useToday();
  const activity = useActivity(today);
  return (
    <div className="space-y-4">
      <PageHeader title="Profile" subtitle="Your details, level, activity and badges." />
      <ProfileHeader />
      <ProfileStats activity={activity} />
      <ActivityHeatmap today={today} />
      <BadgesCard badges={activity.badges} />
      <CodingProfiles />
    </div>
  );
}
