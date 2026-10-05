import { PageHeader } from '../components/common/Feedback';
import { ProfileSettings } from '../components/settings/ProfileSettings';
import { CloudSyncSettings } from '../components/settings/CloudSyncSettings';
import { RoutineSettings } from '../components/settings/RoutineSettings';
import { TargetSettings } from '../components/settings/TargetSettings';
import { SubjectSettings } from '../components/settings/SubjectSettings';
import { CategorySettings } from '../components/settings/CategorySettings';
import { RoadmapSettings } from '../components/settings/RoadmapSettings';
import { DataSettings } from '../components/settings/DataSettings';
import { ReminderSettings } from '../components/settings/ReminderSettings';

export default function Settings() {
  return (
    <div className="space-y-4">
      <PageHeader title="Settings" />
      <CloudSyncSettings />
      <ProfileSettings />
      <ReminderSettings />
      <RoutineSettings />
      <TargetSettings />
      <SubjectSettings />
      <CategorySettings />
      <RoadmapSettings />
      <DataSettings />
      <p className="pb-4 text-center text-sm text-slate-500">Kiran Planner · works offline · your data is only yours</p>
    </div>
  );
}
