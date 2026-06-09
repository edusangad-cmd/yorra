const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export interface User {
  id: number;
  telegram_id: string;
  username: string | null;
  full_name: string;
  points: number;
}

export interface Match {
  id: number;
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
  status: string;
  date: string;
  group?: string | null;
  stage?: string | null;
}

export interface Prediction {
  id: number;
  match_id: number;
  home_score: number;
  away_score: number;
  points_earned: number;
}

export interface TournamentPrediction {
  champion: string | null;
  runner_up: string | null;
  top_scorer: string | null;
  surprise_team: string | null;
}

export interface LeaderboardUser {
  id: number;
  telegram_id: string;
  full_name: string;
  username: string | null;
  points: number;
}

export interface LeaderboardResponse {
  users: LeaderboardUser[];
  roast: string;
}

function getHeaders(): HeadersInit {
  const telegramId = localStorage.getItem("telegram_id");
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };
  if (telegramId) {
    headers["X-Telegram-Id"] = telegramId;
  }
  return headers;
}

export const api = {
  async auth(usernameOrId: string): Promise<User> {
    const res = await fetch(`${API_URL}/api/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username_or_id: usernameOrId }),
    });
    if (!res.ok) {
      const errorData = (await res.json().catch(() => ({}))) as { detail?: string };
      throw new Error(errorData.detail || "Error al iniciar sesión");
    }
    const user = (await res.json()) as User;
    localStorage.setItem("telegram_id", user.telegram_id);
    localStorage.setItem("user_name", user.full_name);
    return user;
  },

  async register(username: string, fullName: string): Promise<User> {
    const res = await fetch(`${API_URL}/api/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, full_name: fullName }),
    });
    if (!res.ok) {
      const errorData = (await res.json().catch(() => ({}))) as { detail?: string };
      throw new Error(errorData.detail || "Error al registrar usuario");
    }
    const user = (await res.json()) as User;
    localStorage.setItem("telegram_id", user.telegram_id);
    localStorage.setItem("user_name", user.full_name);
    return user;
  },

  logout(): void {
    localStorage.removeItem("telegram_id");
    localStorage.removeItem("user_name");
  },

  getCurrentUser(): { telegram_id: string | null; full_name: string | null } {
    return {
      telegram_id: localStorage.getItem("telegram_id"),
      full_name: localStorage.getItem("user_name"),
    };
  },

  async getMatches(): Promise<Match[]> {
    const res = await fetch(`${API_URL}/api/matches`, {
      headers: getHeaders(),
    });
    if (!res.ok) {
      throw new Error("Error al obtener partidos");
    }
    return (await res.json()) as Match[];
  },

  async getPredictions(): Promise<Prediction[]> {
    const res = await fetch(`${API_URL}/api/predictions`, {
      headers: getHeaders(),
    });
    if (!res.ok) {
      throw new Error("Error al obtener pronósticos");
    }
    return (await res.json()) as Prediction[];
  },

  async placePrediction(
    matchId: number,
    homeScore: number,
    awayScore: number
  ): Promise<Prediction> {
    const res = await fetch(`${API_URL}/api/predictions`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        match_id: matchId,
        home_score: homeScore,
        away_score: awayScore,
      }),
    });
    if (!res.ok) {
      const errorData = (await res.json().catch(() => ({}))) as { detail?: string };
      throw new Error(errorData.detail || "Error al guardar pronóstico");
    }
    return (await res.json()) as Prediction;
  },

  async getLeaderboard(): Promise<LeaderboardResponse> {
    const res = await fetch(`${API_URL}/api/leaderboard`, {
      headers: getHeaders(),
    });
    if (!res.ok) {
      throw new Error("Error al obtener la clasificación");
    }
    return (await res.json()) as LeaderboardResponse;
  },

  async getTournamentPredictions(): Promise<TournamentPrediction> {
    const res = await fetch(`${API_URL}/api/tournament-predictions`, {
      headers: getHeaders(),
    });
    if (!res.ok) {
      throw new Error("Error al obtener apuestas especiales");
    }
    return (await res.json()) as TournamentPrediction;
  },

  async saveTournamentPredictions(preds: TournamentPrediction): Promise<TournamentPrediction> {
    const res = await fetch(`${API_URL}/api/tournament-predictions`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(preds),
    });
    if (!res.ok) {
      const errorData = (await res.json().catch(() => ({}))) as { detail?: string };
      throw new Error(errorData.detail || "Error al guardar apuestas especiales");
    }
    return (await res.json()) as TournamentPrediction;
  },

  async simulateRealScores(): Promise<{ message: string; success: boolean }> {
    const res = await fetch(`${API_URL}/api/debug/simulate-real-scores`, {
      method: "POST",
      headers: getHeaders(),
    });
    if (!res.ok) {
      throw new Error("Error al simular resultados reales");
    }
    return (await res.json()) as { message: string; success: boolean };
  },
};

