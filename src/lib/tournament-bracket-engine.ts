import {
  TournamentFighter,
  TournamentMatch,
  TournamentPool,
  TournamentState,
} from "./tournament-bracket-types";

export const DEFAULT_ROSTER_POOL_A: TournamentFighter[] = [
  { id: "a1", name: "FACHRUL ANAM", dojo: "Dojo Rajawali Surabaya" },
  { id: "a2", name: "BINTANG KSATRIA AJI", dojo: "Dojo Macan Putih" },
  { id: "a3", name: "DZAKYAH FACHRIZHA", dojo: "Dojo Patriot INKAI" },
  { id: "a4", name: "KENZIE AR SAKHA", dojo: "Dojo Brawijaya" },
  { id: "a5", name: "AUDRYA ZERRIN ANDIKA", dojo: "Dojo Ksatria INKAI" },
  { id: "a6", name: "RANDITO NAVARENO", dojo: "Dojo Garuda Sakti" },
  { id: "a7", name: "M. ARKA FIRMANSYAH", dojo: "Dojo Lemkari Rungkut" },
  { id: "a8", name: "RAYHAN KURNIAWAN", dojo: "Dojo Singo Menggolo" },
  { id: "a9", name: "SULTAN ALIF MAULANA", dojo: "Dojo Gajah Mada SBY" },
  { id: "a10", name: "ADITYA BAGUS PRATAMA", dojo: "Dojo Kusuma Bangsa" },
  { id: "a11", name: "DIMAS SATRIA WIBAWA", dojo: "Dojo Tunas Muda" },
  { id: "a12", name: "FARHAN NAUFAL HADI", dojo: "Dojo Samudra INKAI" },
  { id: "a13", name: "KALEB RIZKY PRASETYO", dojo: "Dojo Bhayangkara" },
  { id: "a14", name: "ZULFIKAR ARYASUTA", dojo: "Dojo Cakra Buana" },
  { id: "a15", name: "GIBRAN ALTHAF RAFIF", dojo: "Dojo Mahameru" },
  { id: "a16", name: "NAUFAL AZZAM DZAKY", dojo: "Dojo Satria Utama" },
];

export const DEFAULT_ROSTER_POOL_B: TournamentFighter[] = [
  { id: "b1", name: "ALVINO PUTRA PRATAMA", dojo: "Dojo Ksatria Madya" },
  { id: "b2", name: "RAKHA ATHARIZZ", dojo: "Dojo Elang Jawa SBY" },
  { id: "b3", name: "DEWA BRATA WIRANATA", dojo: "Dojo Bimasakti" },
  { id: "b4", name: "HAFIDZ NUR HIDAYAT", dojo: "Dojo Harimau Suroboyo" },
  { id: "b5", name: "IBRAHIM DANISWARA", dojo: "Dojo Satria Pandawa" },
  { id: "b6", name: "JASON MATTHEW SURYA", dojo: "Dojo Naga Hitam" },
  { id: "b7", name: "KEVIN ANANTA KUSUMA", dojo: "Dojo Macan Kumbang" },
  { id: "b8", name: "LINTANG ARYA SETA", dojo: "Dojo Singa Putih" },
  { id: "b9", name: "MALIK ABDUL RASYID", dojo: "Dojo Ronggolawe" },
  { id: "b10", name: "NATHAN EZEKIEL TAN", dojo: "Dojo Wira Bhakti" },
  { id: "b11", name: "PRABU DANU SENTANA", dojo: "Dojo Tri Dharma" },
  { id: "b12", name: "RADITYA ARSENIO", dojo: "Dojo Brawijaya Sakti" },
  { id: "b13", name: "SYAILENDRA BUMI", dojo: "Dojo Pendawa Lima" },
  { id: "b14", name: "TEGAR SURYA KENCANA", dojo: "Dojo Ksatria Mandiri" },
  { id: "b15", name: "VITO CORNELIUS", dojo: "Dojo Sinar Harapan" },
  { id: "b16", name: "YOHANES BAGAS PAMUNGKAS", dojo: "Dojo Taruna INKAI" },
];

