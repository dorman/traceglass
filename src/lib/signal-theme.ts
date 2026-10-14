// @polsia:user-owned — Signal (Direction B) palette mirrored from
// `traceglass/src/theme.rs` `Theme::signal_dark` truecolor slots. Keep hex
// values in lockstep with that source of truth.

/** Exact RGB hex strings from `theme.rs` Slot::new triples (dark Signal). */
export const signalTheme = {
  bg: '#0F1117',
  surface: '#1A1D27',
  text: '#D7DAE0',
  textDim: '#737A8C',
  accent: '#3EE0D8',
  secondary: '#8B7CF6',
  border: '#2B3040',
  gutter: '#5A6172',
  cursorBg: '#232731',
  /** Chip / mode-pill / current-match ink — `match_fg` in theme.rs. */
  matchFg: '#0B0F14',
  searchBg: '#8B7CF6',
  searchCurrentBg: '#3EE0D8',
  logoTop: '#5B84EF',
  logoBottom: '#3EE0D8',
  danger: '#E06C75',
  marked: '#98C379',
  levelError: '#E06C75',
  levelWarn: '#E5C07B',
  levelInfo: '#7FA7CF',
  levelDebug: '#737A8C',
  sevCrit: '#FF5F6D',
  sevHigh: '#FF9F43',
  sevMed: '#F7C948',
  sevLow: '#5AA9FF',
} as const;

export type SignalTheme = typeof signalTheme;

/** Scene hold for the marketing sample.log loop. Keep timing stable across restyles. */
export const SAMPLE_LOG_SCENE_MS = 4200;

/** Crossfade between sample.log scenes. */
export const SAMPLE_LOG_FADE_MS = 280;
