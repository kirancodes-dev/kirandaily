import { useMemo } from 'react';
import { useAppData } from './useAppData';
import {
  collegeProgress,
  dayStats,
  dsaProblemStats,
  germanTotals,
  projectsProgress,
  rangeSummary,
  roadmapProgress,
  studyByCategory,
  studyTargetInRange,
  topicsCompletedBetween,
} from '../utils/calculations';
import { allStreaks } from '../utils/streaks';
import { monthDates, weekDates } from '../utils/date';

export function useDayStats(date: string) {
  const { stats } = useAppData();
  return useMemo(() => dayStats(stats, date), [stats, date]);
}

export function useStreaks(today: string) {
  const { stats } = useAppData();
  return useMemo(() => allStreaks(stats, today), [stats, today]);
}

export function useRoadmapProgress() {
  const { data } = useAppData();
  return useMemo(
    () => ({
      java: roadmapProgress(data.roadmaps.java),
      dsa: roadmapProgress(data.roadmaps.dsa),
      german: roadmapProgress(data.roadmaps.german),
      college: collegeProgress(data.subjects),
      projects: projectsProgress(data.projects),
    }),
    [data.roadmaps, data.subjects, data.projects],
  );
}

/** Everything the weekly review shows for the week containing `date`. */
export function useWeekSummary(date: string, today: string) {
  const { stats, data } = useAppData();
  return useMemo(() => {
    const dates = weekDates(date);
    const from = dates[0];
    const to = dates[6];
    return {
      dates,
      summary: rangeSummary(stats, dates, today),
      weekTarget: studyTargetInRange(data.settings, dates.filter((d) => d >= data.settings.planStartDate)),
      categories: studyByCategory(stats, dates.filter((d) => d <= today)),
      topicsDone: {
        java: topicsCompletedBetween(data.roadmaps.java, from, to),
        dsa: topicsCompletedBetween(data.roadmaps.dsa, from, to),
        german: topicsCompletedBetween(data.roadmaps.german, from, to),
      },
      problems: dsaProblemStats({ problemLogs: data.problemLogs.filter((l) => l.date >= from && l.date <= to) }, today).total,
    };
  }, [stats, data, date, today]);
}

export function useMonthSummary(year: number, month: number, today: string) {
  const { stats, data } = useAppData();
  return useMemo(() => {
    const dates = monthDates(year, month);
    const counted = dates.filter((d) => d <= today && d >= data.settings.planStartDate);
    const summary = rangeSummary(stats, counted, today);
    return {
      dates,
      summary,
      averageDailyMinutes: counted.length ? summary.studyMinutes / counted.length : 0,
      categories: studyByCategory(stats, counted),
      daily: dates.map((d) => {
        const s = dayStats(stats, d);
        return { date: d, label: String(Number(d.slice(8))), hours: Math.round((s.studyMinutes / 60) * 10) / 10, pct: s.completionPct };
      }),
      topicsDone: {
        java: topicsCompletedBetween(data.roadmaps.java, dates[0], dates[dates.length - 1]),
        dsa: topicsCompletedBetween(data.roadmaps.dsa, dates[0], dates[dates.length - 1]),
        german: topicsCompletedBetween(data.roadmaps.german, dates[0], dates[dates.length - 1]),
      },
    };
  }, [stats, data, year, month, today]);
}

export function useDsaStats(today: string) {
  const { data } = useAppData();
  return useMemo(() => dsaProblemStats(data, today), [data, today]);
}

export function useGermanTotals() {
  const { data } = useAppData();
  return useMemo(() => germanTotals(data), [data]);
}