export function buildPoolRounds(
  pool: TournamentPool,
  initialFighters: TournamentFighter[] | null = null
): TournamentPool {
  const count = parseInt(String(pool.participantCount), 10) || 12;
  let bracketSize = 16;
  if (count <= 4) bracketSize = 4;
  else if (count <= 8) bracketSize = 8;
  else if (count <= 16) bracketSize = 16;
  else bracketSize = 32;

  pool.bracketSize = bracketSize;
  const numRounds = Math.log2(bracketSize);
  const numInitialMatches = bracketSize / 2;

  const roundNames: string[] = [];
  if (bracketSize === 4) {
    roundNames.push("Semifinal", `Final ${pool.name}`);
  } else if (bracketSize === 8) {
    roundNames.push("Perempat Final (8 Besar)", "Semifinal", `Final ${pool.name}`);
  } else if (bracketSize === 16) {
    roundNames.push("Babak 16 Besar", "Perempat Final (8 Besar)", "Semifinal", `Final ${pool.name}`);
  } else if (bracketSize === 32) {
    roundNames.push("Babak 32 Besar", "Babak 16 Besar", "Perempat Final", "Semifinal", `Final ${pool.name}`);
  }

  // WKF standard bye positions
  const byesCount = bracketSize - count;
  const byeSlots = new Set<string>();
  if (byesCount > 0) {
    if (byesCount >= 1) byeSlots.add("0_ao");
    if (byesCount >= 2) byeSlots.add(`${numInitialMatches - 1}_aka`);
    if (byesCount >= 3) byeSlots.add(`${Math.floor(numInitialMatches / 2)}_ao`);
    if (byesCount >= 4) byeSlots.add(`${Math.floor(numInitialMatches / 2) - 1}_aka`);

    let currMatch = 1;
    while (byeSlots.size < byesCount && currMatch < numInitialMatches) {
      if (!byeSlots.has(`${currMatch}_ao`)) byeSlots.add(`${currMatch}_ao`);
      if (byeSlots.size < byesCount && !byeSlots.has(`${currMatch}_aka`)) byeSlots.add(`${currMatch}_aka`);
      currMatch++;
    }
  }

  const defaultPoolSource = pool.id === "pool_b" ? DEFAULT_ROSTER_POOL_B : DEFAULT_ROSTER_POOL_A;
  const availableFighters = initialFighters && initialFighters.length > 0 ? [...initialFighters] : [...defaultPoolSource];

  const round0: TournamentMatch[] = [];
  let matchBaseNumber = (pool.tatami || 1) * 100 + 1;
  let fighterCursor = 0;

  for (let m = 0; m < numInitialMatches; m++) {
    const isAkaBye = byeSlots.has(`${m}_aka`);
    const isAoBye = byeSlots.has(`${m}_ao`);

    let akaFighter: TournamentFighter | null = null;
    if (isAkaBye) {
      akaFighter = { name: "BYE", dojo: "Lolos Otomatis", isBye: true, score: 0 };
    } else if (fighterCursor < availableFighters.length) {
      akaFighter = { ...availableFighters[fighterCursor++], score: 0 };
    } else {
      akaFighter = { name: `Peserta ${m * 2 + 1}`, dojo: "Kontingen WKF", score: 0 };
    }

    let aoFighter: TournamentFighter | null = null;
    if (isAoBye) {
      aoFighter = { name: "BYE", dojo: "Lolos Otomatis", isBye: true, score: 0 };
    } else if (fighterCursor < availableFighters.length) {
      aoFighter = { ...availableFighters[fighterCursor++], score: 0 };
    } else {
      aoFighter = { name: `Peserta ${m * 2 + 2}`, dojo: "Kontingen WKF", score: 0 };
    }

    let winner: "aka" | "ao" | null = null;
    if (isAoBye && !isAkaBye) winner = "aka";
    else if (isAkaBye && !isAoBye) winner = "ao";

    round0.push({
      id: `${pool.id}_r0_m${m}`,
      number: matchBaseNumber++,
      roundName: roundNames[0],
      aka: akaFighter,
      ao: aoFighter,
      winner,
      status: winner ? "COMPLETED" : "PENDING",
    });
  }

  const rounds: TournamentMatch[][] = [round0];
  for (let r = 1; r < numRounds; r++) {
    const prevRound = rounds[r - 1];
    const currentRoundMatches: TournamentMatch[] = [];
    const currentMatchCount = prevRound.length / 2;

    for (let m = 0; m < currentMatchCount; m++) {
      const matchA = prevRound[m * 2];
      const matchB = prevRound[m * 2 + 1];

      let akaFighter: TournamentFighter | null = null;
      if (matchA && matchA.winner) {
        const winnerFighter = matchA[matchA.winner];
        if (winnerFighter && !winnerFighter.isBye) {
          akaFighter = { ...winnerFighter, score: 0 };
        }
      }

      let aoFighter: TournamentFighter | null = null;
      if (matchB && matchB.winner) {
        const winnerFighter = matchB[matchB.winner];
        if (winnerFighter && !winnerFighter.isBye) {
          aoFighter = { ...winnerFighter, score: 0 };
        }
      }

      currentRoundMatches.push({
        id: `${pool.id}_r${r}_m${m}`,
        number: matchBaseNumber++,
        roundName: roundNames[r] || `Babak ${r + 1}`,
        aka: akaFighter,
        ao: aoFighter,
        winner: null,
        status: "PENDING",
      });
    }
    rounds.push(currentRoundMatches);
  }

  pool.rounds = rounds;
  pool.champion = null;
  return pool;
}

