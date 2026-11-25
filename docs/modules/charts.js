/**
 * Pure SVG data visualization renderers (no innerHTML).
 */

import { clear, svgEl } from "./dom.js";
import { formatNumber, formatPercent, formatSeconds } from "./formatters.js";

function attachTooltipHandlers(targetNode, tooltipEl, text) {
  const show = (event) => {
    tooltipEl.textContent = text;
    tooltipEl.hidden = false;
    const x = Math.min(window.innerWidth - 270, (event.clientX || 120) + 12);
    const y = Math.max(12, (event.clientY || 120) - 36);
    tooltipEl.style.left = `${x}px`;
    tooltipEl.style.top = `${y}px`;
  };
  const hide = () => {
    tooltipEl.hidden = true;
  };
  targetNode.addEventListener("mouseenter", show);
  targetNode.addEventListener("mousemove", show);
  targetNode.addEventListener("mouseleave", hide);
  targetNode.addEventListener("focus", () => {
    const rect = targetNode.getBoundingClientRect();
    show({ clientX: rect.left + rect.width / 2, clientY: rect.top });
  });
  targetNode.addEventListener("blur", hide);
}

export function renderBarChart(
  container,
  buckets,
  tooltipEl,
  {
    ariaLabel,
    barColor = "var(--accent)",
    doc = globalThis.document,
    emptyText = "Sem dados suficientes para exibir distribuição.",
    studentsUnit = "alunos",
  } = {}
) {
  if (!container) {
    return;
  }
  clear(container);
  if (!Array.isArray(buckets) || buckets.length === 0) {
    const empty = doc.createElement("p");
    empty.className = "muted-small";
    empty.textContent = emptyText;
    container.appendChild(empty);
    return;
  }

  const width = 520;
  const height = 250;
  const pad = { top: 24, right: 16, bottom: 44, left: 40 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const maxCount = Math.max(1, ...buckets.map((b) => b.count));

  const svg = svgEl("svg", {
    class: "chart-svg",
    viewBox: `0 0 ${width} ${height}`,
    role: "img",
    "aria-label": ariaLabel || "Gráfico de barras",
  });

  const gridSteps = 4;
  for (let i = 0; i <= gridSteps; i += 1) {
    const ratio = i / gridSteps;
    const y = pad.top + plotH - ratio * plotH;
    svg.appendChild(
      svgEl("line", {
        x1: pad.left,
        x2: width - pad.right,
        y1: y,
        y2: y,
        stroke: "var(--border)",
        "stroke-dasharray": i === 0 ? "none" : "3 3",
      })
    );
    const tickVal = Math.round(ratio * maxCount);
    svg.appendChild(
      svgEl(
        "text",
        {
          x: pad.left - 8,
          y: y + 4,
          "text-anchor": "end",
          fill: "var(--text-muted)",
          "font-size": "11",
        },
        tickVal
      )
    );
  }

  const slotW = plotW / buckets.length;
  const barW = Math.min(54, slotW * 0.62);

  buckets.forEach((bucket, idx) => {
    const barH = (bucket.count / maxCount) * plotH;
    const x = pad.left + idx * slotW + (slotW - barW) / 2;
    const y = pad.top + plotH - barH;

    const rect = svgEl("rect", {
      x,
      y,
      width: barW,
      height: Math.max(4, barH),
      rx: 8,
      fill: barColor,
      tabindex: "0",
      "aria-label": `${bucket.label}: ${bucket.count} ${studentsUnit} (${formatPercent(bucket.percentage)})`,
    });
    if (tooltipEl) {
      attachTooltipHandlers(
        rect,
        tooltipEl,
        `${bucket.label} — ${bucket.count} ${studentsUnit} (${formatPercent(bucket.percentage)})`
      );
    }
    svg.appendChild(rect);

    svg.appendChild(
      svgEl(
        "text",
        {
          x: x + barW / 2,
          y: Math.max(14, y - 6),
          "text-anchor": "middle",
          fill: "var(--text)",
          "font-size": "11",
          "font-weight": "700",
        },
        `${bucket.count}`
      )
    );

    svg.appendChild(
      svgEl(
        "text",
        {
          x: x + barW / 2,
          y: height - 18,
          "text-anchor": "middle",
          fill: "var(--text-muted)",
          "font-size": "11",
        },
        bucket.label
      )
    );
  });

  container.appendChild(svg);
}

export function renderScatterPlot(
  container,
  participants,
  top10Set,
  tooltipEl,
  {
    top10Color = "var(--accent)",
    otherColor = "var(--scatter-other, var(--peach-strong, #c27849))",
    doc = globalThis.document,
    emptyText = "Sem registros com tempo maior que zero para dispersão.",
    ariaLabel = "Gráfico de dispersão entre tempo total e pontuação",
    xAxisLabel = "Tempo Total (mm:ss)",
    pointsUnit = "pts",
    inTimeLabel = "em",
    locale = "pt",
  } = {}
) {
  if (!container) {
    return;
  }
  clear(container);
  const safeTop10Set = top10Set instanceof Set ? top10Set : new Set();
  const active = (Array.isArray(participants) ? participants : []).filter(
    (p) => p && p.is_active && p.total_time_seconds > 0
  );

  if (active.length === 0) {
    const empty = doc.createElement("p");
    empty.className = "muted-small";
    empty.textContent = emptyText;
    container.appendChild(empty);
    return;
  }

  const width = 920;
  const height = 290;
  const pad = { top: 22, right: 24, bottom: 44, left: 54 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const maxTime = Math.max(60, ...active.map((p) => p.total_time_seconds)) * 1.05;
  const maxScore = Math.max(1000, ...active.map((p) => p.score)) * 1.08;

  const svg = svgEl("svg", {
    class: "chart-svg",
    viewBox: `0 0 ${width} ${height}`,
    role: "img",
    "aria-label": ariaLabel,
  });

  for (let i = 0; i <= 4; i += 1) {
    const ratio = i / 4;
    const y = pad.top + plotH - ratio * plotH;
    svg.appendChild(
      svgEl("line", {
        x1: pad.left,
        x2: width - pad.right,
        y1: y,
        y2: y,
        stroke: "var(--border)",
        "stroke-dasharray": i === 0 ? "none" : "3 3",
      })
    );
    svg.appendChild(
      svgEl(
        "text",
        {
          x: pad.left - 8,
          y: y + 4,
          "text-anchor": "end",
          fill: "var(--text-muted)",
          "font-size": "11",
        },
        Math.round(ratio * maxScore)
      )
    );
  }

  for (let i = 0; i <= 4; i += 1) {
    const ratio = i / 4;
    const x = pad.left + ratio * plotW;
    svg.appendChild(
      svgEl("line", {
        x1: x,
        x2: x,
        y1: pad.top,
        y2: pad.top + plotH,
        stroke: "var(--border)",
        "stroke-dasharray": i === 0 ? "none" : "3 3",
      })
    );
    svg.appendChild(
      svgEl(
        "text",
        {
          x,
          y: height - 18,
          "text-anchor": "middle",
          fill: "var(--text-muted)",
          "font-size": "11",
        },
        formatSeconds(ratio * maxTime)
      )
    );
  }

  svg.appendChild(
    svgEl(
      "text",
      {
        x: pad.left + plotW / 2,
        y: height - 3,
        "text-anchor": "middle",
        fill: "var(--text-muted)",
        "font-size": "11",
        "font-weight": "600",
      },
      xAxisLabel
    )
  );

  const ordered = [
    ...active.filter((p) => !safeTop10Set.has(p.rank)),
    ...active.filter((p) => safeTop10Set.has(p.rank)),
  ];

  for (const p of ordered) {
    const isTop10 = safeTop10Set.has(p.rank);
    const cx = pad.left + (p.total_time_seconds / maxTime) * plotW;
    const cy = pad.top + plotH - (p.score / maxScore) * plotH;

    const circle = svgEl("circle", {
      cx,
      cy,
      r: isTop10 ? 7 : 4.5,
      fill: isTop10 ? top10Color : otherColor,
      "fill-opacity": isTop10 ? "0.96" : "0.75",
      stroke: isTop10 ? "var(--surface)" : "none",
      "stroke-width": isTop10 ? "2" : "0",
      tabindex: "0",
      "aria-label": `#${p.rank} ${p.display_name}: ${formatNumber(p.score, locale)} ${pointsUnit} ${inTimeLabel} ${formatSeconds(p.total_time_seconds)}`,
    });
    if (tooltipEl) {
      attachTooltipHandlers(
        circle,
        tooltipEl,
        `#${p.rank} ${p.display_name} · ${formatNumber(p.score, locale)} ${pointsUnit} · ${formatPercent(p.accuracy_percent)} · ${formatSeconds(p.total_time_seconds)}`
      );
    }
    svg.appendChild(circle);
  }

  container.appendChild(svg);
}

const PROGRESSION_PALETTE = [
  "#ff319f",
  "#0b875b",
  "#d97736",
  "#6d28d9",
  "#0284c7",
  "#e11d48",
  "#059669",
  "#b45309",
  "#7c3aed",
  "#0d9488",
  "#db2777",
  "#2563eb",
  "#ca8a04",
  "#9333ea",
  "#16a34a",
];

export function renderRankingProgressionChart(
  container,
  progression,
  tooltipEl,
  {
    maxSeries = 10,
    doc = globalThis.document,
    emptyText = "Adicione pelo menos 2 quizzes para visualizar a evolução no ranking.",
    ariaLabel = "Gráfico de evolução da colocação dos candidatos ao longo dos quizzes",
    stagePrefix = "Quiz",
    pointsUnit = "pts",
    locale = "pt",
  } = {}
) {
  if (!container) {
    return;
  }
  clear(container);

  const stages = Array.isArray(progression?.stages) ? progression.stages : [];
  const allParticipants = Array.isArray(progression?.participants)
    ? progression.participants
    : [];

  if (stages.length < 2 || allParticipants.length === 0) {
    const empty = doc.createElement("p");
    empty.className = "muted-small";
    empty.textContent = emptyText;
    container.appendChild(empty);
    return;
  }

  const series = allParticipants.slice(0, Math.max(1, Number(maxSeries) || 10));
  const observedRanks = series.flatMap((p) =>
    (Array.isArray(p.ranks) ? p.ranks : []).filter((r) => typeof r === "number" && r > 0)
  );
  const maxRank = Math.max(series.length, ...observedRanks, 2);

  const width = 940;
  const height = Math.max(320, Math.min(520, 90 + series.length * 30));
  const pad = { top: 28, right: 190, bottom: 44, left: 46 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const xForStage = (idx) =>
    stages.length === 1 ? pad.left + plotW / 2 : pad.left + (idx / (stages.length - 1)) * plotW;
  const yForRank = (rank) =>
    maxRank === 1 ? pad.top + plotH / 2 : pad.top + ((rank - 1) / (maxRank - 1)) * plotH;

  const svg = svgEl("svg", {
    class: "chart-svg",
    viewBox: `0 0 ${width} ${height}`,
    role: "img",
    "aria-label": ariaLabel,
  });

  // Horizontal rank grid lines
  const yTicks = maxRank <= 12
    ? Array.from({ length: maxRank }, (_, i) => i + 1)
    : [1, Math.round(maxRank * 0.25), Math.round(maxRank * 0.5), Math.round(maxRank * 0.75), maxRank];

  for (const rankTick of [...new Set(yTicks)]) {
    const y = yForRank(rankTick);
    svg.appendChild(
      svgEl("line", {
        x1: pad.left,
        x2: pad.left + plotW,
        y1: y,
        y2: y,
        stroke: "var(--border)",
        "stroke-dasharray": rankTick === 1 ? "none" : "3 3",
      })
    );
    svg.appendChild(
      svgEl(
        "text",
        {
          x: pad.left - 10,
          y: y + 4,
          "text-anchor": "end",
          fill: "var(--text-muted)",
          "font-size": "11",
          "font-weight": "700",
        },
        `#${rankTick}`
      )
    );
  }

  // Vertical stage lines & labels
  stages.forEach((stage, idx) => {
    const x = xForStage(idx);
    svg.appendChild(
      svgEl("line", {
        x1: x,
        x2: x,
        y1: pad.top,
        y2: pad.top + plotH,
        stroke: "var(--border)",
        "stroke-dasharray": "3 3",
      })
    );
    svg.appendChild(
      svgEl(
        "text",
        {
          x,
          y: height - 16,
          "text-anchor": "middle",
          fill: "var(--text-muted)",
          "font-size": "11",
          "font-weight": "700",
        },
        `${stagePrefix} ${idx + 1}`
      )
    );
  });

  // Series lines, points, and right-side labels
  series.forEach((student, sIdx) => {
    const color = PROGRESSION_PALETTE[sIdx % PROGRESSION_PALETTE.length];
    const points = [];
    stages.forEach((stage, stageIdx) => {
      const rank = student.ranks?.[stageIdx];
      if (typeof rank === "number" && rank > 0) {
        points.push({
          stageIdx,
          stage,
          rank,
          score: student.scores?.[stageIdx] ?? 0,
          x: xForStage(stageIdx),
          y: yForRank(rank),
        });
      }
    });

    if (points.length >= 2) {
      svg.appendChild(
        svgEl("polyline", {
          fill: "none",
          stroke: color,
          "stroke-width": sIdx < 3 ? "3.2" : "2.2",
          "stroke-linecap": "round",
          "stroke-linejoin": "round",
          "stroke-opacity": "0.9",
          points: points.map((pt) => `${pt.x},${pt.y}`).join(" "),
        })
      );
    }

    for (const pt of points) {
      const tip = `#${pt.rank} ${student.display_name} · ${stagePrefix} ${pt.stageIdx + 1} (${formatNumber(pt.score, locale)} ${pointsUnit})`;
      const circle = svgEl("circle", {
        cx: pt.x,
        cy: pt.y,
        r: sIdx < 3 ? 5.5 : 4.2,
        fill: color,
        stroke: "var(--surface)",
        "stroke-width": "1.8",
        tabindex: "0",
        "aria-label": tip,
      });
      if (tooltipEl) {
        attachTooltipHandlers(circle, tooltipEl, tip);
      }
      svg.appendChild(circle);
    }

    if (points.length > 0) {
      const last = points[points.length - 1];
      const rawLabel = `#${student.final_rank} ${student.display_name}`;
      const shortLabel = rawLabel.length > 24 ? `${rawLabel.slice(0, 23)}…` : rawLabel;
      svg.appendChild(
        svgEl(
          "text",
          {
            x: pad.left + plotW + 12,
            y: last.y + 4,
            fill: color,
            "font-size": "11.5",
            "font-weight": "800",
          },
          shortLabel
        )
      );
    }
  });

  container.appendChild(svg);
}
