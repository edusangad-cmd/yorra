import React, { useEffect, useState, useMemo } from "react";
import { api } from "./services/api";
import type { Match, Prediction, User, LeaderboardUser, TournamentPrediction } from "./services/api";

const ALL_TEAMS_ES = [
  "Alemania", "Arabia Saudí", "Argelia", "Argentina", "Australia", "Austria", "Bélgica", 
  "Bosnia y Herzegovina", "Brasil", "Cabo Verde", "Canadá", "Catar", "Chequia", "Colombia", 
  "Corea del Sur", "Costa de Marfil", "Croacia", "Curazao", "Ecuador", "Egipto", "Escocia", 
  "España", "Estados Unidos", "Francia", "Ghana", "Haití", "Inglaterra", "Irán", "Irak", 
  "Italia", "Japón", "Jordania", "Marruecos", "México", "Noruega", "Nueva Zelanda", "Países Bajos", 
  "Panamá", "Paraguay", "Portugal", "República Democrática del Congo", "Senegal", "Sudáfrica", 
  "Suecia", "Suiza", "Túnez", "Turquía", "Uruguay", "Uzbekistán"
].sort();

const TOP_PLAYERS = [
  "Kylian Mbappé (Francia)",
  "Erling Haaland (Noruega)",
  "Robert Lewandowski (Polonia)",
  "Harry Kane (Inglaterra)",
  "Vinícius Jr (Brasil)",
  "Lionel Messi (Argentina)",
  "Jude Bellingham (Inglaterra)",
  "Jamal Musiala (Alemania)",
  "Florian Wirtz (Alemania)",
  "Lamine Yamal (España)",
  "Nico Williams (España)",
  "Lautaro Martínez (Argentina)",
  "Cristiano Ronaldo (Portugal)",
  "Mohamed Salah (Egipto)",
  "Phil Foden (Inglaterra)",
  "Rodrygo Goes (Brasil)"
].sort();

