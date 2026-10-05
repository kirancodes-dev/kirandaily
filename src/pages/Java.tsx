import { Link } from 'react-router-dom';
import { useToday } from '../hooks/useToday';
import { useCategoryTotal, useRoadmap } from '../hooks/useRoadmap';
import { RoadmapView } from '../components/roadmap/RoadmapView';
import { PageHeader } from '../components/common/Feedback';
import { StatTile } from '../components/common/Card';
import { ProgressBar } from '../components/common/Progress';
import { formatMinutes } from '../utils/date';

export default function Java() {
  const today = useToday();
  const { progress } = useRoadmap('java');
  const minutes = useCategoryTotal('java', today);
  return (
    <div className="space-y-4">
      <PageHeader title="Java" subtitle="Basics → OOP → Collections. Spring Boot comes after this roadmap." />
      <div className="grid grid-cols-3 gap-3">
        <StatTile label="Completed" value={`${progress.completed}/${progress.total}`} />
        <StatTile label="In progress" value={progress.inProgress} />
        <StatTile label="Time studied" value={formatMinutes(minutes)} />
      </div>
      <ProgressBar value={progress.pct} label="Java roadmap" />
      <RoadmapView id="java" />
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Edit phases and topics in <Link to="/settings" className="font-medium underline">Settings → Roadmaps</Link>.
      </p>
    </div>
  );
}
