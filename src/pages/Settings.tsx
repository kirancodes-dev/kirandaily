import { PageHeader } from '../components/common/Feedback';
import { ProfileSettings } from '../components/settings/ProfileSettings';
import { RoutineSettings } from '../components/settings/RoutineSettings';
import { TargetSettings } from '../components/settings/TargetSettings';
import { SubjectSettings } from '../components/settings/SubjectSettings';
import { CategorySettings } from '../components/settings/CategorySettings';
import { RoadmapSettings } from '../components/settings/RoadmapSettings';
import { DataSettings } from '../components/settings/DataSettings';

export default function Settings() {
  return (
    <div className="space-y-4">
      <PageHeader title="Settings" subtitle="Everything here is saved in this browser." />
      <ProfileSettings />
      <RoutineSettings />
      <TargetSettings />
      <SubjectSettings />
      <CategorySettings />
      <RoadmapSettings />
      <DataSettings />
      <p className="pb-4 text-center text-sm text-slate-500">Kiran Planner · local-only · no account, no server</p>
    </div>
  );
}