function getFlagEmoji(teamName: string): string {
  const flags: Record<string, string> = {
    Spain: "🇪🇸", España: "🇪🇸",
    Germany: "🇩🇪", Alemania: "🇩🇪",
    Brazil: "🇧🇷", Brasil: "🇧🇷",
    Argentina: "🇦🇷",
    France: "🇫🇷", Francia: "🇫🇷",
    Italy: "🇮🇹", Italia: "🇮🇹",
    England: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", Inglaterra: "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
    Portugal: "🇵🇹",
    Netherlands: "🇳🇱", "Países Bajos": "🇳🇱",
    Uruguay: "🇺🇾",
    Mexico: "🇲🇽", México: "🇲🇽",
    USA: "🇺🇸", "Estados Unidos": "🇺🇸",
    Canada: "🇨🇦", Canadá: "🇨🇦",
    Morocco: "🇲🇦", Marruecos: "🇲🇦",
    Croatia: "🇭🇷", Croacia: "🇭🇷",
    Japan: "🇯🇵", Japón: "🇯🇵",
    Belgium: "🇧🇪", Bélgica: "🇧🇪",
    Senegal: "🇸🇳", Sudáfrica: "🇿🇦",
    "South Africa": "🇿🇦", Qatar: "🇶🇦",
    Catar: "🇶🇦", Switzerland: "🇨🇭",
    Suiza: "🇨🇭", Czechia: "🇨🇿",
    Chequia: "🇨🇿", "República Checa": "🇨🇿",
    "Bosnia and Herzegovina": "🇧🇦", "Bosnia y Herzegovina": "🇧🇦",
    Paraguay: "🇵🇾", Scotland: "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
    Escocia: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", Turkey: "🇹🇷",
    Turquía: "🇹🇷", Australia: "🇦🇺",
    Haiti: "🇭🇹", Haití: "🇭🇹"
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
    surprise_team: null,
  });
  const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>([]);
  const [roast, setRoast] = useState<string>("");

  // UI States
  const [loginInput, setLoginInput] = useState<string>("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"matches" | "bracket" | "standings" | "sidebets" | "leaderboard">("matches");
  const [matchSubTab, setMatchSubTab] = useState<"groups" | "knockouts">("groups");
  
  const [loading, setLoading] = useState<boolean>(() => {
    const { telegram_id } = api.getCurrentUser();
    return !!telegram_id;
  });

  const [savingTournament, setSavingTournament] = useState<boolean>(false);
  const [isSimulatingAll, setIsSimulatingAll] = useState<boolean>(false);

  // Form Drafts & Loaders
  const [editingScores, setEditingScores] = useState<Record<number, { home: string; away: string }>>({});
  const [actionLoading, setActionLoading] = useState<Record<number, boolean>>({});

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [matchesList, predsList, tourPreds] = await Promise.all([
        api.getMatches(),
        api.getPredictions(),
        api.getTournamentPredictions().catch(() => ({
          champion: null,
          runner_up: null,
          top_scorer: null,
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
    } else {
      fetchDashboardData().catch(console.error);
    }
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

  const handleSaveAllDrafts = async () => {
    const modifiedMatchIds = matches.filter((m) => {
      const matchDateObj = new Date(m.date);
      const isStarted = matchDateObj <= new Date();
      const hasFinished = m.home_score !== null && m.away_score !== null;
      if (isStarted || hasFinished) return false;

      const draft = editingScores[m.id];
      const pred = predictions[m.id];
      if (!draft || draft.home === "" || draft.away === "") return false;

      return (
        draft.home !== (pred ? String(pred.home_score) : "") ||
        draft.away !== (pred ? String(pred.away_score) : "")
      );
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
        await api.placePrediction(matchId, homeScore, awayScore);
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
      const hasFinished = m.home_score !== null && m.away_score !== null;

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

  // Standings & Bracket Calculations
  const { standings, resolvedBracket } = useMemo(() => {
    // 1. Calculate Group Standings
    const groupStandings: Record<string, Record<string, TeamStanding>> = {};
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
      }
    });

    matches.forEach((m) => {
      if (m.stage === "group" && m.group) {
        const g = m.group;
        let homeGoals: number | null = null;
        let awayGoals: number | null = null;

        const pred = predictions[m.id];
        if (m.home_score !== null && m.away_score !== null) {
          homeGoals = m.home_score;
          awayGoals = m.away_score;
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

    // 2. Resolve Bracket
    const group1st: Record<string, string> = {};
    const group2nd: Record<string, string> = {};
    const group3rdList: { group: string; team: string; points: number; goalDiff: number; goalsFor: number }[] = [];

    Object.entries(sortedStandings).forEach(([g, list]) => {
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
    });

    const sorted3rd = [...group3rdList].sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
      if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
      return a.group.localeCompare(b.group);
    });

    const qualified3rdGroups = new Set(sorted3rd.slice(0, 8).map((x) => x.group));
    const resolved: Record<number, { home: string; away: string }> = {};

    matches.forEach((m) => {
      if (m.stage === "group") {
        resolved[m.id] = { home: m.home_team, away: m.away_team };
      }
    });

    const getWinner = (matchId: number): string => {
      const m = matches.find((x) => x.id === matchId);
      if (!m) return `Ganador Partido ${matchId}`;

      if (m.home_score !== null && m.away_score !== null) {
        if (m.home_score > m.away_score) return m.home_team;
        if (m.home_score < m.away_score) return m.away_team;
        return m.home_team;
      }

      const pred = predictions[matchId];
      if (pred) {
        if (pred.home_score > pred.away_score) {
          return resolved[matchId]?.home || m.home_team;
        }
        if (pred.home_score < pred.away_score) {
          return resolved[matchId]?.away || m.away_team;
        }
      }
      return `Ganador Partido ${matchId}`;
    };

    const getLoser = (matchId: number): string => {
      const m = matches.find((x) => x.id === matchId);
      if (!m) return `Perdedor Partido ${matchId}`;

      if (m.home_score !== null && m.away_score !== null) {
        if (m.home_score > m.away_score) return m.away_team;
        if (m.home_score < m.away_score) return m.home_team;
        return m.away_team;
      }

      const pred = predictions[matchId];
      if (pred) {
        if (pred.home_score > pred.away_score) {
          return resolved[matchId]?.away || m.away_team;
        }
        if (pred.home_score < pred.away_score) {
          return resolved[matchId]?.home || m.home_team;
        }
      }
      return `Perdedor Partido ${matchId}`;
    };

    const assigned3rdGroups = new Set<string>();
    const assign3rdTeam = (allowedGroups: string[]): string => {
      for (const item of sorted3rd) {
        if (allowedGroups.includes(item.group) && qualified3rdGroups.has(item.group) && !assigned3rdGroups.has(item.group)) {
          assigned3rdGroups.add(item.group);
          return item.team;
        }
      }
      for (const item of sorted3rd) {
        if (allowedGroups.includes(item.group) && !assigned3rdGroups.has(item.group)) {
          assigned3rdGroups.add(item.group);
          return item.team;
        }
      }
      return `3º Grupo ${allowedGroups.join("/")}`;
    };

    // Dieciseisavos (Match 73 to 88)
    resolved[73] = { home: group2nd["A"] || "2º Grupo A", away: group2nd["B"] || "2º Grupo B" };
    resolved[74] = { home: group1st["E"] || "1º Grupo E", away: assign3rdTeam(["A", "B", "C", "D", "F"]) };
    resolved[75] = { home: group1st["F"] || "1º Grupo F", away: group2nd["C"] || "2º Grupo C" };
    resolved[76] = { home: group1st["C"] || "1º Grupo C", away: group2nd["F"] || "2º Grupo F" };
    resolved[77] = { home: group1st["I"] || "1º Grupo I", away: assign3rdTeam(["C", "D", "F", "G", "H"]) };
    resolved[78] = { home: group2nd["E"] || "2º Grupo E", away: group2nd["I"] || "2º Grupo I" };
    resolved[79] = { home: group1st["A"] || "1º Grupo A", away: assign3rdTeam(["C", "E", "F", "H", "I"]) };
    resolved[80] = { home: group1st["L"] || "1º Grupo L", away: assign3rdTeam(["E", "H", "I", "J", "K"]) };
    resolved[81] = { home: group1st["D"] || "1º Grupo D", away: assign3rdTeam(["B", "E", "F", "I", "J"]) };
    resolved[82] = { home: group1st["G"] || "1º Grupo G", away: assign3rdTeam(["A", "E", "H", "I", "J"]) };
    resolved[83] = { home: group2nd["K"] || "2º Grupo K", away: group2nd["L"] || "2º Grupo L" };
    resolved[84] = { home: group1st["H"] || "1º Grupo H", away: group2nd["J"] || "2º Grupo J" };
    resolved[85] = { home: group1st["B"] || "1º Grupo B", away: assign3rdTeam(["E", "F", "G", "I", "J"]) };
    resolved[86] = { home: group1st["J"] || "1º Grupo J", away: group2nd["H"] || "2º Grupo H" };
    resolved[87] = { home: group1st["K"] || "1º Grupo K", away: assign3rdTeam(["D", "E", "I", "J", "L"]) };
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

    return { standings: sortedStandings, resolvedBracket: resolved };
  }, [matches, predictions]);

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

  // Group Knockout Matches by Stage
  const knockoutMatches = useMemo(() => {
    const stages: Record<string, { label: string; items: Match[] }> = {
      r32: { label: "Dieciseisavos de Final (1/16)", items: [] },
      r16: { label: "Octavos de Final (1/8)", items: [] },
      qf: { label: "Cuartos de Final (1/4)", items: [] },
      sf: { label: "Semifinales", items: [] },
      third: { label: "Tercer Puesto", items: [] },
      final: { label: "Gran Final", items: [] },
    };

    matches.forEach((m) => {
      if (m.stage && stages[m.stage]) {
        stages[m.stage].items.push(m);
      }
    });

    return Object.entries(stages)
      .filter(([, data]) => data.items.length > 0)
      .map(([key, data]) => ({
        key,
        label: data.label,
        items: data.items.sort((a, b) => a.id - b.id),
      }));
  }, [matches]);

  // Render match card helper
  const renderMatchCard = (m: Match) => {
    const pred = predictions[m.id];
    const draft = editingScores[m.id] || { home: "", away: "" };
    const isSaving = actionLoading[m.id] || false;

    const matchDateObj = new Date(m.date);
    const isStarted = matchDateObj <= new Date();
    const hasFinished = m.home_score !== null && m.away_score !== null;

    // Resolve dynamic team names from bracket calculations
    const homeResolved = resolvedBracket[m.id]?.home || m.home_team;
    const awayResolved = resolvedBracket[m.id]?.away || m.away_team;

    const homeFlag = getFlagEmoji(homeResolved);
    const awayFlag = getFlagEmoji(awayResolved);

    const isModified =
      draft.home !== (pred ? String(pred.home_score) : "") ||
      draft.away !== (pred ? String(pred.away_score) : "");

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

        <div className="match-card-body">
          <div className="team">
            <span className="team-flag">{homeFlag}</span>
            <span className="team-name">{homeResolved}</span>
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
            <span className="team-name">{awayResolved}</span>
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

  // --- LOGIN VIEW ---
  if (!user) {
    return (
      <div className="auth-wrapper">
        <div className="glass-panel auth-card">
          <span className="auth-logo">🏆</span>
          <h1>Porra Mundial 2026</h1>
          <p>Introduce tu usuario o ID de Telegram para acceder</p>

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
        
        <div className="header-actions">
          <button onClick={handleSaveAllDrafts} className="btn-save-all-drafts">
            💾 Guardar Todo
          </button>
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

      {/* Control Panel Toolbar */}
      <div className="glass-panel control-toolbar" style={{ margin: "1rem 2rem", padding: "0.75rem 1.5rem", borderRadius: "12px", display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontWeight: 600, color: "var(--accent)" }}>🛠️ Herramientas de Prueba:</span>
        <button onClick={handleSimulateMyPredictions} className="btn-save-pred" style={{ background: "rgba(139, 92, 246, 0.2)", color: "#c084fc", border: "1px solid rgba(139, 92, 246, 0.4)" }}>
          🎲 Simular mis Pronósticos
        </button>
        <button onClick={handleSimulateRealScores} className="btn-save-pred" style={{ background: "rgba(239, 68, 68, 0.2)", color: "#f87171", border: "1px solid rgba(239, 68, 68, 0.4)" }} disabled={isSimulatingAll}>
          {isSimulatingAll ? "Simulando..." : "🎲 Simular Resultados Reales (Admin)"}
        </button>
      </div>

      {/* Tabs Navigation */}
      <nav className="tab-nav">
        <button
          onClick={() => setActiveTab("matches")}
          className={`tab-btn ${activeTab === "matches" ? "active" : ""}`}
        >
          Partidos y Pronósticos
        </button>
        <button
          onClick={() => setActiveTab("bracket")}
          className={`tab-btn ${activeTab === "bracket" ? "active" : ""}`}
        >
          El Cuadro (Bracket)
        </button>
        <button
          onClick={() => setActiveTab("standings")}
          className={`tab-btn ${activeTab === "standings" ? "active" : ""}`}
        >
          Posiciones de Grupos
        </button>
        <button
          onClick={() => setActiveTab("sidebets")}
          className={`tab-btn ${activeTab === "sidebets" ? "active" : ""}`}
        >
          Apuestas Especiales
        </button>
        <button
          onClick={() => setActiveTab("leaderboard")}
          className={`tab-btn ${activeTab === "leaderboard" ? "active" : ""}`}
        >
          Clasificación General
        </button>
      </nav>

      {/* Main Tab Content */}
      <main style={{ flex: 1, padding: "0 2rem 2rem 2rem" }}>
        {loading && activeTab !== "matches" ? (
          <div style={{ textAlign: "center", padding: "3rem" }}>
            <h2>Cargando contenido...</h2>
          </div>
        ) : activeTab === "matches" ? (
          // --- TAB 1: MATCHES ---
          <div>
            <div className="matches-nav-tabs" style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem" }}>
              <button
                onClick={() => setMatchSubTab("groups")}
                className={`tab-btn ${matchSubTab === "groups" ? "active" : ""}`}
                style={{ fontSize: "0.9rem", padding: "0.5rem 1rem" }}
              >
                Fase de Grupos (A - L)
              </button>
              <button
                onClick={() => setMatchSubTab("knockouts")}
                className={`tab-btn ${matchSubTab === "knockouts" ? "active" : ""}`}
                style={{ fontSize: "0.9rem", padding: "0.5rem 1rem" }}
              >
                Fases Eliminatorias
              </button>
            </div>

            {matchSubTab === "groups" ? (
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
            ) : (
              <div className="knockouts-container" style={{ display: "flex", flexDirection: "column", gap: "2.5rem" }}>
                {knockoutMatches.map((stage) => (
                  <section key={stage.key} className="date-section" style={{ borderLeft: "4px solid #10b981", paddingLeft: "1rem" }}>
                    <h2 className="date-header" style={{ marginBottom: "1rem" }}>{stage.label}</h2>
                    <div className="matches-grid">
                      {stage.items.map(renderMatchCard)}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>
        ) : activeTab === "bracket" ? (
          // --- TAB 2: BRACKET ---
          <div className="bracket-wrapper" style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
            <div className="glass-panel" style={{ padding: "1.5rem", borderRadius: "12px" }}>
              <h2 style={{ color: "var(--accent)", marginBottom: "0.5rem" }}>📊 Simulador del Cuadro de Fase Final</h2>
              <p style={{ opacity: 0.8 }}>A continuación puedes ver cómo irían avanzando tus equipos de forma automática a medida que rellenas tus predicciones en la fase anterior:</p>
            </div>
            {knockoutMatches.map((stage) => (
              <section key={stage.key} className="date-section" style={{ borderLeft: "4px solid var(--accent)", paddingLeft: "1rem" }}>
                <h3 className="date-header" style={{ marginBottom: "1.5rem" }}>{stage.label}</h3>
                <div className="matches-grid">
                  {stage.items.map((m) => {
                    const homeResolved = resolvedBracket[m.id]?.home || m.home_team;
                    const awayResolved = resolvedBracket[m.id]?.away || m.away_team;
                    const homeFlag = getFlagEmoji(homeResolved);
                    const awayFlag = getFlagEmoji(awayResolved);
                    
                    const pred = predictions[m.id];
                    const hasFinished = m.home_score !== null && m.away_score !== null;

                    return (
                      <div key={m.id} className="glass-panel match-card" style={{ background: "rgba(15, 23, 42, 0.65)", borderColor: "rgba(255,255,255,0.08)" }}>
                        <div style={{ fontSize: "0.8rem", opacity: 0.6, marginBottom: "0.5rem" }}>Partido #{m.id}</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontWeight: 500 }}><span style={{ marginRight: "0.5rem" }}>{homeFlag}</span>{homeResolved}</span>
                            <span style={{ fontWeight: "bold" }}>
                              {hasFinished ? m.home_score : (pred ? pred.home_score : "-")}
                            </span>
                          </div>
                          <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", height: "1px" }}></div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontWeight: 500 }}><span style={{ marginRight: "0.5rem" }}>{awayFlag}</span>{awayResolved}</span>
                            <span style={{ fontWeight: "bold" }}>
                              {hasFinished ? m.away_score : (pred ? pred.away_score : "-")}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        ) : activeTab === "standings" ? (
          // --- TAB 3: STANDINGS ---
          <div className="standings-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "2rem" }}>
            {Object.entries(standings).sort((a, b) => a[0].localeCompare(b[0])).map(([g, list]) => (
              <div key={g} className="glass-panel" style={{ padding: "1.25rem", borderRadius: "12px" }}>
                <h3 style={{ color: "var(--accent)", marginBottom: "1rem", borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: "0.5rem" }}>Grupo {g}</h3>
                <table style={{ width: "100%", fontSize: "0.85rem", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ opacity: 0.6, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                      <th style={{ textAlign: "left", paddingBottom: "0.5rem" }}>Equipo</th>
                      <th style={{ textAlign: "center", paddingBottom: "0.5rem" }}>PJ</th>
                      <th style={{ textAlign: "center", paddingBottom: "0.5rem" }}>DG</th>
                      <th style={{ textAlign: "right", paddingBottom: "0.5rem" }}>Pts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((t, idx) => (
                      <tr key={t.team} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)", fontWeight: idx < 2 ? 600 : 400 }}>
                        <td style={{ padding: "0.5rem 0", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <span style={{ fontSize: "0.75rem", opacity: 0.5 }}>#{idx+1}</span>
                          <span>{getFlagEmoji(t.team)} {t.team}</span>
                        </td>
                        <td style={{ textAlign: "center", padding: "0.5rem 0" }}>{t.played}</td>
                        <td style={{ textAlign: "center", padding: "0.5rem 0", color: t.goalDiff > 0 ? "#10b981" : (t.goalDiff < 0 ? "#ef4444" : "inherit") }}>{t.goalDiff > 0 ? `+${t.goalDiff}` : t.goalDiff}</td>
                        <td style={{ textAlign: "right", padding: "0.5rem 0", color: idx < 2 ? "var(--accent)" : "inherit" }}>{t.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        ) : activeTab === "sidebets" ? (
          // --- TAB 4: SIDEBETS ---
          <div style={{ maxWidth: "600px", margin: "0 auto" }}>
            <div className="glass-panel" style={{ padding: "2rem", borderRadius: "16px" }}>
              <h2 style={{ color: "var(--accent)", marginBottom: "1.5rem", borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: "0.75rem" }}>🎯 Apuestas Especiales del Torneo</h2>
              <p style={{ fontSize: "0.9rem", opacity: 0.8, marginBottom: "2rem" }}>Elige tus favoritos para los premios especiales de la porra. ¡Rellena tus candidatos en cada desplegable y guarda los cambios!</p>

              <div className="input-group" style={{ marginBottom: "1.5rem" }}>
                <label className="input-label">🏆 Campeón del Mundo</label>
                <select
                  className="premium-input"
                  style={{ background: "rgba(15, 23, 42, 0.8)", cursor: "pointer" }}
                  value={tournamentPredictions.champion || ""}
                  onChange={(e) => setTournamentPredictions(prev => ({ ...prev, champion: e.target.value || null }))}
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
                  style={{ background: "rgba(15, 23, 42, 0.8)", cursor: "pointer" }}
                  value={tournamentPredictions.runner_up || ""}
                  onChange={(e) => setTournamentPredictions(prev => ({ ...prev, runner_up: e.target.value || null }))}
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
                  style={{ background: "rgba(15, 23, 42, 0.8)", cursor: "pointer" }}
                  value={tournamentPredictions.top_scorer || ""}
                  onChange={(e) => setTournamentPredictions(prev => ({ ...prev, top_scorer: e.target.value || null }))}
                >
                  <option value="">-- Elige un jugador --</option>
                  {TOP_PLAYERS.map(player => (
                    <option key={player} value={player}>⚽ {player}</option>
                  ))}
                </select>
              </div>

              <div className="input-group" style={{ marginBottom: "2rem" }}>
                <label className="input-label">⭐ Equipo Revelación</label>
                <select
                  className="premium-input"
                  style={{ background: "rgba(15, 23, 42, 0.8)", cursor: "pointer" }}
                  value={tournamentPredictions.surprise_team || ""}
                  onChange={(e) => setTournamentPredictions(prev => ({ ...prev, surprise_team: e.target.value || null }))}
                >
                  <option value="">-- Elige un país --</option>
                  {ALL_TEAMS_ES.map(team => (
                    <option key={team} value={team}>{getFlagEmoji(team)} {team}</option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleSaveTournamentPredictions}
                className="premium-button"
                disabled={savingTournament}
              >
                {savingTournament ? "Guardando apuestas..." : "💾 Guardar Apuestas Especiales"}
              </button>
            </div>
          </div>
        ) : (
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
                  <div className="podium-step podium-2">
                    <div className="podium-user">
                      <div className="podium-medal">🥈</div>
                      <div className="podium-name">{leaderboard[1].full_name}</div>
                      <div className="podium-points">{leaderboard[1].points} pts</div>
                    </div>
                    <div className="podium-bar" style={{ height: "70px" }}>2</div>
                  </div>
                )}

                <div className="podium-step podium-1">
                  <div className="podium-user">
                    <div className="podium-medal">🥇</div>
                    <div className="podium-name">{leaderboard[0].full_name}</div>
                    <div className="podium-points">{leaderboard[0].points} pts</div>
                  </div>
                  <div className="podium-bar" style={{ height: "100px" }}>1</div>
                </div>

                {leaderboard.length >= 3 && (
                  <div className="podium-step podium-3">
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
