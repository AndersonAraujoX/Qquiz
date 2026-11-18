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
