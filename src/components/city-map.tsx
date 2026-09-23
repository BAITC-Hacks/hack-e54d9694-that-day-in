"use client";

import { useState } from "react";
import { Minus, Plus, Scan } from "lucide-react";

const districts = [
  {
    id: "baikonur",
    name: "Байконур",
    x: 423,
    y: 150,
    score: "56,63",
    tone: "#d9e3d5",
  },
  {
    id: "saryarka",
    name: "Сарыарка",
    x: 205,
    y: 266,
    score: "54,65",
    tone: "#dce5d4",
  },
  {
    id: "almaty",
    name: "Алматы",
    x: 631,
    y: 268,
    score: "57,06",
    tone: "#e7e1d0",
  },
  {
    id: "esil",
    name: "Есиль",
    x: 386,
    y: 372,
    score: "62,99",
    tone: "#d8e5dd",
  },
  { id: "nura", name: "Нура", x: 595, y: 480, score: "49,18", tone: "#dce6d3" },
];

function Building({
  x,
  y,
  h,
  variant,
}: {
  x: number;
  y: number;
  h: number;
  variant: number;
}) {
  const colors = ["#aac6c5", "#efeee5", "#d6d4c2", "#bed0d3"];
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M0 6l26 13 28-14-27-12z" fill="#799594" opacity=".13" />
      <path
        d={`M-13 0L0 7V${7 - h}L-13 ${-h}Z`}
        fill={variant % 2 ? "#c4cbc3" : "#779da1"}
      />
      <path
        d={`M0 7L20 -3V${-3 - h}L0 ${7 - h}Z`}
        fill={colors[variant % colors.length]}
      />
      <path
        d={`M-13 ${-h}L7 ${-10 - h}L20 ${-3 - h}L0 ${7 - h}Z`}
        fill={variant % 2 ? "#faf9f1" : "#c8dcdc"}
      />
      {Array.from({ length: Math.floor(h / 10) }, (_, i) => (
        <g key={i} opacity=".7">
          <path
            d={`M3 ${-i * 10 - 1}l4-2v-4l-4 2z M11 ${-i * 10 - 5}l4-2v-4l-4 2z`}
            fill="#628e95"
          />
          <path d={`M-9 ${-i * 10 - 4}l3 1.5v-4l-3-1.5z`} fill="#edf4ed" />
        </g>
      ))}
      {variant % 3 === 0 ? (
        <path d={`M-5 ${-h}l10-5 7 3.5-10 5z`} fill="#6e999b" />
      ) : null}
    </g>
  );
}

function Tree({
  x,
  y,
  small = false,
}: {
  x: number;
  y: number;
  small?: boolean;
}) {
  return (
    <g transform={`translate(${x} ${y}) scale(${small ? 0.7 : 1})`}>
      <ellipse cx="4" cy="3" rx="10" ry="4" fill="#5e8777" opacity=".16" />
      <path d="M0 0v-13" stroke="#8b9380" strokeWidth="2" />
      <path d="M0-33l-10 19L0-9l10-5z" fill="#759a80" />
      <path d="M0-33v24l10-5z" fill="#4e826d" />
    </g>
  );
}

