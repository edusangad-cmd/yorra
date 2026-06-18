import React, { useEffect, useState, useMemo } from "react";
import { api } from "./services/api";
import type { Match, Prediction, User, LeaderboardUser, TournamentPrediction, DailySummary } from "./services/api";
import { ALL_FORWARDS, ALL_GOALKEEPERS } from "./data/players";
import { THIRD_PLACE_COMBINATIONS } from "./services/thirdPlaceCombinations";

const ALL_TEAMS_ES = [
  "Alemania", "Arabia Saudí", "Argelia", "Argentina", "Australia", "Austria", "Bélgica", 
  "Bosnia y Herzegovina", "Brasil", "Cabo Verde", "Canadá", "Catar", "Colombia", 
  "Corea del Sur", "Costa de Marfil", "Croacia", "Curazao", "Ecuador", "Egipto", "Escocia", 
  "España", "Estados Unidos", "Francia", "Ghana", "Haití", "Inglaterra", "Irán", "Irak", 
  "Japón", "Jordania", "Marruecos", "México", "Noruega", "Nueva Zelanda", "Países Bajos", 
  "Panamá", "Paraguay", "Portugal", "República Checa", "República Democrática del Congo", 
  "Senegal", "Sudáfrica", "Suecia", "Suiza", "Túnez", "Turquía", "Uruguay", "Uzbekistán"
].sort();



function isTeamPlaceholder(teamName: string): boolean {
  if (!teamName) return true;
  return (
    teamName.includes("Grupo") ||
    teamName.includes("Partido") ||
    teamName.includes("º") ||
    teamName.startsWith("Ganador") ||
    teamName.startsWith("Perdedor") ||
    teamName.startsWith("Winner") ||
    teamName.startsWith("Runner-up") ||
    teamName.startsWith("Loser")
  );
}

