export interface WeeklyReview {
  id: string;
  /** Monday of the reviewed week (YYYY-MM-DD). */
  weekStart: string;
  wentWell: string;
  improve: string;
  nextPriority: string;
  savedAt: string;
}
