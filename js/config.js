export const CONFIG = {
  // === GAME ===
  GAME_DURATION_SEC: 60,
  TICK_INTERVAL_MS: 500,        // game updates every 500ms

  // === PRICE PROCESS ===
  INITIAL_PRICE: 100.00,
  MU: 0.00,                     // drift (0 = no trend, fair game)
  SIGMA: 0.02,                  // per-tick volatility (NOT annualized)
  // Note: if friend gives annualized σ_annual, convert:
  // σ_tick = σ_annual / sqrt(252 * 6.5 * 3600 / (TICK_INTERVAL_MS/1000))

  // === JUMP PROCESS (Phase 2, set to 0 for MVP) ===
  JUMP_INTENSITY: 0.0,          // jumps per tick (Poisson λ)
  JUMP_MEAN: 0.0,               // mean jump size
  JUMP_STD: 0.0,                // jump size std

  // === ORDER FLOW ===
  ARRIVAL_RATE: 0.4,            // probability of a trader arriving per tick
  ORDER_SIZE_MIN: 10,
  ORDER_SIZE_MAX: 50,
  INFORMED_RATIO: 0.0,          // fraction of traders that are informed (0 for MVP)

  // === INFORMED TRADER SPEC (Phase 2) ===
  INFORMED_LOOKAHEAD_TICKS: 3,  // how many ticks ahead they "see"
  INFORMED_THRESHOLD: 0.005,    // min price change to trigger informed trade
  INFORMED_AGGRESSION: 1.0,     // 1.0 = always trade when they see edge

  // === PLAYER DEFAULTS ===
  INITIAL_CASH: 0,
  INITIAL_INVENTORY: 0,
  DEFAULT_SPREAD: 0.50,         // starting half-spread from mid
  SPREAD_STEP: 0.05,            // how much +/- buttons change the spread
  SKEW_STEP: 0.05,              // how much skew buttons shift quotes
  MAX_INVENTORY: 200,           // absolute inventory cap (auto-pull quotes)

  // === AVELLANEDA-STOIKOV (Phase 2) ===
  AS_GAMMA: 0.1,                // risk aversion parameter
  AS_KAPPA: 1.5,                // order flow intensity parameter

  // === SCORING ===
  INVENTORY_PENALTY_LAMBDA: 0.5, // penalty weight on final inventory

  // === UI ===
  CHART_MAX_POINTS: 120,        // max data points on price chart
  ORDERFLOW_MAX_LINES: 20,      // max lines in order flow feed
};