export default function CityMap({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (id: string) => void;
}) {
  const [zoom, setZoom] = useState(1);
  return (
    <div className="map-stage">
      <div className="map-topline">
        <span>
          <i /> ГОРОДСКАЯ СРЕДА
        </span>
        <span>АСТАНА · 5 РАЙОНОВ</span>
      </div>
      <svg
        className="city-scene"
        viewBox="0 0 850 625"
        aria-label="Схематическая изометрическая карта пяти районов Астаны"
      >
        <defs>
          <filter
            id="ground-shadow"
            x="-30%"
            y="-30%"
            width="160%"
            height="180%"
          >
            <feDropShadow
              dx="0"
              dy="12"
              stdDeviation="12"
              floodColor="#426054"
              floodOpacity=".13"
            />
          </filter>
          <linearGradient id="water" x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#a3cccf" />
            <stop offset="1" stopColor="#c6e1df" />
          </linearGradient>
        </defs>
        <g transform={`translate(425 310) scale(${zoom}) translate(-425 -310)`}>
          <path
            d="M36 327L381 128 811 365 463 572Z"
            fill="#e7e9df"
            opacity=".7"
          />
          <path
            d="M15 336C160 287 196 395 326 307S461 247 520 348s177 74 308 199"
            fill="none"
            stroke="#dde8e1"
            strokeWidth="60"
          />
          <path
            d="M15 336C160 287 196 395 326 307S461 247 520 348s177 74 308 199"
            fill="none"
            stroke="url(#water)"
            strokeWidth="44"
          />
          <path
            d="M17 329C162 280 198 388 328 300S463 240 522 341s177 74 308 199"
            fill="none"
            stroke="#eaf6ef"
            strokeWidth="1.5"
            opacity=".75"
          />
          <text
            x="312"
            y="323"
            transform="rotate(-28 312 323)"
            fill="#619c9f"
            fontSize="10"
            letterSpacing="4"
          >
            ЕСИЛЬ
          </text>
          <path
            d="M280 168L719 416M130 323L585 65M301 477L744 222"
            fill="none"
            stroke="#c9cec3"
            strokeWidth="19"
          />
          <path
            d="M280 168L719 416M130 323L585 65M301 477L744 222"
            fill="none"
            stroke="#f8f7ef"
            strokeWidth="13"
          />
          <path
            d="M280 168L719 416M130 323L585 65M301 477L744 222"
            fill="none"
            stroke="#cfd4c9"
            strokeDasharray="6 7"
          />
          {districts.map((district, index) => {
            const active = selected === district.id;
            return (
              <g
                key={district.id}
                transform={`translate(${district.x} ${district.y})`}
                role="button"
                tabIndex={0}
                aria-label={`Район ${district.name}`}
                aria-pressed={active}
                onClick={() => onSelect(district.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelect(district.id);
                  }
                }}
                className="district-tile"
              >
                <g filter="url(#ground-shadow)">
                  <path d="M-147 0L0 75 147 0v9L0 85-147 9Z" fill="#bccbb9" />
                  <path
                    d="M-147 0L0-75 147 0 0 75Z"
                    fill={active ? "#c2ddd0" : district.tone}
                    stroke={active ? "#328b79" : "#f5f6ee"}
                    strokeWidth={active ? 2.5 : 2}
                  />
                </g>
                <path
                  d="M-111-17L36 57M-72-37L75 37M-31-57L113 16M-109 17L35-57M-71 37L74-37M-32 57L113-17"
                  fill="none"
                  stroke="#f1f1e7"
                  strokeWidth="6"
                />
                <path
                  d="M-112-17L36 57M-72-37L75 37M-31-57L113 16"
                  fill="none"
                  stroke="#dde2d5"
                  strokeWidth=".6"
                />
                {Array.from({ length: 4 }, (_, row) =>
                  Array.from({ length: 4 }, (_, col) => {
                    const x = (col - row) * 29;
                    const y = (col + row) * 14.5 - 42;
                    const n = row * 4 + col + index;
                    return n % 4 === 0 ? (
                      <Tree key={`${row}-${col}`} x={x} y={y} />
                    ) : (
                      <Building
                        key={`${row}-${col}`}
                        x={x}
                        y={y}
                        h={22 + ((n * 11) % 37)}
                        variant={n}
                      />
                    );
                  }),
                )}
                <Tree x={-108} y={4} small />
                <Tree x={97} y={-3} small />
                <Tree x={-19} y={58} small />
                {district.id === "esil" ? (
                  <g transform="translate(24 -45)">
                    <ellipse cy="5" rx="15" ry="7" fill="#e6eddf" />
                    <path
                      d="M-7 0L-3-45h6L7 0M-9 0L0-52 9 0"
                      fill="#f5f6ec"
                      stroke="#c2cbbf"
                    />
                    <circle cy="-49" r="11" fill="#c6af78" />
                    <path
                      d="M-6-53q7-7 13 1"
                      fill="none"
                      stroke="#ead9a2"
                      strokeWidth="3"
                    />
                  </g>
                ) : null}
                <g transform="translate(0 -116)">
                  <path
                    d="M0 19l-5-7h10z"
                    fill={active ? "#256b5d" : "#fffdf5"}
                  />
                  <rect
                    x="-63"
                    y="-10"
                    width="126"
                    height="27"
                    rx="13.5"
                    fill={active ? "#256b5d" : "#fffdf5"}
                    stroke={active ? "#256b5d" : "#dbe1d5"}
                  />
                  <circle
                    cx="-47"
                    cy="3.5"
                    r="3.5"
                    fill={
                      active ? "#b2e3cb" : index === 4 ? "#c6a263" : "#83a693"
                    }
                  />
                  <text
                    x="-35"
                    y="7.5"
                    fontSize="11"
                    fontWeight="700"
                    fill={active ? "#fff" : "#3c5348"}
                  >
                    {district.name}
                  </text>
                </g>
              </g>
            );
          })}
          <g transform="translate(82 517)" fill="none" stroke="#9cae9f">
            <path d="M0-18L7 0 0-4-7 0Z" fill="#668376" stroke="none" />
            <path d="M0 4v13" />
            <text
              y="-24"
              textAnchor="middle"
              fontSize="9"
              fill="#80988b"
              stroke="none"
            >
              С
            </text>
          </g>
        </g>
      </svg>
      <div className="map-bottomline">
        <div className="map-legend">
          <span>
            <i className="legend-dot" /> Район города
          </span>
          <span>
            <i className="legend-dot selected" /> Выбранный район
          </span>
        </div>
        <div className="map-controls">
          <button
            aria-label="Уменьшить карту"
            disabled={zoom <= 0.8}
            onClick={() => setZoom((z) => Math.max(0.8, z - 0.1))}
          >
            <Minus size={16} />
          </button>
          <button aria-label="Вернуть масштаб карты" onClick={() => setZoom(1)}>
            <Scan size={16} />
          </button>
          <button
            aria-label="Увеличить карту"
            disabled={zoom >= 1.3}
            onClick={() => setZoom((z) => Math.min(1.3, z + 0.1))}
          >
            <Plus size={16} />
          </button>
        </div>
      </div>
      <div className="map-disclaimer">
        Схематическая карта · синтетические данные
      </div>
    </div>
  );
}