function getFlagEmoji(teamName: string): string {
  if (!teamName) return "⚽️";
  const flags: Record<string, string> = {
    // English/Universal Names
    Germany: "🇩🇪", "Saudi Arabia": "🇸🇦", Algeria: "🇩🇿", Argentina: "🇦🇷", Australia: "🇦🇺",
    Austria: "🇦🇹", Belgium: "🇧🇪", "Bosnia and Herzegovina": "🇧🇦", Brazil: "🇧🇷", "Cape Verde": "🇨🇻",
    "Cabo Verde": "🇨🇻", Canada: "🇨🇦", Qatar: "🇶🇦", Czechia: "🇨🇿", Czech: "🇨🇿", "Czech Republic": "🇨🇿",
    Colombia: "🇨🇴", "South Korea": "🇰🇷", "Ivory Coast": "🇨🇮", Croatia: "🇭🇷", "Curaçao": "🇨🇼",
    Ecuador: "🇪🇨", Egypt: "🇪🇬", Scotland: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", Spain: "🇪🇸", "United States": "🇺🇸", USA: "🇺🇸",
    France: "🇫🇷", Ghana: "🇬🇭", Haiti: "🇭🇹", England: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", Iran: "🇮🇷", Iraq: "🇮🇶", Italy: "🇮🇹",
    Japan: "🇯🇵", Jordan: "🇯🇴", Morocco: "🇲🇦", Mexico: "🇲🇽", Norway: "🇳🇴", "New Zealand": "🇳🇿",
    Netherlands: "🇳🇱", Panama: "🇵🇦", Paraguay: "🇵🇾", Portugal: "🇵🇹", "DR Congo": "🇨🇩",
    "Democratic Republic of the Congo": "🇨🇩", Senegal: "🇸🇳", "South Africa": "🇿🇦", Sweden: "🇸🇪",
    Switzerland: "🇨🇭", Tunisia: "🇹🇳", Turkey: "🇹🇷", Uruguay: "🇺🇾", Uzbekistan: "🇺🇿",
    
    // Spanish Names (translated differently)
    "Alemania": "🇩🇪", "Arabia Saudí": "🇸🇦", "Argelia": "🇩🇿", "Bélgica": "🇧🇪",
    "Bosnia y Herzegovina": "🇧🇦", "Brasil": "🇧🇷", "Canadá": "🇨🇦", "Catar": "🇶🇦",
    "Chequia": "🇨🇿", "República Checa": "🇨🇿", "Corea del Sur": "🇰🇷", "Costa de Marfil": "🇨🇮",
    "Croacia": "🇭🇷", "Curazao": "🇨🇼", "Egipto": "🇪🇬", "Escocia": "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
    "España": "🇪🇸", "Estados Unidos": "🇺🇸", "Francia": "🇫🇷", "Haití": "🇭🇹",
    "Inglaterra": "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "Irán": "🇮🇷", "Irak": "🇮🇶", "Italia": "🇮🇹", "Japón": "🇯🇵",
    "Jordania": "🇯🇴", "Marruecos": "🇲🇦", "México": "🇲🇽", "Noruega": "🇳🇴",
    "Nueva Zelanda": "🇳🇿", "Países Bajos": "🇳🇱", "Panamá": "🇵🇦",
    "República Democrática del Congo": "🇨🇩", "Sudáfrica": "🇿🇦", "Suecia": "🇸🇪",
    "Suiza": "🇨🇭", "Túnez": "🇹🇳", "Turquía": "🇹🇷", "Uzbekistán": "🇺🇿"
  };
  return flags[teamName] || "⚽️";
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString("es-ES", {
    timeZone: "Europe/Madrid",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface TeamStanding {
  team: string;
  points: number;
  played: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [predictions, setPredictions] = useState<Record<number, Prediction>>({});
  const [tournamentPredictions, setTournamentPredictions] = useState<TournamentPrediction>({
    champion: null,
    runner_up: null,
    top_scorer: null,
    best_goalkeeper: null,
    surprise_team: null,
  });
  const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>([]);
  const [roast, setRoast] = useState<string>("");

  // Daily summaries states
  const [dailySummaries, setDailySummaries] = useState<DailySummary[]>([]);
  const [loadingSummaries, setLoadingSummaries] = useState<boolean>(false);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState<boolean>(false);
  const [summaryDateInput, setSummaryDateInput] = useState<string>(() => {
    const today = new Date();
    // Use Europe/Madrid time or local date
    const offset = today.getTimezoneOffset();
    const localToday = new Date(today.getTime() - (offset * 60 * 1000));
    return localToday.toISOString().split("T")[0];
  });


  // UI States
  const [loginInput, setLoginInput] = useState<string>("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState<boolean>(false);
  const [registerFullName, setRegisterFullName] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"matches" | "bracket" | "standings" | "sidebets" | "leaderboard" | "rules">("matches");
  
  const [loading, setLoading] = useState<boolean>(() => {
    const { telegram_id } = api.getCurrentUser();
    return !!telegram_id;
  });

  const [savingTournament, setSavingTournament] = useState<boolean>(false);
  const [isSimulatingAll, setIsSimulatingAll] = useState<boolean>(false);

  // Form Drafts & Loaders
  const [editingScores, setEditingScores] = useState<Record<number, { home: string; away: string }>>({});
  const [editingPenaltyWinners, setEditingPenaltyWinners] = useState<Record<number, boolean>>({});
  const [actionLoading, setActionLoading] = useState<Record<number, boolean>>({});

  // Viewing other user's dashboard state
  const [viewingUser, setViewingUser] = useState<LeaderboardUser | null>(null);
  const [viewedUserPredictions, setViewedUserPredictions] = useState<Record<number, Prediction>>({});
  const [viewedUserTournament, setViewedUserTournament] = useState<TournamentPrediction>({
    champion: null,
    runner_up: null,
    top_scorer: null,
    best_goalkeeper: null,
    surprise_team: null,
  });
  const [viewedUserLoading, setViewedUserLoading] = useState<boolean>(false);
  const [viewedUserError, setViewedUserError] = useState<string | null>(null);

  const handleViewUserDashboard = async (u: LeaderboardUser) => {
    setViewingUser(u);
    setViewedUserLoading(true);
    setViewedUserError(null);
    setActiveTab("matches");
    try {
      const res = await api.getUserPredictions(u.id);
      const predsRecord: Record<number, Prediction> = {};
      res.predictions.forEach((p) => {
        predsRecord[p.match_id] = p;
      });
      setViewedUserPredictions(predsRecord);
      if (res.tournament_prediction) {
        setViewedUserTournament(res.tournament_prediction);
      } else {
        setViewedUserTournament({
          champion: null,
          runner_up: null,
          top_scorer: null,
          best_goalkeeper: null,
          surprise_team: null,
        });
      }
    } catch (err: unknown) {
      const error = err as Error;
      setViewedUserError(error.message || "Error al cargar los pronósticos del usuario");
    } finally {
      setViewedUserLoading(false);
    }
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      const currentUser = api.getCurrentUser();
      if (currentUser && currentUser.telegram_id) {
        api.auth(currentUser.telegram_id).then(setUser).catch(console.error);
      }

      const [matchesList, predsList, tourPreds] = await Promise.all([
        api.getMatches(),
        api.getPredictions(),
        api.getTournamentPredictions().catch(() => ({
          champion: null,
          runner_up: null,
          top_scorer: null,
          best_goalkeeper: null,
          surprise_team: null,
        })),
      ]);

      setMatches(matchesList);
      setTournamentPredictions(tourPreds);

      const predsMap: Record<number, Prediction> = {};
      predsList.forEach((p) => {
        predsMap[p.match_id] = p;
      });
      setPredictions(predsMap);

      const drafts: Record<number, { home: string; away: string }> = {};
      const draftPenalties: Record<number, boolean> = {};
      matchesList.forEach((m) => {
        const p = predsMap[m.id];
        drafts[m.id] = {
          home: p ? String(p.home_score) : "",
          away: p ? String(p.away_score) : "",
        };
        if (p && p.penalty_winner_home !== null && p.penalty_winner_home !== undefined) {
          draftPenalties[m.id] = p.penalty_winner_home;
        }
      });
      setEditingScores(drafts);
      setEditingPenaltyWinners(draftPenalties);
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

  const fetchDailySummariesData = async () => {
    try {
      setLoadingSummaries(true);
      const data = await api.getDailySummaries();
      setDailySummaries(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingSummaries(false);
    }
  };

  const handleGenerateDailySummary = async () => {
    if (!summaryDateInput) return;
    try {
      setIsGeneratingSummary(true);
      await api.generateDailySummary(summaryDateInput);
      await fetchDailySummariesData();
    } catch (err: unknown) {
      const error = err as Error;
      console.error(error);
      alert(error.message || "Error al generar el resumen diario.");
    } finally {
      setIsGeneratingSummary(false);
    }
  };


  useEffect(() => {
    const { telegram_id } = api.getCurrentUser();
    if (telegram_id) {
      api
        .auth(telegram_id)
        .then((userData) => {
          setUser(userData);
          fetchDashboardData().catch(console.error);
        })
        .catch(() => {
          api.logout();
          setLoading(false);
        });
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    if (activeTab === "leaderboard") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchLeaderboardData().catch(console.error);
      fetchDailySummariesData().catch(console.error);
    } else {
      fetchDashboardData().catch(console.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);


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

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginInput.trim() || !registerFullName.trim()) return;
    setLoading(true);
    setLoginError(null);
    try {
      const userData = await api.register(loginInput, registerFullName);
      setUser(userData);
      setActiveTab("matches");
    } catch (err: unknown) {
      const error = err as Error;
      setLoginError(error.message || "Error al registrar usuario");
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
      let penaltyWinnerHome: boolean | null = null;
      if (homeScore === awayScore) {
        penaltyWinnerHome = editingPenaltyWinners[matchId] ?? true;
      }

      const newPred = await api.placePrediction(matchId, homeScore, awayScore, penaltyWinnerHome);
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

  const handleSaveAllDrafts = async () => {
    const modifiedMatchIds = matches.filter((m) => {
      const matchDateObj = new Date(m.date);
      const isStarted = matchDateObj <= new Date();
      const hasFinished = m.status === "FT";
      if (isStarted || hasFinished) return false;

      const draft = editingScores[m.id];
      const pred = predictions[m.id];
      if (!draft || draft.home === "" || draft.away === "") return false;

      const scoreChanged =
        draft.home !== (pred ? String(pred.home_score) : "") ||
        draft.away !== (pred ? String(pred.away_score) : "");

      const penaltyWinnerChanged =
        (editingPenaltyWinners[m.id] !== undefined ? editingPenaltyWinners[m.id] : null) !==
        (pred && pred.penalty_winner_home !== undefined ? pred.penalty_winner_home : null);

      return scoreChanged || penaltyWinnerChanged;
    }).map((m) => m.id);

    if (modifiedMatchIds.length === 0) {
      alert("No tienes ningún pronóstico modificado pendiente de guardar.");
      return;
    }

    setLoading(true);
    let successCount = 0;
    for (const matchId of modifiedMatchIds) {
      try {
        const draft = editingScores[matchId];
        const homeScore = parseInt(draft.home, 10);
        const awayScore = parseInt(draft.away, 10);
        let penaltyWinnerHome: boolean | null = null;
        if (homeScore === awayScore) {
          penaltyWinnerHome = editingPenaltyWinners[matchId] ?? true;
        }
        await api.placePrediction(matchId, homeScore, awayScore, penaltyWinnerHome);
        successCount++;
      } catch (err) {
        console.error(`Error saving match ${matchId}:`, err);
      }
    }
    await fetchDashboardData();
    alert(`Se guardaron exitosamente ${successCount} pronósticos.`);
  };

  const handleSaveTournamentPredictions = async () => {
    setSavingTournament(true);
    try {
      await api.saveTournamentPredictions(tournamentPredictions);
      alert("¡Apuestas especiales del torneo guardadas con éxito!");
    } catch (err: unknown) {
      const error = err as Error;
      alert(error.message || "Error al guardar apuestas especiales");
    } finally {
      setSavingTournament(false);
    }
  };

  // Simulators
  const handleSimulateMyPredictions = () => {
    const newEditing = { ...editingScores };
    let count = 0;
    matches.forEach((m) => {
      const matchDateObj = new Date(m.date);
      const isStarted = matchDateObj <= new Date();
      const hasFinished = m.status === "FT";

      if (!isStarted && !hasFinished) {
        const randomHome = String(Math.floor(Math.random() * 4));
        const randomAway = String(Math.floor(Math.random() * 4));
        newEditing[m.id] = { home: randomHome, away: randomAway };
        count++;
      }
    });
    setEditingScores(newEditing);
    alert(`Fórmulas de pronósticos simuladas localmente para ${count} partidos. ¡Pulsa el botón "Guardar Todo" arriba a la derecha para registrarlos en el servidor!`);
  };

  const handleSimulateRealScores = async () => {
    if (!window.confirm("¿Seguro que quieres simular resultados reales oficiales de forma aleatoria para todos los partidos? Esto recalculará todos los puntos.")) return;
    setIsSimulatingAll(true);
    try {
      const data = await api.simulateRealScores();
      alert(data.message);
      await fetchDashboardData();
    } catch (err: unknown) {
      const error = err as Error;
      alert(error.message || "Error al simular resultados");
    } finally {
      setIsSimulatingAll(false);
    }
  };

  const handleResetMyPredictions = async () => {
    if (!window.confirm("¿Seguro que quieres borrar todos tus pronósticos? Esta acción no se puede deshacer.")) return;
    setIsSimulatingAll(true);
    try {
      const data = await api.resetPredictions();
      alert(data.message);
      setEditingScores({});
      setEditingPenaltyWinners({});
      setTournamentPredictions({
        champion: null,
        runner_up: null,
        top_scorer: null,
        best_goalkeeper: null,
        surprise_team: null,
      });
      await fetchDashboardData();
    } catch (err: unknown) {
      const error = err as Error;
      alert(error.message || "Error al resetear tus pronósticos");
    } finally {
      setIsSimulatingAll(false);
    }
  };

  const handleResetRealScores = async () => {
    if (!window.confirm("¿Seguro que quieres resetear los resultados reales oficiales a un estado sin empezar? Esto restablecerá todos los puntos.")) return;
    setIsSimulatingAll(true);
    try {
      const data = await api.resetRealScores();
      alert(data.message);
      await fetchDashboardData();
    } catch (err: unknown) {
      const error = err as Error;
      alert(error.message || "Error al resetear resultados reales");
    } finally {
      setIsSimulatingAll(false);
    }
  };

  // Standings & Bracket Calculations
  const { standings, resolvedBracket, predictedStandings, predictedResolvedBracket } = useMemo(() => {
    const activePredictions = viewingUser ? viewedUserPredictions : predictions;

    // 1. Calculate Group Standings
    const groupStandings: Record<string, Record<string, TeamStanding>> = {};
    const predictedGroupStandings: Record<string, Record<string, TeamStanding>> = {};

    matches.forEach((m) => {
      if (m.stage === "group" && m.group) {
        const g = m.group;
        if (!groupStandings[g]) {
          groupStandings[g] = {};
        }
        if (!groupStandings[g][m.home_team]) {
          groupStandings[g][m.home_team] = { team: m.home_team, points: 0, played: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0 };
        }
        if (!groupStandings[g][m.away_team]) {
          groupStandings[g][m.away_team] = { team: m.away_team, points: 0, played: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0 };
        }

        if (!predictedGroupStandings[g]) {
          predictedGroupStandings[g] = {};
        }
        if (!predictedGroupStandings[g][m.home_team]) {
          predictedGroupStandings[g][m.home_team] = { team: m.home_team, points: 0, played: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0 };
        }
        if (!predictedGroupStandings[g][m.away_team]) {
          predictedGroupStandings[g][m.away_team] = { team: m.away_team, points: 0, played: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0 };
        }
      }
    });

    matches.forEach((m) => {
      if (m.stage === "group" && m.group) {
        const g = m.group;
        
        // A. Display/Hybrid Standings
        let homeGoals: number | null = null;
        let awayGoals: number | null = null;

        const pred = activePredictions[m.id];
        const draft = viewingUser ? null : editingScores[m.id];
        if (m.status === "FT" && m.home_score !== null && m.away_score !== null) {
          homeGoals = m.home_score;
          awayGoals = m.away_score;
        } else if (draft && draft.home !== "" && draft.away !== "") {
          homeGoals = parseInt(draft.home, 10);
          awayGoals = parseInt(draft.away, 10);
        } else if (pred) {
          homeGoals = pred.home_score;
          awayGoals = pred.away_score;
        }

        if (homeGoals !== null && awayGoals !== null) {
          const home = groupStandings[g][m.home_team];
          const away = groupStandings[g][m.away_team];

          home.played += 1;
          away.played += 1;
          home.goalsFor += homeGoals;
          home.goalsAgainst += awayGoals;
          away.goalsFor += awayGoals;
          away.goalsAgainst += homeGoals;

          home.goalDiff = home.goalsFor - home.goalsAgainst;
          away.goalDiff = away.goalsFor - away.goalsAgainst;

          if (homeGoals > awayGoals) {
            home.points += 3;
          } else if (homeGoals < awayGoals) {
            away.points += 3;
          } else {
            home.points += 1;
            away.points += 1;
          }
        }

        // B. 100% Predicted Standings
        let predHomeGoals: number | null = null;
        let predAwayGoals: number | null = null;
        if (draft && draft.home !== "" && draft.away !== "") {
          predHomeGoals = parseInt(draft.home, 10);
          predAwayGoals = parseInt(draft.away, 10);
        } else if (pred) {
          predHomeGoals = pred.home_score;
          predAwayGoals = pred.away_score;
        }

        if (predHomeGoals !== null && predAwayGoals !== null) {
          const home = predictedGroupStandings[g][m.home_team];
          const away = predictedGroupStandings[g][m.away_team];

          home.played += 1;
          away.played += 1;
          home.goalsFor += predHomeGoals;
          home.goalsAgainst += predAwayGoals;
          away.goalsFor += predAwayGoals;
          away.goalsAgainst += predHomeGoals;

          home.goalDiff = home.goalsFor - home.goalsAgainst;
          away.goalDiff = away.goalsFor - away.goalsAgainst;

          if (predHomeGoals > predAwayGoals) {
            home.points += 3;
          } else if (predHomeGoals < predAwayGoals) {
            away.points += 3;
          } else {
            home.points += 1;
            away.points += 1;
          }
        }
      }
    });

    const sortedStandings: Record<string, TeamStanding[]> = {};
    Object.keys(groupStandings).forEach((g) => {
      sortedStandings[g] = Object.values(groupStandings[g]).sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
        if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
        return a.team.localeCompare(b.team);
      });
    });

    const sortedPredictedStandings: Record<string, TeamStanding[]> = {};
    Object.keys(predictedGroupStandings).forEach((g) => {
      sortedPredictedStandings[g] = Object.values(predictedGroupStandings[g]).sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
        if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
        return a.team.localeCompare(b.team);
      });
    });

    // Check which groups are fully filled (all 6 matches have real score, prediction, or draft)
    const resolvedGroups = new Set<string>();
    const allGroups = new Set(matches.filter(m => m.stage === "group" && m.group).map(m => m.group as string));

    allGroups.forEach((g) => {
      const groupMatches = matches.filter(m => m.stage === "group" && m.group === g);
      const isFilled = groupMatches.every((m) => {
        const hasReal = m.status === "FT" && m.home_score !== null && m.away_score !== null;
        const hasPred = predictions[m.id] !== undefined;
        const hasDraft = editingScores[m.id] && editingScores[m.id].home !== "" && editingScores[m.id].away !== "";
        return hasReal || hasPred || hasDraft;
      });
      if (isFilled) {
        resolvedGroups.add(g);
      }
    });

    // 2. Resolve Bracket
    const group1st: Record<string, string> = {};
    const group2nd: Record<string, string> = {};
    const group3rdList: { group: string; team: string; points: number; goalDiff: number; goalsFor: number }[] = [];

    Object.entries(sortedStandings).forEach(([g, list]) => {
      if (resolvedGroups.has(g)) {
        if (list[0]) group1st[g] = list[0].team;
        if (list[1]) group2nd[g] = list[1].team;
        if (list[2]) {
          group3rdList.push({
            group: g,
            team: list[2].team,
            points: list[2].points,
            goalDiff: list[2].goalDiff,
            goalsFor: list[2].goalsFor,
          });
        }
      } else {
        group1st[g] = `1º Grupo ${g}`;
        group2nd[g] = `2º Grupo ${g}`;
      }
    });

    const sorted3rd = [...group3rdList].sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
      if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
      return a.group.localeCompare(b.group);
    });

    const allGroupsResolved = resolvedGroups.size === allGroups.size;
    const resolved: Record<number, { home: string; away: string }> = {};

    matches.forEach((m) => {
      if (m.stage === "group") {
        resolved[m.id] = { home: m.home_team, away: m.away_team };
      }
    });

    const getWinner = (matchId: number): string => {
      const m = matches.find((x) => x.id === matchId);
      if (!m) return `Ganador Partido ${matchId}`;

      if (m.status === "FT" && m.home_score !== null && m.away_score !== null) {
        if (m.home_score > m.away_score) return m.home_team;
        if (m.home_score < m.away_score) return m.away_team;
        return m.home_team;
      }

      const draft = viewingUser ? null : editingScores[matchId];
      const draftPenaltyWinnerHome = viewingUser ? undefined : editingPenaltyWinners[matchId];
      const pred = activePredictions[matchId];

      if (draft && draft.home !== "" && draft.away !== "") {
        const h = parseInt(draft.home, 10);
        const a = parseInt(draft.away, 10);
        if (h > a) return resolved[matchId]?.home || m.home_team;
        if (h < a) return resolved[matchId]?.away || m.away_team;
        
        // It's a draw in draft, check draft penalty winner
        if (draftPenaltyWinnerHome !== undefined) {
          return draftPenaltyWinnerHome
            ? (resolved[matchId]?.home || m.home_team)
            : (resolved[matchId]?.away || m.away_team);
        }
        // Fallback to home team if not chosen yet
        return resolved[matchId]?.home || m.home_team;
      }

      if (pred) {
        if (pred.home_score > pred.away_score) {
          return resolved[matchId]?.home || m.home_team;
        }
        if (pred.home_score < pred.away_score) {
          return resolved[matchId]?.away || m.away_team;
        }
        // Check stored penalty winner
        if (pred.penalty_winner_home !== null && pred.penalty_winner_home !== undefined) {
          return pred.penalty_winner_home
            ? (resolved[matchId]?.home || m.home_team)
            : (resolved[matchId]?.away || m.away_team);
        }
        return resolved[matchId]?.home || m.home_team;
      }
      return `Ganador Partido ${matchId}`;
    };

    const getLoser = (matchId: number): string => {
      const m = matches.find((x) => x.id === matchId);
      if (!m) return `Perdedor Partido ${matchId}`;

      if (m.status === "FT" && m.home_score !== null && m.away_score !== null) {
        if (m.home_score > m.away_score) return m.away_team;
        if (m.home_score < m.away_score) return m.home_team;
        return m.away_team;
      }

      const draft = viewingUser ? null : editingScores[matchId];
      const draftPenaltyWinnerHome = viewingUser ? undefined : editingPenaltyWinners[matchId];
      const pred = activePredictions[matchId];

      if (draft && draft.home !== "" && draft.away !== "") {
        const h = parseInt(draft.home, 10);
        const a = parseInt(draft.away, 10);
        if (h > a) return resolved[matchId]?.away || m.away_team;
        if (h < a) return resolved[matchId]?.home || m.home_team;
        
        // It's a draw in draft, check draft penalty winner
        if (draftPenaltyWinnerHome !== undefined) {
          return draftPenaltyWinnerHome
            ? (resolved[matchId]?.away || m.away_team)
            : (resolved[matchId]?.home || m.home_team);
        }
        // Fallback to away team if not chosen yet
        return resolved[matchId]?.away || m.away_team;
      }

      if (pred) {
        if (pred.home_score > pred.away_score) {
          return resolved[matchId]?.away || m.away_team;
        }
        if (pred.home_score < pred.away_score) {
          return resolved[matchId]?.home || m.home_team;
        }
        // Check stored penalty winner
        if (pred.penalty_winner_home !== null && pred.penalty_winner_home !== undefined) {
          return pred.penalty_winner_home
            ? (resolved[matchId]?.away || m.away_team)
            : (resolved[matchId]?.home || m.home_team);
        }
        return resolved[matchId]?.away || m.away_team;
      }
      return `Perdedor Partido ${matchId}`;
    };

    const opponents3rd: Record<string, string> = {};
    if (allGroupsResolved) {
      const qualifiedGroups = sorted3rd.slice(0, 8).map((x) => x.group);
      const combKey = [...qualifiedGroups].sort().join("");
      const combMap = THIRD_PLACE_COMBINATIONS[combKey];
      if (combMap) {
        const thirdTeams: Record<string, string> = {};
        sorted3rd.forEach((item) => {
          thirdTeams[item.group] = item.team;
        });
        const winners = ["1A", "1B", "1D", "1E", "1G", "1I", "1K", "1L"];
        winners.forEach((winner) => {
          const target3rdGroup = combMap[winner]?.[1]; // E.g. "F" from "3F"
          if (target3rdGroup && thirdTeams[target3rdGroup]) {
            opponents3rd[winner] = thirdTeams[target3rdGroup];
          }
        });
      }
    }

    // Fallbacks
    if (!opponents3rd["1E"]) opponents3rd["1E"] = "3º Grupo A/B/C/D/F";
    if (!opponents3rd["1I"]) opponents3rd["1I"] = "3º Grupo C/D/F/G/H";
    if (!opponents3rd["1A"]) opponents3rd["1A"] = "3º Grupo C/E/F/H/I";
    if (!opponents3rd["1L"]) opponents3rd["1L"] = "3º Grupo E/H/I/J/K";
    if (!opponents3rd["1D"]) opponents3rd["1D"] = "3º Grupo B/E/F/I/J";
    if (!opponents3rd["1G"]) opponents3rd["1G"] = "3º Grupo A/E/H/I/J";
    if (!opponents3rd["1B"]) opponents3rd["1B"] = "3º Grupo E/F/G/I/J";
    if (!opponents3rd["1K"]) opponents3rd["1K"] = "3º Grupo D/E/I/J/L";

    // Dieciseisavos (Match 73 to 88)
    resolved[73] = { home: group2nd["A"] || "2º Grupo A", away: group2nd["B"] || "2º Grupo B" };
    resolved[74] = { home: group1st["E"] || "1º Grupo E", away: opponents3rd["1E"] };
    resolved[75] = { home: group1st["F"] || "1º Grupo F", away: group2nd["C"] || "2º Grupo C" };
    resolved[76] = { home: group1st["C"] || "1º Grupo C", away: group2nd["F"] || "2º Grupo F" };
    resolved[77] = { home: group1st["I"] || "1º Grupo I", away: opponents3rd["1I"] };
    resolved[78] = { home: group2nd["E"] || "2º Grupo E", away: group2nd["I"] || "2º Grupo I" };
    resolved[79] = { home: group1st["A"] || "1º Grupo A", away: opponents3rd["1A"] };
    resolved[80] = { home: group1st["L"] || "1º Grupo L", away: opponents3rd["1L"] };
    resolved[81] = { home: group1st["D"] || "1º Grupo D", away: opponents3rd["1D"] };
    resolved[82] = { home: group1st["G"] || "1º Grupo G", away: opponents3rd["1G"] };
    resolved[83] = { home: group2nd["K"] || "2º Grupo K", away: group2nd["L"] || "2º Grupo L" };
    resolved[84] = { home: group1st["H"] || "1º Grupo H", away: group2nd["J"] || "2º Grupo J" };
    resolved[85] = { home: group1st["B"] || "1º Grupo B", away: opponents3rd["1B"] };
    resolved[86] = { home: group1st["J"] || "1º Grupo J", away: group2nd["H"] || "2º Grupo H" };
    resolved[87] = { home: group1st["K"] || "1º Grupo K", away: opponents3rd["1K"] };
    resolved[88] = { home: group2nd["D"] || "2º Grupo D", away: group2nd["G"] || "2º Grupo G" };

    // Octavos (Match 89 to 96)
    resolved[89] = { home: getWinner(74), away: getWinner(77) };
    resolved[90] = { home: getWinner(73), away: getWinner(75) };
    resolved[91] = { home: getWinner(76), away: getWinner(78) };
    resolved[92] = { home: getWinner(79), away: getWinner(80) };
    resolved[93] = { home: getWinner(83), away: getWinner(84) };
    resolved[94] = { home: getWinner(81), away: getWinner(82) };
    resolved[95] = { home: getWinner(86), away: getWinner(88) };
    resolved[96] = { home: getWinner(85), away: getWinner(87) };

    // Cuartos (Match 97 to 100)
    resolved[97] = { home: getWinner(89), away: getWinner(90) };
    resolved[98] = { home: getWinner(93), away: getWinner(94) };
    resolved[99] = { home: getWinner(91), away: getWinner(92) };
    resolved[100] = { home: getWinner(95), away: getWinner(96) };

    // Semifinales (Match 101 to 102)
    resolved[101] = { home: getWinner(97), away: getWinner(98) };
    resolved[102] = { home: getWinner(99), away: getWinner(100) };

    // Tercer Puesto & Final (Match 103 & 104)
    resolved[103] = { home: getLoser(101), away: getLoser(102) };
    resolved[104] = { home: getWinner(101), away: getWinner(102) };

    // 3. Resolve 100% Predictions Bracket
    const predictedResolved: Record<number, { home: string; away: string }> = {};

    matches.forEach((m) => {
      if (m.stage === "group") {
        predictedResolved[m.id] = { home: m.home_team, away: m.away_team };
      }
    });

    const getPredictedWinner = (matchId: number): string => {
      const m = matches.find((x) => x.id === matchId);
      if (!m) return `Ganador Partido ${matchId}`;

      const draft = viewingUser ? null : editingScores[matchId];
      const draftPenaltyWinnerHome = viewingUser ? undefined : editingPenaltyWinners[matchId];
      const pred = activePredictions[matchId];

      if (draft && draft.home !== "" && draft.away !== "") {
        const h = parseInt(draft.home, 10);
        const a = parseInt(draft.away, 10);
        if (h > a) return predictedResolved[matchId]?.home || m.home_team;
        if (h < a) return predictedResolved[matchId]?.away || m.away_team;
        
        if (draftPenaltyWinnerHome !== undefined) {
          return draftPenaltyWinnerHome
            ? (predictedResolved[matchId]?.home || m.home_team)
            : (predictedResolved[matchId]?.away || m.away_team);
        }
        return predictedResolved[matchId]?.home || m.home_team;
      }

      if (pred) {
        if (pred.home_score > pred.away_score) {
          return predictedResolved[matchId]?.home || m.home_team;
        }
        if (pred.home_score < pred.away_score) {
          return predictedResolved[matchId]?.away || m.away_team;
        }
        if (pred.penalty_winner_home !== null && pred.penalty_winner_home !== undefined) {
          return pred.penalty_winner_home
            ? (predictedResolved[matchId]?.home || m.home_team)
            : (predictedResolved[matchId]?.away || m.away_team);
        }
        return predictedResolved[matchId]?.home || m.home_team;
      }
      return `Ganador Partido ${matchId}`;
    };

    const getPredictedLoser = (matchId: number): string => {
      const m = matches.find((x) => x.id === matchId);
      if (!m) return `Perdedor Partido ${matchId}`;

      const draft = viewingUser ? null : editingScores[matchId];
      const draftPenaltyWinnerHome = viewingUser ? undefined : editingPenaltyWinners[matchId];
      const pred = activePredictions[matchId];

      if (draft && draft.home !== "" && draft.away !== "") {
        const h = parseInt(draft.home, 10);
        const a = parseInt(draft.away, 10);
        if (h > a) return predictedResolved[matchId]?.away || m.away_team;
        if (h < a) return predictedResolved[matchId]?.home || m.home_team;
        
        if (draftPenaltyWinnerHome !== undefined) {
          return draftPenaltyWinnerHome
            ? (predictedResolved[matchId]?.away || m.away_team)
            : (predictedResolved[matchId]?.home || m.home_team);
        }
        return predictedResolved[matchId]?.away || m.away_team;
      }

      if (pred) {
        if (pred.home_score > pred.away_score) {
          return predictedResolved[matchId]?.away || m.away_team;
        }
        if (pred.home_score < pred.away_score) {
          return predictedResolved[matchId]?.home || m.home_team;
        }
        if (pred.penalty_winner_home !== null && pred.penalty_winner_home !== undefined) {
          return pred.penalty_winner_home
            ? (predictedResolved[matchId]?.away || m.away_team)
            : (predictedResolved[matchId]?.home || m.home_team);
        }
        return predictedResolved[matchId]?.away || m.away_team;
      }
      return `Perdedor Partido ${matchId}`;
    };

    const predGroup1st: Record<string, string> = {};
    const predGroup2nd: Record<string, string> = {};
    const predGroup3rdList: { group: string; team: string; points: number; goalDiff: number; goalsFor: number }[] = [];

    Object.entries(sortedPredictedStandings).forEach(([g, list]) => {
      if (list[0]) predGroup1st[g] = list[0].team;
      if (list[1]) predGroup2nd[g] = list[1].team;
      if (list[2]) {
        predGroup3rdList.push({
          group: g,
          team: list[2].team,
          points: list[2].points,
          goalDiff: list[2].goalDiff,
          goalsFor: list[2].goalsFor,
        });
      }
    });

    const predSorted3rd = [...predGroup3rdList].sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
      if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
      return a.group.localeCompare(b.group);
    });

    const predOpponents3rd: Record<string, string> = {};
    if (predSorted3rd.length >= 8) {
      const qualifiedGroups = predSorted3rd.slice(0, 8).map((x) => x.group);
      const combKey = [...qualifiedGroups].sort().join("");
      const combMap = THIRD_PLACE_COMBINATIONS[combKey];
      if (combMap) {
        const thirdTeams: Record<string, string> = {};
        predSorted3rd.forEach((item) => {
          thirdTeams[item.group] = item.team;
        });
        const winners = ["1A", "1B", "1D", "1E", "1G", "1I", "1K", "1L"];
        winners.forEach((winner) => {
          const target3rdGroup = combMap[winner]?.[1];
          if (target3rdGroup && thirdTeams[target3rdGroup]) {
            predOpponents3rd[winner] = thirdTeams[target3rdGroup];
          }
        });
      }
    }

    // Fallbacks
    if (!predOpponents3rd["1E"]) predOpponents3rd["1E"] = "3º Grupo A/B/C/D/F";
    if (!predOpponents3rd["1I"]) predOpponents3rd["1I"] = "3º Grupo C/D/F/G/H";
    if (!predOpponents3rd["1A"]) predOpponents3rd["1A"] = "3º Grupo C/E/F/H/I";
    if (!predOpponents3rd["1L"]) predOpponents3rd["1L"] = "3º Grupo E/H/I/J/K";
    if (!predOpponents3rd["1D"]) predOpponents3rd["1D"] = "3º Grupo B/E/F/I/J";
    if (!predOpponents3rd["1G"]) predOpponents3rd["1G"] = "3º Grupo A/E/H/I/J";
    if (!predOpponents3rd["1B"]) predOpponents3rd["1B"] = "3º Grupo E/F/G/I/J";
    if (!predOpponents3rd["1K"]) predOpponents3rd["1K"] = "3º Grupo D/E/I/J/L";

    // Dieciseisavos (Match 73 to 88)
    predictedResolved[73] = { home: predGroup2nd["A"] || "2º Grupo A", away: predGroup2nd["B"] || "2º Grupo B" };
    predictedResolved[74] = { home: predGroup1st["E"] || "1º Grupo E", away: predOpponents3rd["1E"] };
    predictedResolved[75] = { home: predGroup1st["F"] || "1º Grupo F", away: predGroup2nd["C"] || "2º Grupo C" };
    predictedResolved[76] = { home: predGroup1st["C"] || "1º Grupo C", away: predGroup2nd["F"] || "2º Grupo F" };
    predictedResolved[77] = { home: predGroup1st["I"] || "1º Grupo I", away: predOpponents3rd["1I"] };
    predictedResolved[78] = { home: predGroup2nd["E"] || "2º Grupo E", away: predGroup2nd["I"] || "2º Grupo I" };
    predictedResolved[79] = { home: predGroup1st["A"] || "1º Grupo A", away: predOpponents3rd["1A"] };
    predictedResolved[80] = { home: predGroup1st["L"] || "1º Grupo L", away: predOpponents3rd["1L"] };
    predictedResolved[81] = { home: predGroup1st["D"] || "1º Grupo D", away: predOpponents3rd["1D"] };
    predictedResolved[82] = { home: predGroup1st["G"] || "1º Grupo G", away: predOpponents3rd["1G"] };
    predictedResolved[83] = { home: predGroup2nd["K"] || "2º Grupo K", away: predGroup2nd["L"] || "2º Grupo L" };
    predictedResolved[84] = { home: predGroup1st["H"] || "1º Grupo H", away: predGroup2nd["J"] || "2º Grupo J" };
    predictedResolved[85] = { home: predGroup1st["B"] || "1º Grupo B", away: predOpponents3rd["1B"] };
    predictedResolved[86] = { home: predGroup1st["J"] || "1º Grupo J", away: predGroup2nd["H"] || "2º Grupo H" };
    predictedResolved[87] = { home: predGroup1st["K"] || "1º Grupo K", away: predOpponents3rd["1K"] };
    predictedResolved[88] = { home: predGroup2nd["D"] || "2º Grupo D", away: predGroup2nd["G"] || "2º Grupo G" };

    // Octavos (Match 89 to 96)
    predictedResolved[89] = { home: getPredictedWinner(74), away: getPredictedWinner(77) };
    predictedResolved[90] = { home: getPredictedWinner(73), away: getPredictedWinner(75) };
    predictedResolved[91] = { home: getPredictedWinner(76), away: getPredictedWinner(78) };
    predictedResolved[92] = { home: getPredictedWinner(79), away: getPredictedWinner(80) };
    predictedResolved[93] = { home: getPredictedWinner(83), away: getPredictedWinner(84) };
    predictedResolved[94] = { home: getPredictedWinner(81), away: getPredictedWinner(82) };
    predictedResolved[95] = { home: getPredictedWinner(86), away: getPredictedWinner(88) };
    predictedResolved[96] = { home: getPredictedWinner(85), away: getPredictedWinner(87) };

    // Cuartos (Match 97 to 100)
    predictedResolved[97] = { home: getPredictedWinner(89), away: getPredictedWinner(90) };
    predictedResolved[98] = { home: getPredictedWinner(93), away: getPredictedWinner(94) };
    predictedResolved[99] = { home: getPredictedWinner(91), away: getPredictedWinner(92) };
    predictedResolved[100] = { home: getPredictedWinner(95), away: getPredictedWinner(96) };

    // Semifinales (Match 101 to 102)
    predictedResolved[101] = { home: getPredictedWinner(97), away: getPredictedWinner(98) };
    predictedResolved[102] = { home: getPredictedWinner(99), away: getPredictedWinner(100) };

    // Puesto 3 & Final (Match 103 & 104)
    predictedResolved[103] = { home: getPredictedLoser(101), away: getPredictedLoser(102) };
    predictedResolved[104] = { home: getPredictedWinner(101), away: getPredictedWinner(102) };

    return { 
      standings: sortedStandings, 
      resolvedBracket: resolved, 
      predictedStandings: sortedPredictedStandings, 
      predictedResolvedBracket: predictedResolved 
    };
  }, [matches, predictions, editingScores, editingPenaltyWinners, viewingUser, viewedUserPredictions]);

  // Group Matches by Group name (A-L) for group stage
  const groupStageMatches = useMemo(() => {
    const groups: Record<string, Match[]> = {};
    matches.forEach((m) => {
      if (m.stage === "group" && m.group) {
        if (!groups[m.group]) {
          groups[m.group] = [];
        }
        groups[m.group].push(m);
      }
    });
    return Object.entries(groups).map(([groupName, items]) => ({
      groupName,
      items: items.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    })).sort((a, b) => a.groupName.localeCompare(b.groupName));
  }, [matches]);

  const hasUnsavedDrafts = useMemo(() => {
    return matches.some((m) => {
      const matchDateObj = new Date(m.date);
      const isStarted = matchDateObj <= new Date();
      const hasFinished = m.status === "FT";
      if (isStarted || hasFinished) return false;

      const draft = editingScores[m.id];
      const pred = predictions[m.id];
      if (!draft || draft.home === "" || draft.away === "") return false;

      const scoreChanged =
        draft.home !== (pred ? String(pred.home_score) : "") ||
        draft.away !== (pred ? String(pred.away_score) : "");

      const penaltyWinnerChanged =
        (editingPenaltyWinners[m.id] !== undefined ? editingPenaltyWinners[m.id] : null) !==
        (pred && pred.penalty_winner_home !== undefined ? pred.penalty_winner_home : null);

      return scoreChanged || penaltyWinnerChanged;
    });
  }, [matches, editingScores, predictions, editingPenaltyWinners]);


  // Render bracket match card helper
  const renderBracketMatchCard = (m: Match) => {
    const pred = viewingUser ? viewedUserPredictions[m.id] : predictions[m.id];
    const draft = viewingUser
      ? { home: pred ? String(pred.home_score) : "", away: pred ? String(pred.away_score) : "" }
      : (editingScores[m.id] || { home: "", away: "" });
    const isSaving = actionLoading[m.id] || false;

    const matchDateObj = new Date(m.date);
    const isStarted = matchDateObj <= new Date();
    const hasFinished = m.status === "FT";

    const isFT = m.status === "FT";
    const homeResolved = isFT ? (resolvedBracket[m.id]?.home || m.home_team) : (predictedResolvedBracket[m.id]?.home || m.home_team);
    const awayResolved = isFT ? (resolvedBracket[m.id]?.away || m.away_team) : (predictedResolvedBracket[m.id]?.away || m.away_team);

    const homeFlag = getFlagEmoji(homeResolved);
    const awayFlag = getFlagEmoji(awayResolved);

    const isPlaceholder = isFT && (isTeamPlaceholder(homeResolved) || isTeamPlaceholder(awayResolved));
    
    const homeScoreInt = draft.home !== "" ? parseInt(draft.home, 10) : null;
    const awayScoreInt = draft.away !== "" ? parseInt(draft.away, 10) : null;
    const hasDraft = homeScoreInt !== null && awayScoreInt !== null;
    const isTie = hasDraft && homeScoreInt === awayScoreInt;
    const penaltyWinnerHome = viewingUser
      ? (pred ? !!pred.penalty_winner_home : true)
      : (editingPenaltyWinners[m.id] ?? true);

    const predHome = pred ? pred.home_score : null;
    const predAway = pred ? pred.away_score : null;
    const predPenalty = pred ? pred.penalty_winner_home : null;

    const isModified = !viewingUser && hasDraft && (
      homeScoreInt !== predHome ||
      awayScoreInt !== predAway ||
      (homeScoreInt === awayScoreInt && (penaltyWinnerHome !== (predPenalty ?? true)))
    );

    const handlePenaltyWinnerToggle = (homeWins: boolean) => {
      if (isStarted || hasFinished || isPlaceholder || !!viewingUser) return;
      setEditingPenaltyWinners((prev) => ({
        ...prev,
        [m.id]: homeWins,
      }));
    };

    const getRoundForMatch = (matchId: number): string | null => {
      if (matchId >= 73 && matchId <= 88) return "r32";
      if (matchId >= 89 && matchId <= 96) return "r16";
      if (matchId >= 97 && matchId <= 100) return "qf";
      if (matchId >= 101 && matchId <= 102) return "sf";
      if (matchId === 103) return "third";
      if (matchId === 104) return "final";
      return null;
    };

    const getRoundLabel = (matchId: number): string => {
      const round = getRoundForMatch(matchId);
      if (round === "r32") return "Dieciseisavos (1/16)";
      if (round === "r16") return "Octavos (1/8)";
      if (round === "qf") return "Cuartos (1/4)";
      if (round === "sf") return "Semifinales";
      if (round === "third") return "3er Puesto";
      if (round === "final") return "la Final";
      return "Eliminatorias";
    };

    const activePredictions = viewingUser ? viewedUserPredictions : predictions;

    let matchingPredId = null;
    let isCoincident = false;
    let isSemiCoincident = false;

    if (m.id >= 73 && !isPlaceholder && m.status === "FT") {
      const realSet = new Set([homeResolved, awayResolved]);

      // Scan all predicted resolved matches to find matches with the same teams
      const candidates = [];
      for (let mPredId = 73; mPredId <= 104; mPredId++) {
        const predHome = predictedResolvedBracket[mPredId]?.home;
        const predAway = predictedResolvedBracket[mPredId]?.away;
        if (predHome && predAway && !isTeamPlaceholder(predHome) && !isTeamPlaceholder(predAway)) {
          if (realSet.has(predHome) && realSet.has(predAway)) {
            candidates.push(mPredId);
          }
        }
      }

      if (candidates.length > 0) {
        const roundReal = getRoundForMatch(m.id);
        const sameRoundCandidates = candidates.filter(c => getRoundForMatch(c) === roundReal);

        if (sameRoundCandidates.length > 0) {
          if (sameRoundCandidates.includes(m.id)) {
            matchingPredId = m.id; // Normal match
          } else {
            matchingPredId = sameRoundCandidates[0];
            isCoincident = true;
          }
        } else {
          matchingPredId = candidates[0];
          isSemiCoincident = true;
        }
      }
    }

    let borderStyle = {};
    if (isCoincident) {
      borderStyle = {
        borderColor: "rgba(16, 185, 129, 0.5)",
        boxShadow: "0 0 12px rgba(16, 185, 129, 0.1)",
        background: "linear-gradient(135deg, rgba(16, 185, 129, 0.05) 0%, rgba(15, 23, 42, 0.75) 100%)",
      };
    } else if (isSemiCoincident) {
      borderStyle = {
        borderColor: "rgba(245, 158, 11, 0.5)",
        boxShadow: "0 0 12px rgba(245, 158, 11, 0.1)",
        background: "linear-gradient(135deg, rgba(245, 158, 11, 0.05) 0%, rgba(15, 23, 42, 0.75) 100%)",
      };
    }

    return (
      <div 
        key={m.id} 
        className={`bracket-match-card ${isPlaceholder ? "bracket-placeholder" : ""}`}
        style={{ 
          opacity: isPlaceholder ? 0.65 : 1,
          background: isPlaceholder ? "rgba(15, 23, 42, 0.3)" : "rgba(15, 23, 42, 0.65)",
          borderColor: isPlaceholder ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.08)",
          ...borderStyle,
        }}
      >
        <div className="bracket-match-header">
          <span>Partido #{m.id}</span>
          {m.stage !== "group" && (
            <span className="bracket-match-stage-label">
              <span style={{ color: "#b0b0b0" }}>{m.stage === "r32" ? "1/16" : m.stage === "r16" ? "1/8" : m.stage === "qf" ? "1/4" : m.stage === "sf" ? "Semis" : m.stage === "third" ? "3er" : "Final"}</span>
            </span>
          )}
        </div>

        <div className="bracket-match-body" style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {/* Home Team Row */}
          <div 
            onClick={() => isTie && handlePenaltyWinnerToggle(true)}
            className={`bracket-team-row ${isTie && penaltyWinnerHome ? "penalty-winner" : ""}`}
            style={{ cursor: isTie && !viewingUser ? "pointer" : "default" }}
          >
            <span className="bracket-team-name">
              <span className="bracket-flag">{homeFlag}</span>
              <span className="name-text" style={{ fontWeight: isTie && penaltyWinnerHome ? "bold" : "normal" }}>{homeResolved}</span>
              {isTie && penaltyWinnerHome && <span className="penalty-badge">🎯 Pen</span>}
            </span>
            {m.home_score !== null && m.away_score !== null ? (
              <span className="bracket-score">{m.home_score}</span>
            ) : (
              <input
                type="text"
                className="bracket-score-input"
                placeholder="-"
                value={draft.home}
                onChange={(e) => handleScoreChange(m.id, "home", e.target.value)}
                disabled={isStarted || hasFinished || isPlaceholder || !!viewingUser}
              />
            )}
          </div>

          <div className="bracket-divider"></div>

          {/* Away Team Row */}
          <div 
            onClick={() => isTie && handlePenaltyWinnerToggle(false)}
            className={`bracket-team-row ${isTie && !penaltyWinnerHome ? "penalty-winner" : ""}`}
            style={{ cursor: isTie && !viewingUser ? "pointer" : "default" }}
          >
            <span className="bracket-team-name">
              <span className="bracket-flag">{awayFlag}</span>
              <span className="name-text" style={{ fontWeight: isTie && !penaltyWinnerHome ? "bold" : "normal" }}>{awayResolved}</span>
              {isTie && !penaltyWinnerHome && <span className="penalty-badge">🎯 Pen</span>}
            </span>
            {m.home_score !== null && m.away_score !== null ? (
              <span className="bracket-score">{m.away_score}</span>
            ) : (
              <input
                type="text"
                className="bracket-score-input"
                placeholder="-"
                value={draft.away}
                onChange={(e) => handleScoreChange(m.id, "away", e.target.value)}
                disabled={isStarted || hasFinished || isPlaceholder || !!viewingUser}
              />
            )}
          </div>
        </div>

        {/* Prediction compare info */}
        {m.stage !== "group" && (
          <div className="bracket-match-prediction-info" style={{ marginTop: "0.5rem", fontSize: "0.75rem", opacity: 0.8, borderTop: "1px dashed rgba(255,255,255,0.1)", paddingTop: "0.5rem" }}>
            {isCoincident && matchingPredId !== null && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                <span style={{ color: "#10b981", fontWeight: "bold" }}>✨ PARTIDO COINCIDENTE (100% pts)</span>
                {(() => {
                  const matchingPred = activePredictions[matchingPredId];
                  if (matchingPred) {
                    const predHome = predictedResolvedBracket[matchingPredId]?.home;
                    const predAway = predictedResolvedBracket[matchingPredId]?.away;
                    return (
                      <span style={{ opacity: 0.7 }}>
                        Predicho en #{matchingPredId}: {getFlagEmoji(predHome)} {predHome} {matchingPred.home_score} - {matchingPred.away_score} {predAway} {getFlagEmoji(predAway)}
                      </span>
                    );
                  }
                  return <span style={{ opacity: 0.5 }}>Coincidencia sin pronóstico guardado</span>;
                })()}
              </div>
            )}
            {isSemiCoincident && matchingPredId !== null && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                <span style={{ color: "#f59e0b", fontWeight: "bold" }}>⚠️ PARTIDO SEMICOINCIDENTE (50% pts)</span>
                {(() => {
                  const matchingPred = activePredictions[matchingPredId];
                  if (matchingPred) {
                    const predHome = predictedResolvedBracket[matchingPredId]?.home;
                    const predAway = predictedResolvedBracket[matchingPredId]?.away;
                    const roundLabel = getRoundLabel(matchingPredId);
                    return (
                      <span style={{ opacity: 0.7 }}>
                        Predicho en {roundLabel}: {getFlagEmoji(predHome)} {predHome} {matchingPred.home_score} - {matchingPred.away_score} {predAway} {getFlagEmoji(predAway)}
                      </span>
                    );
                  }
                  return <span style={{ opacity: 0.5 }}>Coincidencia sin pronóstico guardado</span>;
                })()}
              </div>
            )}
            {!isCoincident && !isSemiCoincident && (() => {
              const predHome = predictedResolvedBracket[m.id]?.home;
              const predAway = predictedResolvedBracket[m.id]?.away;
              const hasPredTeams = predHome && predAway && !isTeamPlaceholder(predHome) && !isTeamPlaceholder(predAway);
              if (hasPredTeams) {
                const predHomeScore = pred ? pred.home_score : "?";
                const predAwayScore = pred ? pred.away_score : "?";
                return (
                  <div style={{ fontStyle: "italic", color: "#b0b0b0", opacity: 0.9 }}>
                    Predicción original: {getFlagEmoji(predHome)} {predHome} {predHomeScore} - {predAwayScore} {predAway} {getFlagEmoji(predAway)}
                  </div>
                );
              }
              return null;
            })()}
          </div>
        )}

        {/* Footer with save button */}
        {!isStarted && !hasFinished && !isPlaceholder && (
          <div className="bracket-match-footer" style={{ marginTop: "0.5rem" }}>
            {isModified ? (
              <button 
                onClick={() => handleSavePrediction(m.id)} 
                className="btn-save-bracket"
                disabled={isSaving || draft.home === "" || draft.away === ""}
              >
                {isSaving ? "Guardando..." : "💾 Guardar"}
              </button>
            ) : pred ? (
              <span className="bracket-saved-label">✓ Guardado</span>
            ) : (
              <span className="bracket-pending-label">Sin pronóstico</span>
            )}
          </div>
        )}
      </div>
    );
  };

  // Render match card helper
  const renderMatchCard = (m: Match) => {
    const pred = viewingUser ? viewedUserPredictions[m.id] : predictions[m.id];
    const draft = viewingUser
      ? { home: pred ? String(pred.home_score) : "", away: pred ? String(pred.away_score) : "" }
      : (editingScores[m.id] || { home: "", away: "" });
    const isSaving = actionLoading[m.id] || false;

    const matchDateObj = new Date(m.date);
    const isStarted = matchDateObj <= new Date();
    const hasFinished = m.status === "FT";

    // Resolve dynamic team names from bracket calculations
    const homeResolved = resolvedBracket[m.id]?.home || m.home_team;
    const awayResolved = resolvedBracket[m.id]?.away || m.away_team;

    const homeFlag = getFlagEmoji(homeResolved);
    const awayFlag = getFlagEmoji(awayResolved);

    const isModified =
      !viewingUser &&
      (draft.home !== (pred ? String(pred.home_score) : "") ||
       draft.away !== (pred ? String(pred.away_score) : ""));

    // Format concrete knockout label
    let koMatchLabel = "";
    if (m.stage !== "group") {
      const labelsEs: Record<string, string> = {
        r32: "Dieciseisavos",
        r16: "Octavos",
        qf: "Cuartos",
        sf: "Semifinal",
        third: "3er Puesto",
        final: "Final",
      };
      const stageName = labelsEs[m.stage || ""] || m.stage;
      koMatchLabel = `${stageName} #${m.id - (m.stage === "r32" ? 72 : (m.stage === "r16" ? 88 : (m.stage === "qf" ? 96 : (m.stage === "sf" ? 100 : 102))))}`;
    }

    return (
      <article key={m.id} className="glass-panel match-card">
        <div className="match-card-header">
          <span>🕒 {formatDate(m.date)} {koMatchLabel && <strong style={{ marginLeft: "0.5rem", color: "var(--accent)" }}>{koMatchLabel}</strong>}</span>
          <span
            className={`match-status ${
              hasFinished ? "status-ft" : isStarted ? "status-live" : "status-ns"
            }`}
          >
            {hasFinished ? "FINALIZADO" : isStarted ? "EN JUEGO 🔴" : "NO INICIADO"}
          </span>
        </div>

        {/* Layout de Escritorio (Horizontal) */}
        <div className="match-card-body-desktop">
          <div className="team">
            <span className="team-flag">{homeFlag}</span>
            <span className="team-name">{homeResolved}</span>
          </div>

          <div className="score-center">
            {m.home_score !== null && m.away_score !== null ? (
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
                disabled={isStarted || hasFinished || !!viewingUser}
              />
              <span className="score-dash">-</span>
              <input
                type="text"
                className="pred-input"
                placeholder="-"
                value={draft.away}
                onChange={(e) => handleScoreChange(m.id, "away", e.target.value)}
                disabled={isStarted || hasFinished || !!viewingUser}
              />
            </div>
          </div>

          <div className="team">
            <span className="team-flag">{awayFlag}</span>
            <span className="team-name">{awayResolved}</span>
          </div>
        </div>

        {/* Layout Móvil (Apilado por filas de equipo) */}
        <div className="match-card-body-mobile">
          <div className="mobile-team-row">
            <div className="mobile-team-info">
              <span className="team-flag">{homeFlag}</span>
              <span className="team-name">{homeResolved}</span>
            </div>
            {m.home_score !== null && m.away_score !== null ? (
              <span className="mobile-real-score">{m.home_score}</span>
            ) : (
              <input
                type="text"
                className="pred-input"
                placeholder="-"
                value={draft.home}
                onChange={(e) => handleScoreChange(m.id, "home", e.target.value)}
                disabled={isStarted || hasFinished || !!viewingUser}
              />
            )}
          </div>

          <div className="mobile-team-row">
            <div className="mobile-team-info">
              <span className="team-flag">{awayFlag}</span>
              <span className="team-name">{awayResolved}</span>
            </div>
            {m.home_score !== null && m.away_score !== null ? (
              <span className="mobile-real-score">{m.away_score}</span>
            ) : (
              <input
                type="text"
                className="pred-input"
                placeholder="-"
                value={draft.away}
                onChange={(e) => handleScoreChange(m.id, "away", e.target.value)}
                disabled={isStarted || hasFinished || !!viewingUser}
              />
            )}
          </div>
        </div>

        <div className="match-card-footer">
          <div>
            {hasFinished && pred ? (
              <span className={`points-badge points-${pred.points_earned}`}>
                {pred.points_earned === 3
                  ? "+3 Puntos (Exacto) 🌟"
                  : pred.points_earned === 1
                  ? "+1 Punto (Resultado)"
                  : "0 Puntos"}
              </span>
            ) : pred ? (
              <span className="prediction-hint">
                Pronóstico: {pred.home_score} - {pred.away_score}
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
              disabled={isSaving || draft.home === "" || draft.away === ""}
            >
              {isSaving ? "Guardando..." : "Guardar"}
            </button>
          )}
        </div>
      </article>
    );
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

  // --- LOGIN/REGISTER VIEW ---
  if (!user) {
    return (
      <div className="auth-wrapper">
        <div className="glass-panel auth-card">
          <span className="auth-logo">🏆</span>
          <h1>YORRA MUNDIAL 2026</h1>
          
          {isRegistering ? (
            <>
              <p>Elige tu nombre de usuario y nombre completo para registrarte</p>
              <form onSubmit={handleRegister}>
                {loginError && <div className="error-message">{loginError}</div>}
                
                <div className="input-group">
                  <label className="input-label" htmlFor="registerUsername">
                    Nombre de usuario (ej: edu_sanchez)
                  </label>
                  <input
                    id="registerUsername"
                    type="text"
                    className="premium-input"
                    placeholder="Sin espacios ni caracteres especiales"
                    value={loginInput}
                    onChange={(e) => setLoginInput(e.target.value)}
                    required
                  />
                </div>

                <div className="input-group">
                  <label className="input-label" htmlFor="registerFullName">
                    Nombre Completo (ej: Edu Sánchez)
                  </label>
                  <input
                    id="registerFullName"
                    type="text"
                    className="premium-input"
                    placeholder="El nombre que se verá en la porra"
                    value={registerFullName}
                    onChange={(e) => setRegisterFullName(e.target.value)}
                    required
                  />
                </div>

                <button type="submit" className="premium-button">
                  Registrarse y Entrar
                </button>

                <p className="auth-toggle-text" style={{ marginTop: "1rem", fontSize: "0.9rem", opacity: 0.8 }}>
                  ¿Ya tienes cuenta?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setIsRegistering(false);
                      setLoginError(null);
                      setLoginInput("");
                    }}
                    style={{ background: "none", border: "none", color: "#60a5fa", cursor: "pointer", textDecoration: "underline", padding: 0 }}
                  >
                    Inicia sesión aquí
                  </button>
                </p>
              </form>
            </>
          ) : (
            <>
              <p>Introduce tu nombre de usuario para acceder</p>
              <form onSubmit={handleLogin}>
                {loginError && <div className="error-message">{loginError}</div>}
                
                <div className="input-group">
                  <label className="input-label" htmlFor="usernameInput">
                    Nombre de usuario
                  </label>
                  <input
                    id="usernameInput"
                    type="text"
                    className="premium-input"
                    placeholder="ej: edu_sanchez"
                    value={loginInput}
                    onChange={(e) => setLoginInput(e.target.value)}
                    required
                  />
                </div>

                <button type="submit" className="premium-button">
                  Ingresar a la Porra
                </button>

                <p className="auth-toggle-text" style={{ marginTop: "1rem", fontSize: "0.9rem", opacity: 0.8 }}>
                  ¿Eres nuevo?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setIsRegistering(true);
                      setLoginError(null);
                      setLoginInput("");
                      setRegisterFullName("");
                    }}
                    style={{ background: "none", border: "none", color: "#60a5fa", cursor: "pointer", textDecoration: "underline", padding: 0 }}
                  >
                    Regístrate aquí
                  </button>
                </p>
              </form>
            </>
          )}
        </div>
      </div>
    );
  }

  // --- DASHBOARD VIEW ---
  const displayTournamentPredictions = viewingUser ? viewedUserTournament : tournamentPredictions;

  return (
    <>
      {/* Header */}
      <header className="glass-panel dashboard-header">
        <div className="logo-container">
          <span className="logo-icon">🏆</span>
          <span className="logo-text">YORRA MUNDIAL 2026</span>
        </div>
        
        <div className="header-actions">
          {!viewingUser && (
            <button onClick={handleSaveAllDrafts} className="btn-save-all-drafts">
              💾 Guardar Todo
            </button>
          )}
          <div className="user-nav-profile">
            <span className="user-score">
              👤 {user.full_name} ({user.points} pts)
            </span>
            <button onClick={handleLogout} className="logout-btn">
              Cerrar Sesión
            </button>
          </div>
        </div>
      </header>

      {/* Warning banner when comparing user porra */}
      {viewingUser && (
        <div className="viewing-user-banner">
          <div className="banner-content">
            <span className="banner-icon">👀</span>
            <span>
              Viendo la porra de <strong>{viewingUser.full_name}</strong> ({viewingUser.points} pts) en modo lectura.
            </span>
          </div>
          <button 
            onClick={() => {
              setViewingUser(null);
              setActiveTab("leaderboard");
            }} 
            className="btn-back-to-own"
          >
            ⬅️ Volver a mi porra
          </button>
        </div>
      )}

      {/* Control Panel Toolbar */}
      {!viewingUser && (
        <details className="admin-tools-accordion glass-panel">
          <summary className="admin-tools-summary">
            <span>🛠️ Herramientas de Desarrollo y Prueba</span>
            <span className="summary-chevron">▼</span>
          </summary>
          <div className="control-toolbar">
            <button onClick={handleSimulateMyPredictions} className="btn-save-pred" style={{ background: "rgba(139, 92, 246, 0.2)", color: "#c084fc", border: "1px solid rgba(139, 92, 246, 0.4)" }}>
              🎲 Simular mis Pronósticos
            </button>
            <button onClick={handleResetMyPredictions} className="btn-save-pred" style={{ background: "rgba(139, 92, 246, 0.1)", color: "#e9d5ff", border: "1px solid rgba(139, 92, 246, 0.2)" }} disabled={isSimulatingAll}>
              🧹 Resetear mis Pronósticos
            </button>
            <button onClick={handleSimulateRealScores} className="btn-save-pred" style={{ background: "rgba(239, 68, 68, 0.2)", color: "#f87171", border: "1px solid rgba(239, 68, 68, 0.4)" }} disabled={isSimulatingAll}>
              {isSimulatingAll ? "Simulando..." : "🎲 Simular Resultados Reales (Admin)"}
            </button>
            <button onClick={handleResetRealScores} className="btn-save-pred" style={{ background: "rgba(239, 68, 68, 0.1)", color: "#fecaca", border: "1px solid rgba(239, 68, 68, 0.2)" }} disabled={isSimulatingAll}>
              🧹 Resetear Resultados Reales (Admin)
            </button>
          </div>
        </details>
      )}

      {/* Tabs Navigation */}
      <nav className="tab-nav">
        <button
          onClick={() => setActiveTab("matches")}
          className={`tab-btn ${activeTab === "matches" ? "active" : ""}`}
        >
          ⚽ Grupos
        </button>
        <button
          onClick={() => setActiveTab("bracket")}
          className={`tab-btn ${activeTab === "bracket" ? "active" : ""}`}
        >
          🏆 Fase Final
        </button>
        <button
          onClick={() => setActiveTab("standings")}
          className={`tab-btn ${activeTab === "standings" ? "active" : ""}`}
        >
          📋 Posiciones
        </button>
        <button
          onClick={() => setActiveTab("sidebets")}
          className={`tab-btn ${activeTab === "sidebets" ? "active" : ""}`}
        >
          🎯 Especiales
        </button>
        <button
          onClick={() => setActiveTab("leaderboard")}
          className={`tab-btn ${activeTab === "leaderboard" ? "active" : ""}`}
        >
          🏅 Clasificación
        </button>
        <button
          onClick={() => setActiveTab("rules")}
          className={`tab-btn ${activeTab === "rules" ? "active" : ""}`}
        >
          📜 Reglas
        </button>
      </nav>

      {/* Main Tab Content */}
      <main 
        className={`main-content ${viewingUser ? "viewing-mode-gray" : ""}`}
      >
        {viewedUserLoading ? (
          <div style={{ textAlign: "center", padding: "3rem" }}>
            <h2>Cargando pronósticos de {viewingUser?.full_name}...</h2>
          </div>
        ) : viewedUserError ? (
          <div className="error-message" style={{ margin: "2rem" }}>
            {viewedUserError}
          </div>
        ) : loading && activeTab !== "matches" ? (
          <div style={{ textAlign: "center", padding: "3rem" }}>
            <h2>Cargando contenido...</h2>
          </div>
        ) : activeTab === "matches" ? (
          // --- TAB 1: MATCHES ---
          <div>
            <div className="groups-container" style={{ display: "flex", flexDirection: "column", gap: "2.5rem" }}>
              {groupStageMatches.map((group) => (
                <section key={group.groupName} className="date-section" style={{ borderLeft: "4px solid var(--accent)", paddingLeft: "1rem" }}>
                  <h2 className="date-header" style={{ marginBottom: "1rem" }}>Grupo {group.groupName}</h2>
                  <div className="matches-grid">
                    {group.items.map(renderMatchCard)}
                  </div>
                </section>
              ))}
            </div>
          </div>
        ) : activeTab === "bracket" ? (
          // --- TAB 2: BRACKET ---
          <div className="bracket-wrapper" style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
            <div className="glass-panel" style={{ padding: "1.5rem", borderRadius: "12px" }}>
              <h2 style={{ color: "var(--accent)", marginBottom: "0.5rem" }}>📊 Simulador del Cuadro de Fase Final</h2>
              <p style={{ opacity: 0.8 }}>
                Completa tus pronósticos directamente en las llaves. Los equipos clasificados avanzarán automáticamente a la siguiente ronda.
                <br />
                <span style={{ fontSize: "0.85rem", color: "var(--accent)" }}>
                  💡 Para empates en fases eliminatorias, haz clic sobre el nombre del equipo para elegir al ganador de la tanda de penaltis.
                </span>
              </p>
            </div>

            <div className="bracket-outer-container">
              <div className="bracket-container">
                {/* Column 1: Dieciseisavos (Round of 32) */}
                <div className="bracket-column">
                  <div className="bracket-column-header">Dieciseisavos (1/16)</div>
                  {[74, 77, 73, 75, 83, 84, 81, 82, 76, 78, 79, 80, 86, 88, 85, 87].map((matchId) => {
                    const m = matches.find((x) => x.id === matchId);
                    return m ? renderBracketMatchCard(m) : null;
                  })}
                </div>

                {/* Column 2: Octavos (Round of 16) */}
                <div className="bracket-column">
                  <div className="bracket-column-header">Octavos (1/8)</div>
                  {[89, 90, 93, 94, 91, 92, 95, 96].map((matchId) => {
                    const m = matches.find((x) => x.id === matchId);
                    return m ? renderBracketMatchCard(m) : null;
                  })}
                </div>

                {/* Column 3: Cuartos (Quarterfinals) */}
                <div className="bracket-column">
                  <div className="bracket-column-header">Cuartos (1/4)</div>
                  {[97, 98, 99, 100].map((matchId) => {
                    const m = matches.find((x) => x.id === matchId);
                    return m ? renderBracketMatchCard(m) : null;
                  })}
                </div>

                {/* Column 4: Semifinales (Semifinals) */}
                <div className="bracket-column">
                  <div className="bracket-column-header">Semifinales</div>
                  {[101, 102].map((matchId) => {
                    const m = matches.find((x) => x.id === matchId);
                    return m ? renderBracketMatchCard(m) : null;
                  })}
                </div>

                {/* Column 5: Finales (Finals) */}
                <div className="bracket-column">
                  <div className="bracket-column-header">Finales</div>
                  {[104, 103].map((matchId) => {
                    const m = matches.find((x) => x.id === matchId);
                    return m ? renderBracketMatchCard(m) : null;
                  })}
                </div>
              </div>
            </div>
          </div>
        ) : activeTab === "standings" ? (
          // --- TAB 3: STANDINGS ---
          <div className="standings-grid">
            {Object.entries(standings).sort((a, b) => a[0].localeCompare(b[0])).map(([g, list]) => (
              <div key={g} className="glass-panel" style={{ padding: "1.25rem", borderRadius: "12px" }}>
                <h3 style={{ color: "var(--accent)", marginBottom: "1rem", borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: "0.5rem" }}>Grupo {g}</h3>
                <table style={{ width: "100%", fontSize: "0.85rem", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ opacity: 0.6, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                      <th style={{ textAlign: "left", paddingBottom: "0.5rem" }}>Equipo</th>
                      <th style={{ textAlign: "center", paddingBottom: "0.5rem" }}>PJ</th>
                      <th style={{ textAlign: "center", paddingBottom: "0.5rem" }}>DG</th>
                      <th style={{ textAlign: "center", paddingBottom: "0.5rem" }}>Pred.</th>
                      <th style={{ textAlign: "right", paddingBottom: "0.5rem" }}>Pts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((t, idx) => {
                      const predRank = (predictedStandings[g]?.findIndex((x) => x.team === t.team) ?? 0) + 1;
                      const isCorrect = predRank === idx + 1;
                      return (
                        <tr key={t.team} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)", fontWeight: idx < 2 ? 600 : 400 }}>
                          <td style={{ padding: "0.5rem 0", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <span style={{ fontSize: "0.75rem", opacity: 0.5 }}>#{idx+1}</span>
                            <span>{getFlagEmoji(t.team)} {t.team}</span>
                          </td>
                          <td style={{ textAlign: "center", padding: "0.5rem 0" }}>{t.played}</td>
                          <td style={{ textAlign: "center", padding: "0.5rem 0", color: t.goalDiff > 0 ? "#10b981" : (t.goalDiff < 0 ? "#ef4444" : "inherit") }}>{t.goalDiff > 0 ? `+${t.goalDiff}` : t.goalDiff}</td>
                          <td style={{ textAlign: "center", padding: "0.5rem 0" }}>
                            <span 
                              style={{ 
                                background: isCorrect ? "rgba(16, 185, 129, 0.15)" : "rgba(255,165,0,0.15)", 
                                color: isCorrect ? "#10b981" : "#ff9800",
                                padding: "2px 6px", 
                                borderRadius: "4px", 
                                fontSize: "0.75rem",
                                fontWeight: "bold",
                                border: isCorrect ? "1px solid rgba(16, 185, 129, 0.3)" : "1px solid transparent"
                              }}
                            >
                              #{predRank}
                            </span>
                          </td>
                          <td style={{ textAlign: "right", padding: "0.5rem 0", color: idx < 2 ? "var(--accent)" : "inherit" }}>{t.points}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        ) : activeTab === "sidebets" ? (
          // --- TAB 4: SIDEBETS ---
          <div className="sidebets-container">
            <div className="glass-panel sidebets-panel">
              <h2 style={{ color: "var(--accent)", marginBottom: "1.5rem", borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: "0.75rem" }}>🎯 Apuestas Especiales del Torneo</h2>
              <p style={{ fontSize: "0.9rem", opacity: 0.8, marginBottom: "2rem" }}>Elige tus favoritos para los premios especiales de la porra. ¡Rellena tus candidatos en cada desplegable y guarda los cambios!</p>

              <div className="input-group" style={{ marginBottom: "1.5rem" }}>
                <label className="input-label">🏆 Campeón del Mundo</label>
                <select
                  className="premium-input"
                  style={{ background: "#2e3b4e", color: "#ffffff", border: "1px solid rgba(255,255,255,0.15)", cursor: "pointer" }}
                  value={displayTournamentPredictions.champion || ""}
                  onChange={(e) => setTournamentPredictions(prev => ({ ...prev, champion: e.target.value || null }))}
                  disabled={!!viewingUser}
                >
                  <option value="">-- Elige un país --</option>
                  {ALL_TEAMS_ES.map(team => (
                    <option key={team} value={team}>{getFlagEmoji(team)} {team}</option>
                  ))}
                </select>
              </div>

              <div className="input-group" style={{ marginBottom: "1.5rem" }}>
                <label className="input-label">🥈 Subcampeón</label>
                <select
                  className="premium-input"
                  style={{ cursor: "pointer" }}
                  value={displayTournamentPredictions.runner_up || ""}
                  onChange={(e) => setTournamentPredictions(prev => ({ ...prev, runner_up: e.target.value || null }))}
                  disabled={!!viewingUser}
                >
                  <option value="">-- Elige un país --</option>
                  {ALL_TEAMS_ES.map(team => (
                    <option key={team} value={team}>{getFlagEmoji(team)} {team}</option>
                  ))}
                </select>
              </div>

              <div className="input-group" style={{ marginBottom: "1.5rem" }}>
                <label className="input-label">🔥 Máximo Goleador (Bota de Oro)</label>
                <select
                  className="premium-input"
                  style={{ cursor: "pointer" }}
                  value={displayTournamentPredictions.top_scorer || ""}
                  onChange={(e) => setTournamentPredictions(prev => ({ ...prev, top_scorer: e.target.value || null }))}
                  disabled={!!viewingUser}
                >
                  <option value="">-- Elige un jugador --</option>
                  {ALL_FORWARDS.map(player => (
                    <option key={player} value={player}>{player}</option>
                  ))}
                </select>
              </div>

              <div className="input-group" style={{ marginBottom: "1.5rem" }}>
                <label className="input-label">🧤 Mejor Portero (Guante de Oro)</label>
                <select
                  className="premium-input"
                  style={{ cursor: "pointer" }}
                  value={displayTournamentPredictions.best_goalkeeper || ""}
                  onChange={(e) => setTournamentPredictions(prev => ({ ...prev, best_goalkeeper: e.target.value || null }))}
                  disabled={!!viewingUser}
                >
                  <option value="">-- Elige un portero --</option>
                  {ALL_GOALKEEPERS.map(gk => (
                    <option key={gk} value={gk}>{gk}</option>
                  ))}
                </select>
              </div>

              <div className="input-group" style={{ marginBottom: "2rem" }}>
                <label className="input-label">⭐ Equipo Revelación</label>
                <select
                  className="premium-input"
                  style={{ cursor: "pointer" }}
                  value={displayTournamentPredictions.surprise_team || ""}
                  onChange={(e) => setTournamentPredictions(prev => ({ ...prev, surprise_team: e.target.value || null }))}
                  disabled={!!viewingUser}
                >
                  <option value="">-- Elige un país --</option>
                  {ALL_TEAMS_ES.map(team => (
                    <option key={team} value={team}>{getFlagEmoji(team)} {team}</option>
                  ))}
                </select>
              </div>

              {!viewingUser && (
                <button
                  onClick={handleSaveTournamentPredictions}
                  className="premium-button"
                  disabled={savingTournament}
                >
                  {savingTournament ? "Guardando apuestas..." : "💾 Guardar Apuestas Especiales"}
                </button>
              )}
            </div>
          </div>
        ) : activeTab === "leaderboard" ? (
          // --- TAB 5: LEADERBOARD ---
          <div className="leaderboard-container">
            {roast && (
              <div className="glass-panel roast-card">
                <span className="roast-popcorn">🍿</span>
                <div className="roast-content">
                  <h3>Comentario Técnico</h3>
                  <div className="roast-text" dangerouslySetInnerHTML={{ __html: roast }} />
                </div>
              </div>
            )}

            {leaderboard.length > 0 && (
              <div className="podium">
                {leaderboard.length >= 2 && (
                  <div 
                    className="podium-step podium-2 clickable-step" 
                    onClick={() => {
                      if (leaderboard[1].telegram_id !== user.telegram_id) {
                        handleViewUserDashboard(leaderboard[1]);
                      }
                    }}
                  >
                    <div className="podium-user">
                      <div className="podium-medal">🥈</div>
                      <div className="podium-name">{leaderboard[1].full_name}</div>
                      <div className="podium-points">{leaderboard[1].points} pts</div>
                    </div>
                    <div className="podium-bar" style={{ height: "70px" }}>2</div>
                  </div>
                )}

                <div 
                  className="podium-step podium-1 clickable-step" 
                  onClick={() => {
                    if (leaderboard[0].telegram_id !== user.telegram_id) {
                      handleViewUserDashboard(leaderboard[0]);
                    }
                  }}
                >
                  <div className="podium-user">
                    <div className="podium-medal">🥇</div>
                    <div className="podium-name">{leaderboard[0].full_name}</div>
                    <div className="podium-points">{leaderboard[0].points} pts</div>
                  </div>
                  <div className="podium-bar" style={{ height: "100px" }}>1</div>
                </div>

                {leaderboard.length >= 3 && (
                  <div 
                    className="podium-step podium-3 clickable-step" 
                    onClick={() => {
                      if (leaderboard[2].telegram_id !== user.telegram_id) {
                        handleViewUserDashboard(leaderboard[2]);
                      }
                    }}
                  >
                    <div className="podium-user">
                      <div className="podium-medal">🥉</div>
                      <div className="podium-name">{leaderboard[2].full_name}</div>
                      <div className="podium-points">{leaderboard[2].points} pts</div>
                    </div>
                    <div className="podium-bar" style={{ height: "50px" }}>3</div>
                  </div>
                )}
              </div>
            )}

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
                      <tr 
                        key={u.id} 
                        className={`${isSelf ? "current-user" : ""} clickable-row`} 
                        onClick={() => {
                          if (!isSelf) {
                            handleViewUserDashboard(u);
                          }
                        }}
                      >
                        <td className="rank-cell">#{index + 1}</td>
                        <td>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span>
                              {u.full_name}
                              {u.username && (
                                <span className="username-tag">@{u.username}</span>
                              )}
                            </span>
                            {user?.telegram_id?.toLowerCase() === "educonsul" && !isSelf && (
                              <button
                                style={{
                                  padding: "0.2rem 0.5rem",
                                  fontSize: "0.75rem",
                                  background: "rgba(220, 38, 38, 0.15)",
                                  border: "1px solid rgba(220, 38, 38, 0.3)",
                                  color: "#f87171",
                                  borderRadius: "6px",
                                  cursor: "pointer",
                                  margin: 0,
                                  transition: "all 0.2s ease",
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = "rgba(220, 38, 38, 0.3)";
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = "rgba(220, 38, 38, 0.15)";
                                }}
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  if (window.confirm(`¿Seguro que quieres eliminar al usuario "${u.full_name}" y todos sus pronósticos? Esta acción no se puede deshacer.`)) {
                                    try {
                                      await api.deleteUser(u.id);
                                      await fetchLeaderboardData();
                                      alert("Usuario eliminado correctamente.");
                                    } catch (err: unknown) {
                                      const error = err as Error;
                                      alert(error.message || "Error al eliminar usuario.");
                                    }
                                  }
                                }}
                              >
                                ❌
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="points-cell">{u.points} pts</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* AI Daily Summaries Section */}
            <div className="glass-panel ai-summaries-panel ai-summaries-section">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: "1rem", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" }}>
                <h2 style={{ color: "var(--accent)", margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  📰 Crónicas Diarias de la IA
                </h2>
                {!viewingUser && (
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <input
                      type="date"
                      className="premium-input"
                      style={{ padding: "0.4rem 0.8rem", width: "auto", fontSize: "0.9rem", height: "38px" }}
                      value={summaryDateInput}
                      onChange={(e) => setSummaryDateInput(e.target.value)}
                    />
                    <button
                      className="premium-button"
                      style={{ padding: "0.45rem 1rem", fontSize: "0.9rem", margin: 0, height: "38px" }}
                      onClick={handleGenerateDailySummary}
                      disabled={isGeneratingSummary}
                    >
                      {isGeneratingSummary ? "Generando..." : "🤖 Redactar Crónica"}
                    </button>
                  </div>
                )}
              </div>

              {loadingSummaries ? (
                <p style={{ textAlign: "center", opacity: 0.7 }}>Cargando crónicas de la IA...</p>
              ) : dailySummaries.length === 0 ? (
                <div style={{ textAlign: "center", padding: "2rem", opacity: 0.6 }}>
                  <p>Aún no se ha redactado ninguna crónica diaria.</p>
                  <p style={{ fontSize: "0.85rem" }}>Selecciona una fecha arriba y pulsa "Redactar Crónica" para ver el análisis de la IA.</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                  {dailySummaries.map((s) => (
                    <article key={s.id} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "12px", padding: "1.5rem" }}>
                      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: "0.5rem" }}>
                        <span style={{ fontWeight: 600, color: "var(--accent)" }}>
                          📅 Jornada del {s.summary_date}
                        </span>
                        <span style={{ fontSize: "0.75rem", opacity: 0.5 }}>
                          Redactada el {new Date(s.created_at).toLocaleDateString()}
                        </span>
                      </header>
                      <div style={{ whiteSpace: "pre-wrap", fontSize: "0.95rem", lineHeight: "1.6", color: "var(--text-body)" }}>
                        {s.content}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>

        ) : (
          // --- TAB 6: RULES ---
          <div style={{ maxWidth: "800px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "2rem" }}>
            <div className="glass-panel rules-panel">
              <h2 style={{ color: "var(--accent)", marginBottom: "1.5rem", borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: "0.75rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                📜 Reglas de Puntuación
              </h2>
              <p style={{ opacity: 0.8, lineHeight: "1.6", marginBottom: "2rem" }}>
                Para que la porra sea competitiva y justa, los puntos se calculan automáticamente de acuerdo con el acierto de tus pronósticos en cada partido y apuestas especiales del torneo.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                <div style={{ borderLeft: "4px solid var(--success)", paddingLeft: "1rem" }}>
                  <h3 style={{ margin: "0 0 0.25rem 0", color: "var(--text-h)" }}>🌟 Acierto Exacto (+3 Puntos)</h3>
                  <p style={{ margin: 0, opacity: 0.8, fontSize: "0.9rem" }}>
                    Si aciertas el marcador exacto del partido (ejemplo: pronosticas 2-1 y el partido termina 2-1).
                  </p>
                </div>

                <div style={{ borderLeft: "4px solid var(--warning)", paddingLeft: "1rem" }}>
                  <h3 style={{ margin: "0 0 0.25rem 0", color: "var(--text-h)" }}>⚽ Acierto de Resultado (+1 Punto)</h3>
                  <p style={{ margin: 0, opacity: 0.8, fontSize: "0.9rem" }}>
                    Si aciertas qué equipo gana o si empatan, pero no el marcador exacto (ejemplo: pronosticas 3-0, el partido termina 1-0; o pronosticas 1-1, el partido termina 2-2).
                  </p>
                </div>

                <div style={{ borderLeft: "4px solid var(--danger)", paddingLeft: "1rem" }}>
                  <h3 style={{ margin: "0 0 0.25rem 0", color: "var(--text-h)" }}>❌ Pronóstico Fallado (0 Puntos)</h3>
                  <p style={{ margin: 0, opacity: 0.8, fontSize: "0.9rem" }}>
                    Si no aciertas ni el ganador ni el empate (ejemplo: pronosticas 1-0 y termina 1-2).
                  </p>
                </div>
              </div>

              <div style={{ marginTop: "2.5rem", borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: "1.5rem" }}>
                <h3 style={{ color: "var(--accent)", marginBottom: "1rem" }}>🔄 Reglas de Emparejamiento en Fases Eliminatorias</h3>
                <p style={{ opacity: 0.8, fontSize: "0.9rem", lineHeight: "1.6", margin: "0 0 1rem 0" }}>
                  En las eliminatorias, tus pronósticos se evalúan comparándolos con los partidos que realmente acaben ocurriendo en el Mundial real:
                </p>
                <ul style={{ paddingLeft: "1.25rem", margin: "0 0 1.5rem 0", fontSize: "0.9rem", opacity: 0.8, lineHeight: "1.8", listStyleType: "disc" }}>
                  <li>
                    <strong style={{ color: "#10b981" }}>✨ Partido Coincidente (100% de puntos):</strong> Ocurre si aciertas los dos equipos que juegan un partido en la <strong>misma ronda</strong>. 
                    Si los equipos están invertidos (ej. pronosticaste A-B y juegan B-A), los goles de tu pronóstico se invierten automáticamente para evaluarte.
                  </li>
                  <li>
                    <strong style={{ color: "#f59e0b" }}>⚠️ Partido Semicoincidente (50% de puntos):</strong> Ocurre si acertaste los dos equipos de un enfrentamiento real, pero en tu pronóstico dijiste que se enfrentarían en una <strong>ronda diferente</strong>. 
                    Se calcula tu acierto con inversión automática de marcador si aplica, y los puntos obtenidos (sea por resultado o marcador exacto) se multiplican por 0.5 (generando decimales).
                  </li>
                  <li>
                    <strong>❌ Desajuste de Equipos (0 puntos):</strong> Si en un partido real de fase final juegas con equipos distintos a los que pronosticaste (sea en ese partido o vía las reglas anteriores), no recibirás puntos por predecir el marcador de ese partido real.
                  </li>
                </ul>
              </div>

              <div style={{ marginTop: "2.5rem", borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: "1.5rem" }}>
                <h3 style={{ color: "var(--accent)", marginBottom: "1rem" }}>🏅 Puntos por Clasificación (Fases Eliminatorias)</h3>
                <p style={{ opacity: 0.8, fontSize: "0.9rem", lineHeight: "1.6", margin: "0 0 1rem 0" }}>
                  Además de los puntos por partido, sumas puntos por cada equipo que clasifiques correctamente a cada ronda del torneo (progresión de Fibonacci):
                </p>
                <ul style={{ paddingLeft: "1.25rem", margin: "0 0 1.5rem 0", fontSize: "0.9rem", opacity: 0.8, lineHeight: "1.8" }}>
                  <li>🚪 <strong>Clasificar a Dieciseisavos (1/16):</strong> +1 punto por equipo acertado</li>
                  <li>🏃 <strong>Clasificar a Octavos (1/8):</strong> +2 puntos por equipo acertado</li>
                  <li>🏆 <strong>Clasificar a Cuartos (1/4):</strong> +3 puntos por equipo acertado</li>
                  <li>🔥 <strong>Clasificar a Semifinales:</strong> +5 puntos por equipo acertado</li>
                  <li>👑 <strong>Clasificar a la Final (Finalistas):</strong> +8 puntos por equipo acertado</li>
                </ul>
              </div>

              <div style={{ marginTop: "1.5rem", borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: "1.5rem" }}>
                <h3 style={{ color: "var(--accent)", marginBottom: "1rem" }}>🎯 Apuestas Especiales del Torneo</h3>
                <p style={{ opacity: 0.8, fontSize: "0.9rem", lineHeight: "1.6", margin: "0 0 1rem 0" }}>
                  Las apuestas especiales se resolverán al finalizar el torneo y otorgarán puntos adicionales:
                </p>
                <ul style={{ paddingLeft: "1.25rem", margin: 0, fontSize: "0.9rem", opacity: 0.8, lineHeight: "1.8" }}>
                  <li>🏆 <strong>Campeón del Mundo:</strong> +10 puntos</li>
                  <li>🥈 <strong>Subcampeón del Mundo:</strong> +5 puntos</li>
                  <li>🔥 <strong>Máximo Goleador (Bota de Oro):</strong> +5 puntos</li>
                  <li>🧤 <strong>Mejor Portero (Guante de Oro):</strong> +5 puntos</li>
                  <li>⭐ <strong>Equipo Revelación:</strong> +5 puntos</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modal Overlay for viewing other users' predictions */}
      {hasUnsavedDrafts && (
        <button onClick={handleSaveAllDrafts} className="floating-save-btn">
          💾 Guardar Cambios
        </button>
      )}
    </>
  );
}

export default App;
