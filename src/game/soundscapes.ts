import type { Soundscape } from './types';

interface SoundscapeProfile {
  scale: number;
  filter: number;
  gain: number;
  step: number;
  melody: readonly number[];
  chords: readonly (readonly number[])[];
}

/** Original local scores: semitone offsets above the district's root note. */
export const SOUNDSCAPES: Record<Soundscape, SoundscapeProfile> = {
  neon: {
    scale: 1, filter: 1800, gain: 1, step: .25,
    melody: [12, 19, 24, 19, 15, 22, 27, 22, 17, 24, 29, 24, 15, 22, 27, 19],
    chords: [[0, 7, 12], [3, 10, 15], [5, 12, 17], [3, 10, 15]],
  },
  jazz: {
    scale: .89, filter: 2400, gain: 1.08, step: .38,
    melody: [24, 28, 31, 33, 34, 31, 28, 26, 29, 33, 36, 33, 31, 28, 26, 23],
    chords: [[0, 4, 7, 11], [2, 5, 9, 12], [5, 9, 12, 16], [7, 11, 14, 17]],
  },
  river: {
    scale: .75, filter: 1900, gain: 1.15, step: 1.2,
    melody: [24, 31, 28, 36, 26, 33, 29, 38, 28, 35, 31, 40, 26, 33, 29, 36],
    chords: [[0, 7, 14], [2, 9, 16], [4, 11, 18], [2, 9, 14]],
  },
  radio: {
    scale: 1.12, filter: 1600, gain: .82, step: .3,
    melody: [24, 28, 31, 28, 33, 31, 28, 24, 26, 29, 33, 29, 31, 28, 26, 24],
    chords: [[0, 4, 7], [9, 12, 16], [5, 9, 12], [7, 11, 14]],
  },
};
