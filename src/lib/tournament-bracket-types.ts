export interface TournamentFighter {
  id?: string;
  name: string;
  dojo?: string;
  photo?: string | null;
  score?: number;
  isBye?: boolean;
}

export interface TournamentMatch {
  id: string;
  number: number;
  title?: string;
  roundName: string;
  aka: TournamentFighter | null;
  ao: TournamentFighter | null;
  winner: "aka" | "ao" | null;
  status?: "PENDING" | "LIVE" | "COMPLETED";
  details?: {
    akaSenshu?: boolean;
    aoSenshu?: boolean;
    akaPenalties?: number;
    aoPenalties?: number;
    timeline?: Array<{
      time: string;
      type: "point" | "penalty" | "senshu";
      corner: "aka" | "ao";
      points?: string | number;
      detail?: string;
    }>;
  };
}

export interface TournamentPool {
  id: string;
  name: string;
  tatami: number;
  participantCount: number;
  bracketSize: number;
  rounds: TournamentMatch[][];
  roster: TournamentFighter[];
  champion?: TournamentFighter | null;
}

export interface ChampionshipFinal {
  id: string;
  name: string;
  matches: TournamentMatch[];
}

export interface TournamentState {
  category: string;
  activePoolId: string;
  pools: Record<string, TournamentPool>;
  championshipFinal: ChampionshipFinal;
}

export interface ScoreboardState {
  tatami: number;
  category: string;
  matchTitle: string;
  roundName: string;
  currentMatchId?: string | null;
  mode: "kumite" | "kata";
  // Fighters
  aka: {
    name: string;
    dojo: string;
    photo?: string | null;
    score: number;
    senshu: boolean;
    penalties: number; // 0 to 5 (C1..C4, Hansoku)
  };
  ao: {
    name: string;
    dojo: string;
    photo?: string | null;
    score: number;
    senshu: boolean;
    penalties: number;
  };
  // Timer
  timerRemainingMs: number;
  timerDurationSec: number;
  isTimerRunning: boolean;
  // Layout
  isLayoutSwapped: boolean; // default false: AO left (Blue), AKA right (Red)
  winner?: {
    corner: "aka" | "ao";
    name: string;
    dojo: string;
    scoreAka: number;
    scoreAo: number;
    title: string;
  } | null;
}