export function getInitialTournamentState(categoryName = "Kumite Senior Putra -67kg"): TournamentState {
  const poolA: TournamentPool = {
    id: "pool_a",
    name: "Pool A",
    tatami: 1,
    participantCount: 12,
    bracketSize: 16,
    rounds: [],
    roster: DEFAULT_ROSTER_POOL_A.slice(12),
  };
  const poolB: TournamentPool = {
    id: "pool_b",
    name: "Pool B",
    tatami: 2,
    participantCount: 12,
    bracketSize: 16,
    rounds: [],
    roster: DEFAULT_ROSTER_POOL_B.slice(12),
  };

  buildPoolRounds(poolA, DEFAULT_ROSTER_POOL_A.slice(0, 12));
  buildPoolRounds(poolB, DEFAULT_ROSTER_POOL_B.slice(0, 12));

  return {
    category: categoryName,
    activePoolId: "pool_a",
    pools: {
      pool_a: poolA,
      pool_b: poolB,
    },
    championshipFinal: {
      id: "championship_final",
      name: "Bagan Final Antar-Pool",
      matches: [
        {
          id: "final-gold",
          number: 301,
          title: "CHAMPIONSHIP FINAL (EMAS & PERAK)",
          roundName: "Grand Final",
          aka: null,
          ao: null,
          winner: null,
          status: "PENDING",
        },
        {
          id: "final-bronze",
          number: 302,
          title: "PEREBUTAN MEDALI PERUNGGU (BRONZE)",
          roundName: "Perebutan Juara 3",
          aka: null,
          ao: null,
          winner: null,
          status: "PENDING",
        },
      ],
    },
  };
}

