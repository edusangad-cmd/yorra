import React, { useEffect, useState } from "react";
import { api } from "./services/api";
import type { Match, Prediction, User, LeaderboardUser } from "./services/api";

function getFlagEmoji(teamName: string): string {
  const flags: Record<string, string> = {
    Spain: "🇪🇸",
    España: "🇪🇸",
    Germany: "🇩🇪",
    Alemania: "🇩🇪",
    Brazil: "🇧🇷",
    Brasil: "🇧🇷",
    Argentina: "🇦🇷",
    France: "🇫🇷",
    Francia: "🇫🇷",
    Italy: "🇮🇹",
    Italia: "🇮🇹",
    England: "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
    Inglaterra: "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
    Portugal: "🇵🇹",
    Netherlands: "🇳🇱",
    "Países Bajos": "🇳🇱",
    Uruguay: "🇺🇾",
    Mexico: "🇲🇽",
    México: "🇲🇽",
    USA: "🇺🇸",
    "Estados Unidos": "🇺🇸",
    Canada: "🇨🇦",
    Canadá: "🇨🇦",
    Morocco: "🇲🇦",
    Marruecos: "🇲🇦",
    Croatia: "🇭🇷",
    Croacia: "🇭🇷",
    Japan: "🇯🇵",
    Japón: "🇯🇵",
    Belgium: "🇧🇪",
    Bélgica: "🇧🇪",
    Senegal: "🇸🇳",
  };
  return flags[teamName] || "⚽️";
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [predictions, setPredictions] = useState<Record<number, Prediction>>({});
  const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>([]);
  const [roast, setRoast] = useState<string>("");
  
  // UI States
  const [loginInput, setLoginInput] = useState<string>("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"matches" | "leaderboard">("matches");
  const [loading, setLoading] = useState<boolean>(() => {
    const { telegram_id } = api.getCurrentUser();
    return !!telegram_id;
  });
  
  // Form Drafts & Loaders
  const [editingScores, setEditingScores] = useState<Record<number, { home: string; away: string }>>({});
  const [actionLoading, setActionLoading] = useState<Record<number, boolean>>({});

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [matchesList, predsList] = await Promise.all([
        api.getMatches(),
        api.getPredictions(),
      ]);
      
      setMatches(matchesList);
      
      // Map predictions by match_id for easy lookup
      const predsMap: Record<number, Prediction> = {};
      predsList.forEach((p) => {
        predsMap[p.match_id] = p;
      });
      setPredictions(predsMap);

      // Initialize edit inputs with existing predictions or empty strings
      const drafts: Record<number, { home: string; away: string }> = {};
      matchesList.forEach((m) => {
        const p = predsMap[m.id];
        drafts[m.id] = {
          home: p ? String(p.home_score) : "",
          away: p ? String(p.away_score) : "",
        };
      });
      setEditingScores(drafts);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLeaderboardData = async () => {
    try {
      setLoading(true);
      const data = await api.getLeaderboard();
      setLeaderboard(data.users);
      setRoast(data.roast);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // 1. Auto-login on mount
  useEffect(() => {
    const { telegram_id } = api.getCurrentUser();
    if (telegram_id) {
      api
        .auth(telegram_id)
        .then((userData) => {
          setUser(userData);
          setTimeout(() => {
            fetchDashboardData().catch(console.error);
          }, 0);
        })
        .catch(() => {
          api.logout();
          setLoading(false);
        });
    }
  }, []);

  // 2. Fetch data depending on active tab
  useEffect(() => {
    if (!user) return;
    setTimeout(() => {
      if (activeTab === "matches") {
        fetchDashboardData().catch(console.error);
      } else {
        fetchLeaderboardData().catch(console.error);
      }
    }, 0);
  }, [activeTab, user]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginInput.trim()) return;
    setLoading(true);
    setLoginError(null);
    try {
      const userData = await api.auth(loginInput);
      setUser(userData);
      setActiveTab("matches");
    } catch (err: unknown) {
      const error = err as Error;
      setLoginError(error.message || "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    api.logout();
    setUser(null);
    setMatches([]);
    setPredictions({});
    setLeaderboard([]);
    setRoast("");
    setLoginInput("");
  };

  const handleScoreChange = (matchId: number, side: "home" | "away", value: string) => {
    // Only allow digits
    const cleaned = value.replace(/\D/g, "");
    setEditingScores((prev) => ({
      ...prev,
      [matchId]: {
        ...prev[matchId],
        [side]: cleaned,
      },
    }));
  };

  const handleSavePrediction = async (matchId: number) => {
    const draft = editingScores[matchId];
    if (!draft || draft.home === "" || draft.away === "") return;

    setActionLoading((prev) => ({ ...prev, [matchId]: true }));
    try {
      const homeScore = parseInt(draft.home, 10);
      const awayScore = parseInt(draft.away, 10);
      
      const newPred = await api.placePrediction(matchId, homeScore, awayScore);
      setPredictions((prev) => ({
        ...prev,
        [matchId]: newPred,
      }));
    } catch (err: unknown) {
      const error = err as Error;
      alert(error.message || "Error al guardar el pronóstico");
    } finally {
      setActionLoading((prev) => ({ ...prev, [matchId]: false }));
    }
  };

  // Group matches by date
  const groupMatchesByDate = (): { dateLabel: string; items: Match[] }[] => {
    const groups: Record<string, Match[]> = {};
    matches.forEach((m) => {
      const dateObj = new Date(m.date);
      const label = dateObj.toLocaleDateString("es-ES", {
        weekday: "long",
        day: "numeric",
        month: "long",
      });
      if (!groups[label]) {
        groups[label] = [];
      }
      groups[label].push(m);
    });

    return Object.entries(groups).map(([dateLabel, items]) => ({
      dateLabel,
      items,
    }));
  };

  if (loading && !user) {
    return (
      <div className="auth-wrapper">
        <div className="glass-panel auth-card">
          <span className="auth-logo">🏆</span>
          <h1>Cargando...</h1>
        </div>
      </div>
    );
  }

  // --- LOGIN VIEW ---
  if (!user) {
    return (
      <div className="auth-wrapper">
        <div className="glass-panel auth-card">
          <span className="auth-logo">🏆</span>
          <h1>Porra Mundial 2026</h1>
          <p>Introduce tu usuario o ID de Telegram para acceder a tus pronósticos</p>

          <form onSubmit={handleLogin}>
            {loginError && <div className="error-message">{loginError}</div>}
            
            <div className="input-group">
              <label className="input-label" htmlFor="usernameInput">
                Usuario o ID de Telegram
              </label>
              <input
                id="usernameInput"
                type="text"
                className="premium-input"
                placeholder="ej: @nombreusuario o 12345678"
                value={loginInput}
                onChange={(e) => setLoginInput(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="premium-button">
              Ingresar a la Porra
            </button>
          </form>
        </div>
      </div>
    );
  }

  // --- DASHBOARD VIEW ---
  return (
    <>
      {/* Header */}
      <header className="glass-panel dashboard-header">
        <div className="logo-container">
          <span className="logo-icon">🏆</span>
          <span className="logo-text">Porra Deportiva 2026</span>
        </div>
        
        <div className="user-nav-profile">
          <span className="user-score">
            👤 {user.full_name} ({user.points} pts)
          </span>
          <button onClick={handleLogout} className="logout-btn">
            Cerrar Sesión
          </button>
        </div>
      </header>

      {/* Tabs Navigation */}
      <nav className="tab-nav">
        <button
          onClick={() => setActiveTab("matches")}
          className={`tab-btn ${activeTab === "matches" ? "active" : ""}`}
        >
          Partidos y Pronósticos
        </button>
        <button
          onClick={() => setActiveTab("leaderboard")}
          className={`tab-btn ${activeTab === "leaderboard" ? "active" : ""}`}
        >
          Clasificación General
        </button>
      </nav>

      {/* Main Tab Content */}
      <main style={{ flex: 1 }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "3rem" }}>
            <h2>Cargando contenido...</h2>
          </div>
        ) : activeTab === "matches" ? (
          // --- TAB 1: MATCHES ---
          <div className="matches-grid">
            {groupMatchesByDate().length === 0 ? (
              <div style={{ textAlign: "center", padding: "2rem" }}>
                <p>No hay partidos programados en el sistema en este momento.</p>
              </div>
            ) : (
              groupMatchesByDate().map((group) => (
                <section key={group.dateLabel} className="date-section">
                  <h2 className="date-header">{group.dateLabel}</h2>
                  <div className="match-list">
                    {group.items.map((m) => {
                      const pred = predictions[m.id];
                      const draft = editingScores[m.id] || { home: "", away: "" };
                      const isSaving = actionLoading[m.id] || false;
                      
                      // Check if match already started/finished
                      const matchDateObj = new Date(m.date);
                      const isStarted = matchDateObj <= new Date();
                      const hasFinished = m.home_score !== null && m.away_score !== null;

                      // Flag elements
                      const homeFlag = getFlagEmoji(m.home_team);
                      const awayFlag = getFlagEmoji(m.away_team);

                      // Draft has modified flag
                      const isModified =
                        draft.home !== (pred ? String(pred.home_score) : "") ||
                        draft.away !== (pred ? String(pred.away_score) : "");

                      return (
                        <article key={m.id} className="glass-panel match-card">
                          {/* Match Header */}
                          <div className="match-card-header">
                            <span>🕒 {formatDate(m.date)}</span>
                            <span
                              className={`match-status ${
                                hasFinished
                                  ? "status-ft"
                                  : isStarted
                                  ? "status-live"
                                  : "status-ns"
                              }`}
                            >
                              {hasFinished
                                ? "FINALIZADO"
                                : isStarted
                                ? "EN JUEGO 🔴"
                                : "NO INICIADO"}
                            </span>
                          </div>

                          {/* Match Teams and Scores */}
                          <div className="match-card-body">
                            <div className="team">
                              <span className="team-flag">{homeFlag}</span>
                              <span className="team-name">{m.home_team}</span>
                            </div>

                            <div className="score-center">
                              {hasFinished ? (
                                <div className="real-score">
                                  {m.home_score} - {m.away_score}
                                </div>
                              ) : (
                                <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>VS</span>
                              )}

                              <div className="prediction-inputs">
                                <input
                                  type="text"
                                  className="pred-input"
                                  placeholder="-"
                                  value={draft.home}
                                  onChange={(e) => handleScoreChange(m.id, "home", e.target.value)}
                                  disabled={isStarted || hasFinished}
                                />
                                <span className="score-dash">-</span>
                                <input
                                  type="text"
                                  className="pred-input"
                                  placeholder="-"
                                  value={draft.away}
                                  onChange={(e) => handleScoreChange(m.id, "away", e.target.value)}
                                  disabled={isStarted || hasFinished}
                                />
                              </div>
                            </div>

                            <div className="team">
                              <span className="team-flag">{awayFlag}</span>
                              <span className="team-name">{m.away_team}</span>
                            </div>
                          </div>

                          {/* Match Footer / Action buttons */}
                          <div className="match-card-footer">
                            <div>
                              {hasFinished && pred ? (
                                <span
                                  className={`points-badge points-${pred.points_earned}`}
                                >
                                  {pred.points_earned === 3
                                    ? "+3 Puntos (Exacto) 🌟"
                                    : pred.points_earned === 1
                                    ? "+1 Punto (Resultado)"
                                    : "0 Puntos"}
                                </span>
                              ) : pred ? (
                                <span className="prediction-hint">
                                  Tu pronóstico: {pred.home_score} - {pred.away_score}
                                </span>
                              ) : (
                                <span className="prediction-hint" style={{ opacity: 0.6 }}>
                                  Sin pronóstico
                                </span>
                              )}
                            </div>

                            {!isStarted && !hasFinished && isModified && (
                              <button
                                onClick={() => handleSavePrediction(m.id)}
                                className="btn-save-pred"
                                disabled={
                                  isSaving || draft.home === "" || draft.away === ""
                                }
                              >
                                {isSaving ? "Guardando..." : "Guardar"}
                              </button>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>
              ))
            )}
          </div>
        ) : (
          // --- TAB 2: LEADERBOARD ---
          <div className="leaderboard-container">
            {/* Sarcastic technical roast comment */}
            {roast && (
              <div className="glass-panel roast-card">
                <span className="roast-popcorn">🍿</span>
                <div className="roast-content">
                  <h3>Comentario Técnico</h3>
                  <div className="roast-text" dangerouslySetInnerHTML={{ __html: roast }} />
                </div>
              </div>
            )}

            {/* Podium for top 3 users */}
            {leaderboard.length > 0 && (
              <div className="podium">
                {/* 2nd Place */}
                {leaderboard.length >= 2 && (
                  <div className="podium-step podium-2">
                    <div className="podium-user">
                      <div className="podium-medal">🥈</div>
                      <div className="podium-name">{leaderboard[1].full_name}</div>
                      <div className="podium-points">{leaderboard[1].points} pts</div>
                    </div>
                    <div className="podium-bar" style={{ height: "70px" }}>
                      2
                    </div>
                  </div>
                )}

                {/* 1st Place */}
                <div className="podium-step podium-1">
                  <div className="podium-user">
                    <div className="podium-medal">🥇</div>
                    <div className="podium-name">{leaderboard[0].full_name}</div>
                    <div className="podium-points">{leaderboard[0].points} pts</div>
                  </div>
                  <div className="podium-bar" style={{ height: "100px" }}>
                    1
                  </div>
                </div>

                {/* 3rd Place */}
                {leaderboard.length >= 3 && (
                  <div className="podium-step podium-3">
                    <div className="podium-user">
                      <div className="podium-medal">🥉</div>
                      <div className="podium-name">{leaderboard[2].full_name}</div>
                      <div className="podium-points">{leaderboard[2].points} pts</div>
                    </div>
                    <div className="podium-bar" style={{ height: "50px" }}>
                      3
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Classification List Table */}
            <div className="glass-panel table-wrapper">
              <table className="leaderboard-table">
                <thead>
                  <tr>
                    <th className="rank-cell">Pos</th>
                    <th>Participante</th>
                    <th className="points-cell">Puntos</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((u, index) => {
                    const isSelf = u.telegram_id === user.telegram_id;
                    return (
                      <tr key={u.id} className={isSelf ? "current-user" : ""}>
                        <td className="rank-cell">#{index + 1}</td>
                        <td>
                          {u.full_name}
                          {u.username && (
                            <span className="username-tag">@{u.username}</span>
                          )}
                        </td>
                        <td className="points-cell">{u.points} pts</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </>
  );
}

export default App;
