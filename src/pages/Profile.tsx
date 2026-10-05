import { PageHeader } from '../components/common/Feedback';
import { Avatar } from '../components/profile/Avatar';
import { CodingProfiles } from '../components/integrations/CodingProfiles';
import { useAppData } from '../hooks/useAppData';

/** Feature: profile. Replaced by the profile feature (must keep <CodingProfiles />). */
export default function Profile() {
  const { data } = useAppData();
  return (
    <div className="space-y-4">
      <PageHeader title="Profile" />
      <div className="flex items-center gap-4">
        <Avatar size={72} />
        <div>
          <p className="text-xl font-semibold">{data.profile.name}</p>
          <p className="text-slate-600 dark:text-slate-400">{data.profileExtra.headline}</p>
        </div>
      </div>
      <CodingProfiles />
    </div>
  );
}