// Generate Print-Ready F4 Landscape Sheet HTML
export function generateF4BracketSheetHTML(
  state: TournamentState,
  includeScores = true,
  tournamentTitle = "KEJUARAAN KOTA INKAI SURABAYA 2026"
): string {
  const isFinal = state.activePoolId === "championship_final";
  const pool = isFinal ? null : state.pools[state.activePoolId];
  const category = state.category || "Kumite Senior Putra -67kg";
  const now = new Date();
  const dateStr = now.toLocaleDateString("id-ID", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const timeStr =
    now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) + " WIB";

  let poolTitle = "";
  let tatamiLabel = "";
  let participantLabel = "";
  let roundsHtml = "";

  if (isFinal) {
    poolTitle = "BAGAN GRAND FINAL ANTAR JUARA POOL (GOLD & BRONZE)";
    tatamiLabel = "TATAMI 1 (ARENA UTAMA)";
    participantLabel = "JUARA & RUNNER-UP POOL";
    const finalData = state.championshipFinal;
    const goldMatch = finalData.matches.find((m) => m.id === "final-gold") || finalData.matches[0];
    const bronzeMatch = finalData.matches.find((m) => m.id === "final-bronze") || finalData.matches[1];

    roundsHtml = `
      <div style="display:flex; justify-content:center; gap:25px; width:100%; margin:25px auto;">
        <!-- Gold Match Card -->
        <div style="flex:1; max-width:440px; border:2px solid #b45309; border-radius:8px; overflow:hidden; background:#fff; box-shadow:0 2px 4px rgba(0,0,0,0.05);">
          <div style="background:#b45309; color:#fff; font-weight:900; font-size:11px; padding:6px 12px; text-transform:uppercase; text-align:center; letter-spacing:0.5px;">
            🥇 GRAND FINAL: PEREBUTAN MEDALI EMAS & PERAK (PARTAI #${goldMatch?.number || 301})
          </div>
          <div style="padding:12px 16px; background:#fff1f2; border-bottom:1px dashed #cbd5e1; display:flex; justify-content:space-between; align-items:center;">
            <div>
              <span style="background:#e11d48; color:#fff; font-size:8px; font-weight:900; padding:2px 5px; border-radius:3px; text-transform:uppercase;">AKA</span>
              <strong style="font-size:13px; margin-left:6px; color:#9f1239;">${goldMatch?.aka?.name || "Juara Pool A"}</strong>
              <div style="font-size:9.5px; color:#64748b; margin-left:36px;">${goldMatch?.aka?.dojo || "Kontingen INKAI Surabaya"}</div>
            </div>
            <div style="font-family:monospace; font-weight:900; font-size:16px; min-width:32px; text-align:center; border:1.5px solid #94a3b8; border-radius:4px; background:#fff; padding:3px 6px;">
              ${includeScores && goldMatch?.aka?.score !== undefined ? goldMatch.aka.score : ""}
            </div>
          </div>
          <div style="text-align:center; font-size:9px; font-weight:900; color:#94a3b8; padding:3px 0; background:#f8fafc;">VS</div>
          <div style="padding:12px 16px; background:#eff6ff; display:flex; justify-content:space-between; align-items:center;">
            <div>
              <span style="background:#2563eb; color:#fff; font-size:8px; font-weight:900; padding:2px 5px; border-radius:3px; text-transform:uppercase;">AO</span>
              <strong style="font-size:13px; margin-left:6px; color:#1e40af;">${goldMatch?.ao?.name || "Juara Pool B"}</strong>
              <div style="font-size:9.5px; color:#64748b; margin-left:36px;">${goldMatch?.ao?.dojo || "Kontingen Tamu"}</div>
            </div>
            <div style="font-family:monospace; font-weight:900; font-size:16px; min-width:32px; text-align:center; border:1.5px solid #94a3b8; border-radius:4px; background:#fff; padding:3px 6px;">
              ${includeScores && goldMatch?.ao?.score !== undefined ? goldMatch.ao.score : ""}
            </div>
          </div>
        </div>

        <!-- Bronze Match Card -->
        <div style="flex:1; max-width:440px; border:2px solid #475569; border-radius:8px; overflow:hidden; background:#fff; box-shadow:0 2px 4px rgba(0,0,0,0.05);">
          <div style="background:#475569; color:#fff; font-weight:900; font-size:11px; padding:6px 12px; text-transform:uppercase; text-align:center; letter-spacing:0.5px;">
            🥉 PEREBUTAN MEDALI PERUNGGU (PARTAI #${bronzeMatch?.number || 302})
          </div>
          <div style="padding:12px 16px; background:#fff1f2; border-bottom:1px dashed #cbd5e1; display:flex; justify-content:space-between; align-items:center;">
            <div>
              <span style="background:#e11d48; color:#fff; font-size:8px; font-weight:900; padding:2px 5px; border-radius:3px; text-transform:uppercase;">AKA</span>
              <strong style="font-size:13px; margin-left:6px; color:#9f1239;">${bronzeMatch?.aka?.name || "Runner-Up Pool A"}</strong>
              <div style="font-size:9.5px; color:#64748b; margin-left:36px;">${bronzeMatch?.aka?.dojo || "Dojo Patriot INKAI"}</div>
            </div>
            <div style="font-family:monospace; font-weight:900; font-size:16px; min-width:32px; text-align:center; border:1.5px solid #94a3b8; border-radius:4px; background:#fff; padding:3px 6px;">
              ${includeScores && bronzeMatch?.aka?.score !== undefined ? bronzeMatch.aka.score : ""}
            </div>
          </div>
          <div style="text-align:center; font-size:9px; font-weight:900; color:#94a3b8; padding:3px 0; background:#f8fafc;">VS</div>
          <div style="padding:12px 16px; background:#eff6ff; display:flex; justify-content:space-between; align-items:center;">
            <div>
              <span style="background:#2563eb; color:#fff; font-size:8px; font-weight:900; padding:2px 5px; border-radius:3px; text-transform:uppercase;">AO</span>
              <strong style="font-size:13px; margin-left:6px; color:#1e40af;">${bronzeMatch?.ao?.name || "Runner-Up Pool B"}</strong>
              <div style="font-size:9.5px; color:#64748b; margin-left:36px;">${bronzeMatch?.ao?.dojo || "Dojo Brawijaya"}</div>
            </div>
            <div style="font-family:monospace; font-weight:900; font-size:16px; min-width:32px; text-align:center; border:1.5px solid #94a3b8; border-radius:4px; background:#fff; padding:3px 6px;">
              ${includeScores && bronzeMatch?.ao?.score !== undefined ? bronzeMatch.ao.score : ""}
            </div>
          </div>
        </div>
      </div>
    `;
  } else {
    if (!pool) return "";
    poolTitle = `BAGAN PERTANDINGAN RESMI - ${pool.name.toUpperCase()}`;
    tatamiLabel = `TATAMI ${pool.tatami || 1}`;
    const byes = (pool.bracketSize || 16) - pool.participantCount;
    participantLabel = `${pool.participantCount} ATLET ${byes > 0 ? `(${byes} BYE)` : ""}`;

    const rounds = pool.rounds || [];
    roundsHtml = `
      <div class="tree-grid" style="position: relative;">
    `;

    rounds.forEach((roundMatches, rIdx) => {
      const roundTitle = roundMatches[0]?.roundName || `Babak ${rIdx + 1}`;
      roundsHtml += `
        <div class="tree-column">
          <div class="column-header">${roundTitle}</div>
          <div style="display:flex; flex-direction:column; justify-content:space-around; flex:1;">
      `;

      roundMatches.forEach((m, mIdx) => {
        const isAkaBye = m.aka && m.aka.isBye;
        const isAoBye = m.ao && m.ao.isBye;
        const isAkaWinner = m.winner === "aka";
        const isAoWinner = m.winner === "ao";

        roundsHtml += `
          <div id="print-match-${rIdx}-${mIdx}" class="match-box">
            <div class="match-header">
              <span>Partai #${m.number}</span>
              <span>Tatami ${pool.tatami || 1}</span>
            </div>
            <!-- AKA Slot -->
            <div class="fighter-row aka ${isAkaWinner ? "winner" : ""} ${isAkaBye ? "bye-row" : ""}">
              <div style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:85%;">
                <span class="corner-tag aka">AKA</span>
                <span class="fighter-name">${m.aka?.name || "TBD"}</span>
                ${m.aka?.dojo ? `<div class="fighter-dojo">${m.aka.dojo}</div>` : ""}
              </div>
              <div class="score-box">
                ${includeScores && m.aka?.score !== undefined && !isAkaBye ? m.aka.score : ""}
              </div>
            </div>
            <!-- AO Slot -->
            <div class="fighter-row ao ${isAoWinner ? "winner" : ""} ${isAoBye ? "bye-row" : ""}">
              <div style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:85%;">
                <span class="corner-tag ao">AO</span>
                <span class="fighter-name">${m.ao?.name || "TBD"}</span>
                ${m.ao?.dojo ? `<div class="fighter-dojo">${m.ao.dojo}</div>` : ""}
              </div>
              <div class="score-box">
                ${includeScores && m.ao?.score !== undefined && !isAoBye ? m.ao.score : ""}
              </div>
            </div>
          </div>
        `;
      });

      roundsHtml += `
          </div>
        </div>
      `;
    });

    roundsHtml += `</div>`;
  }

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Bagan_${category.replace(/[^a-zA-Z0-9]/g, "_")}_F4_Landscape</title>
  <style>
    @page {
      size: 330mm 215mm landscape;
      margin: 6mm 8mm 6mm 8mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: Arial, Helvetica, sans-serif;
      margin: 0;
      padding: 0;
      background: #fff;
      color: #0f172a;
      font-size: 11px;
    }
    .print-btn-bar {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      background: #0f172a;
      color: #fff;
      padding: 10px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      z-index: 9999;
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
    }
    .btn-print-now {
      background: #eab308;
      color: #000;
      font-weight: bold;
      border: none;
      padding: 6px 14px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 12px;
    }
    @media print {
      .print-btn-bar { display: none !important; }
      body { margin: 0; padding: 0; }
    }
    .sheet-wrapper {
      width: 100%;
      height: 100%;
      min-height: 195mm;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      border: 1.5px solid #0f172a;
      padding: 6mm;
      background: #fff;
    }
    .header-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 4mm;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 2mm;
    }
    .logo-box {
      width: 60px;
      height: 60px;
      border: 1.5px solid #0f172a;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 900;
      font-size: 20px;
      background: #f8fafc;
      color: #dc2626;
      border-radius: 6px;
    }
    .title-main {
      font-size: 15px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #0f172a;
    }
    .title-sub {
      font-size: 11px;
      font-weight: 700;
      color: #b45309;
      margin-top: 1px;
    }
    .title-category {
      font-size: 13px;
      font-weight: 900;
      color: #1e3a8a;
      margin-top: 2px;
      text-transform: uppercase;
    }
    .meta-box {
      border: 1px solid #94a3b8;
      background: #f8fafc;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 9px;
      text-align: right;
      line-height: 1.4;
    }
    .tree-grid {
      display: flex;
      flex: 1;
      width: 100%;
      gap: 10px;
      margin-bottom: 3mm;
    }
    .tree-column {
      flex: 1;
      display: flex;
      flex-direction: column;
      background: #fdfdfe;
      border: 1px solid #e2e8f0;
      border-radius: 5px;
      padding: 4px;
    }
    .column-header {
      background: #0f172a;
      color: #fff;
      font-size: 9.5px;
      font-weight: bold;
      text-align: center;
      padding: 3px 0;
      border-radius: 3px;
      margin-bottom: 6px;
      text-transform: uppercase;
    }
    .match-box {
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      background: #fff;
      margin: 4px 0;
      overflow: hidden;
      box-shadow: 0 1px 2px rgba(0,0,0,0.03);
    }
    .match-header {
      background: #f1f5f9;
      padding: 2px 5px;
      font-size: 8px;
      font-weight: bold;
      color: #475569;
      display: flex;
      justify-content: space-between;
      border-bottom: 1px solid #e2e8f0;
    }
    .fighter-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 3px 5px;
      font-size: 9.5px;
    }
    .fighter-row.aka {
      background: #fff5f5;
      border-bottom: 1px dashed #e2e8f0;
    }
    .fighter-row.ao {
      background: #f0f7ff;
    }
    .fighter-row.winner {
      font-weight: 900;
    }
    .fighter-row.aka.winner {
      background: #fee2e2;
      border-left: 3px solid #dc2626;
    }
    .fighter-row.ao.winner {
      background: #dbeafe;
      border-left: 3px solid #2563eb;
    }
    .fighter-row.bye-row {
      opacity: 0.6;
      background: #f8fafc;
      font-style: italic;
    }
    .corner-tag {
      font-size: 7.5px;
      font-weight: 900;
      padding: 1px 3px;
      border-radius: 2px;
      color: #fff;
      display: inline-block;
      margin-right: 3px;
    }
    .corner-tag.aka { background: #dc2626; }
    .corner-tag.ao { background: #2563eb; }
    .fighter-name {
      font-size: 9px;
      font-weight: bold;
      color: #0f172a;
    }
    .fighter-dojo {
      font-size: 7.5px;
      color: #64748b;
      margin-left: 20px;
    }
    .score-box {
      font-family: monospace;
      font-size: 11px;
      font-weight: 900;
      width: 18px;
      height: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1px solid #cbd5e1;
      border-radius: 2px;
      background: #fff;
    }
    .footer-signatures {
      width: 100%;
      border-top: 1.5px solid #0f172a;
      padding-top: 3mm;
      display: flex;
      justify-content: space-between;
      font-size: 9px;
    }
    .sig-col {
      width: 22%;
      text-align: center;
    }
    .sig-title {
      font-weight: bold;
      color: #334155;
      margin-bottom: 12mm;
    }
    .sig-line {
      border-top: 1px dotted #0f172a;
      margin-top: 12mm;
      font-weight: bold;
      color: #0f172a;
    }
  </style>
</head>
<body>
  <div class="print-btn-bar">
    <div><strong>Format: Kertas F4 / Folio Landscape (330 mm x 215 mm)</strong> • Lembar Bagan Meja Wasit & Dinding</div>
    <button class="btn-print-now" onclick="window.print()">🖨️ Cetak Lembar Ini Sekarang</button>
  </div>

  <div class="sheet-wrapper" style="margin-top: 35px;">
    <!-- HEADER -->
    <table class="header-table">
      <tr>
        <td style="width: 70px;">
          <div class="logo-box">INKAI</div>
        </td>
        <td style="padding-left: 8px;">
          <div class="title-main">${tournamentTitle}</div>
          <div class="title-sub">${poolTitle} • ${tatamiLabel}</div>
          <div class="title-category">${category} (${participantLabel})</div>
        </td>
        <td style="width: 200px; vertical-align: top;">
          <div class="meta-box">
            <div><strong>TANGGAL:</strong> ${dateStr}</div>
            <div><strong>WAKTU:</strong> ${timeStr}</div>
            <div><strong>FORMAT:</strong> WKF Single Elimination</div>
          </div>
        </td>
      </tr>
    </table>

    <!-- BRACKET GRID -->
    ${roundsHtml}

    <!-- FOOTER SIGNATURES -->
    <div class="footer-signatures">
      <div class="sig-col">
        <div class="sig-title">Manager Pertandingan (Technical Delegate)</div>
        <div class="sig-line">( ............................................ )</div>
      </div>
      <div class="sig-col">
        <div class="sig-title">Ketua Dewan Wasit (Tatami Manager)</div>
        <div class="sig-line">( ............................................ )</div>
      </div>
      <div class="sig-col">
        <div class="sig-title">Wasit Utama (Referee)</div>
        <div class="sig-line">( ............................................ )</div>
      </div>
      <div class="sig-col">
        <div class="sig-title">Operator Meja & Pencatat Skor</div>
        <div class="sig-line">( ............................................ )</div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

