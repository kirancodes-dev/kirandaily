import { buildRoadmap } from './roadmapBuilder';

/** Edit topics here to change the default German roadmap (or edit it in the app: Settings → Roadmaps). */
export const germanRoadmapTopics: Record<string, string[]> = {
  A1: [
    'Alphabet',
    'Numbers',
    'Greetings',
    'Introductions',
    'Pronouns',
    'Articles',
    'Basic verbs',
    'Present tense',
    'Question words',
    'Time',
    'Dates',
    'Family',
    'Food',
    'Travel',
    'Daily routine',
    'Basic conversations',
  ],
  A2: [
    'Accusative case',
    'Dative case',
    'Modal verbs',
    'Separable verbs',
    'Perfect tense',
    'Comparatives',
    'Shopping',
    'Health',
    'Work and jobs',
    'Directions',
  ],
  B1: [
    'Subordinate clauses',
    'Relative clauses',
    'Simple past (Präteritum)',
    'Passive voice',
    'Konjunktiv II',
    'Giving opinions',
    'Formal letters and emails',
    'Exam practice',
  ],
};

export const createGermanRoadmap = () => buildRoadmap('german', 'German', germanRoadmapTopics);
