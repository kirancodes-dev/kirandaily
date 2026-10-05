import { defaultPlan, scheduleConfig, type PlanBlock } from '../config/schedule';
import type { TaskTemplate } from '../types/task';
import { slug } from '../utils/id';

function blockToTemplate(block: PlanBlock, index: number, startDate: string): TaskTemplate {
  const days = block.recurrence.days?.join('') ?? '';
  return {
    id: `tpl-${block.key ?? slug(block.title)}-${block.recurrence.type}${days}-${block.start.replace(':', '')}-${index}`,
    key: block.key,
    title: block.title,
    category: block.category,
    startTime: block.start,
    endTime: block.end,
    priority: block.priority ?? 'medium',
    notes: block.notes ?? '',
    recurrence: { ...block.recurrence, days: block.recurrence.days ? [...block.recurrence.days] : undefined },
    startDate,
    rotateSubjects: block.rotateSubjects,
    rotationSlot: block.rotationSlot,
    locked: block.locked,
  };
}

/** Recurring templates built from src/config/schedule.ts. */
export function createDefaultTemplates(startDate = scheduleConfig.planStartDate): TaskTemplate[] {
  return defaultPlan.map((b, i) => blockToTemplate(b, i, startDate));
}
