/**
 * Short daily nudges for the Today card. One per day, picked from the date so
 * it changes every morning but stays the same all day (and on every device).
 */

export type QuoteTag = 'study' | 'fitness' | 'discipline' | 'mindset';

export interface Quote {
  text: string;
  tag: QuoteTag;
}

export const QUOTES: readonly Quote[] = [
  { text: 'Small steps every day add up to big results.', tag: 'discipline' },
  { text: 'You don’t have to be great to start, but you have to start to be great.', tag: 'mindset' },
  { text: 'Discipline is choosing what you want most over what you want now.', tag: 'discipline' },
  { text: 'One focused hour beats three distracted ones.', tag: 'study' },
  { text: 'The gym session you skip is the one you needed most.', tag: 'fitness' },
  { text: 'Progress, not perfection.', tag: 'mindset' },
  { text: 'Code a little every day and it compounds.', tag: 'study' },
  { text: 'Motivation gets you going. Habit keeps you going.', tag: 'discipline' },
  { text: 'Strong body, sharp mind.', tag: 'fitness' },
  { text: 'Every expert was once a beginner.', tag: 'mindset' },
  { text: 'Hard problems are just easy problems you haven’t broken down yet.', tag: 'study' },
  { text: 'Win the morning, win the day.', tag: 'discipline' },
  { text: 'Sweat now, shine later.', tag: 'fitness' },
  { text: 'Don’t count the days. Make the days count.', tag: 'mindset' },
  { text: 'Read the error message. Then read it again.', tag: 'study' },
  { text: 'Consistency beats intensity.', tag: 'discipline' },
  { text: 'Your future self is watching. Make them proud.', tag: 'mindset' },
  { text: 'One more rep. One more problem. One more page.', tag: 'fitness' },
  { text: 'Understand it once, and you never have to memorise it.', tag: 'study' },
  { text: 'Do it tired. Do it bored. Just do it.', tag: 'discipline' },
  { text: 'Rest is part of the plan, not a break from it.', tag: 'fitness' },
  { text: 'Focus on the next task, not the whole mountain.', tag: 'mindset' },
  { text: 'A bug fixed today is a lesson for life.', tag: 'study' },
  { text: 'Show up, even on the days you don’t feel like it.', tag: 'discipline' },
  { text: 'Your only competition is who you were yesterday.', tag: 'mindset' },
  { text: 'Lift heavy, sleep well, repeat.', tag: 'fitness' },
  { text: 'Teach it to yourself out loud — that’s how you know you know it.', tag: 'study' },
  { text: 'Phone away, timer on, mind in.', tag: 'discipline' },
  { text: 'Doubt kills more dreams than failure ever will.', tag: 'mindset' },
  { text: 'Muscles are built in the gym and earned in the kitchen.', tag: 'fitness' },
  { text: 'Practice the problem you are afraid of.', tag: 'study' },
  { text: 'The plan works if you work the plan.', tag: 'discipline' },
  { text: 'Be patient. Good things take time and reps.', tag: 'mindset' },
  { text: 'A 20-minute walk still counts.', tag: 'fitness' },
  { text: 'Ein Wort am Tag — one German word a day keeps fluency on its way.', tag: 'study' },
  { text: 'Don’t break the chain.', tag: 'discipline' },
  { text: 'Fall seven times, stand up eight.', tag: 'mindset' },
  { text: 'Hydrate. Stretch. Breathe. Then grind.', tag: 'fitness' },
  { text: 'Revise today what you learned this week.', tag: 'study' },
  { text: 'Starting is the hardest part. You’re already here.', tag: 'discipline' },
  { text: 'Comfort zones don’t build careers.', tag: 'mindset' },
  { text: 'Earn your sleep.', tag: 'fitness' },
  { text: 'Write the code, then make it clean.', tag: 'study' },
  { text: 'Excuses don’t burn calories or solve problems.', tag: 'discipline' },
  { text: 'Believe you can and you’re halfway there.', tag: 'mindset' },
  { text: 'Every rep is a vote for the person you want to be.', tag: 'fitness' },
  { text: 'Patterns over problems: learn the pattern, solve a hundred.', tag: 'study' },
  { text: 'Done is better than perfect.', tag: 'discipline' },
  { text: 'Great things never came from comfort.', tag: 'mindset' },
  { text: 'Posture up, shoulders back, let’s go.', tag: 'fitness' },
  { text: 'Exams reward the ones who revised on boring days.', tag: 'study' },
  { text: 'Tiny habits, giant results.', tag: 'discipline' },
  { text: 'Stay hungry, stay humble.', tag: 'mindset' },
  { text: 'Energy comes from movement. Move first.', tag: 'fitness' },
  { text: 'Debug your day: what slowed you down yesterday?', tag: 'study' },
  { text: 'Make it so easy to start that you can’t say no.', tag: 'discipline' },
  { text: 'Today is a good day to have a good day.', tag: 'mindset' },
  { text: 'Your body hears everything your mind says. Keep it positive.', tag: 'fitness' },
  { text: 'Commit early, commit often.', tag: 'study' },
  { text: 'Be the person who finishes.', tag: 'discipline' },
];

/** Step through the list with a stride that shares no factor with its length, so every quote shows once per cycle. */
const STRIDE = 7;

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/** Days since 1970-01-01 for a local YYYY-MM-DD date (time-zone independent). */
export function dayNumber(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

/** The quote for a date: the same all day, a different one tomorrow. */
export function quoteForDate(date: string, quotes: readonly Quote[] = QUOTES): Quote {
  const n = quotes.length;
  const stride = gcd(STRIDE, n) === 1 ? STRIDE : 1;
  const idx = (((dayNumber(date) * stride) % n) + n) % n;
  return quotes[idx];
}
