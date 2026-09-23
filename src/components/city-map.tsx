"use client";

import { useRef, useState, type PointerEvent } from "react";
import {
  Minus,
  Plus,
  Scan,
  Navigation2,
  BusFront,
  Leaf,
  GraduationCap,
  ShieldCheck,
  Wrench,
  Cross,
} from "lucide-react";
import { dataset } from "@/data";
import infrastructure from "@/features/map/infrastructure.json";
import {
  landmarks,
  project,
  zones,
  type LandmarkKind,
} from "@/features/map/geography";
import type { Decision } from "@/shared/contracts";

const measureIcons = {
  transport: BusFront,
  ecology: Leaf,
  social: GraduationCap,
  safety: ShieldCheck,
  services: Wrench,
};

export function LandmarkArt({ kind }: { kind: LandmarkKind }) {
  return (
    <g strokeLinejoin="round">
      <ellipse cy="4" rx="27" ry="9" fill="#385e62" opacity=".15" />
      {kind === "tower" ? (
        <>
          <ellipse cy="0" rx="17" ry="7" fill="#f5f3db" />
          <path
            d="M-9 0L-5-45h10L9 0M-14 0L0-57 14 0"
            fill="#f9f7e7"
            stroke="#b7c7bd"
            strokeWidth="2"
          />
          <circle
            cy="-49"
            r="14"
            fill="#d7b864"
            stroke="#f0d896"
            strokeWidth="2"
          />
          <path
            d="M-9-53Q0-63 9-52"
            stroke="#fff1bf"
            fill="none"
            strokeWidth="3"
          />
        </>
      ) : kind === "tent" ? (
        <>
          <path
            d="M-32 0Q-19-17 7-57Q9-23 34 0Q0 17-32 0"
            fill="#f2ecd7"
            stroke="#c7bca6"
          />
          <path d="M7-57L-8 8 15 6Z" fill="#d3e4dc" />
          <path
            d="M7-57L-21 3M7-57L27 3M7-57L4 9"
            fill="none"
            stroke="#b7cbd0"
          />
          <path d="M7-57V-68" stroke="#718b88" strokeWidth="2" />
        </>
      ) : kind === "sphere" ? (
        <>
          <path d="M-27 0L0 10 29 0V-7L0 2-27-7Z" fill="#a5bcc0" />
          <circle
            cy="-20"
            r="25"
            fill="#7fb7c0"
            stroke="#d7f0e8"
            strokeWidth="2"
          />
          <ellipse cy="-20" rx="13" ry="25" fill="none" stroke="#c2e2de" />
          <path
            d="M-24-20H24M-19-35Q0-26 19-35M-20-5Q0-13 20-5"
            fill="none"
            stroke="#c2e2de"
          />
        </>
      ) : (
        <>
          <path d="M-29-8L3 3 30-10V-35L-1-43-29-32Z" fill="#b6cbd0" />
          <path d="M-29-32L3-22 30-35-1-44Z" fill="#f7f5e7" />
          <path d="M3-22V3L30-10V-35Z" fill="#83a7b5" />
          {[-22, -12, -2].map((x) => (
            <path key={x} d={`M${x} -28v21`} stroke="#f4f1df" strokeWidth="3" />
          ))}
          {kind === "museum" ? (
            <>
              <path d="M-30-34L0-54 30-35 3-23Z" fill="#e6e5d2" />
              <path d="M0-54V-35L3-23 30-35Z" fill="#cfdbd6" />
            </>
          ) : kind === "civic" ? (
            <>
              <path d="M-10-42V-53H12V-38" fill="#eee8d4" />
              <path d="M0-54V-66" stroke="#859e95" />
              <path d="M0-65h14v7H0" fill="#65b2bf" />
            </>
          ) : (
            <path
              d="M-25-35L28-20M-16-39L29-28"
              stroke="#d2bd87"
              strokeWidth="3"
            />
          )}
        </>
      )}
    </g>
  );
}

export default function CityMap({
  selected,
  onSelect,
  decisions,
  changes,
}: {
  selected: string | null;
  onSelect: (id: string) => void;
  decisions: Decision[];
  changes?: Record<string, number>;
}) {
  const [camera, setCamera] = useState({ x: -25, y: 0, width: 1250 });
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<{
    id: number;
    x: number;
    y: number;
    cx: number;
    cy: number;
    moved: boolean;
  } | null>(null);
  const suppressClick = useRef(false);
  const height = camera.width * 0.68;
  function zoom(factor: number) {
    setCamera((c) => {
      const width = Math.max(780, Math.min(1500, c.width * factor));
      return {
        x: c.x + (c.width - width) / 2,
        y: c.y + (c.width - width) * 0.34,
        width,
      };
    });
  }
  function pointerDown(e: PointerEvent<SVGSVGElement>) {
    if (e.button !== 0 || drag.current) return;
    suppressClick.current = false;
    drag.current = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      cx: camera.x,
      cy: camera.y,
      moved: false,
    };
  }
  function pointerMove(e: PointerEvent<SVGSVGElement>) {
    if (e.pointerType === "mouse" && (e.buttons & 1) === 0) {
      drag.current = null;
      return;
    }
    const d = drag.current;
    if (!d || d.id !== e.pointerId || !svg.current) return;
    const dx = e.clientX - d.x,
      dy = e.clientY - d.y;
    if (Math.abs(dx) + Math.abs(dy) < 6 && !d.moved) return;
    d.moved = true;
    suppressClick.current = true;
    svg.current.setPointerCapture(e.pointerId);
    const ratio = Math.max(
      camera.width / svg.current.clientWidth,
      height / svg.current.clientHeight,
    );
    setCamera((c) => ({
      ...c,
      x: Math.max(-700, Math.min(1100, d.cx - dx * ratio)),
      y: Math.max(-500, Math.min(800, d.cy - dy * ratio)),
    }));
  }
  function stopDrag(e: PointerEvent<SVGSVGElement>) {
    drag.current = null;
    if (svg.current?.hasPointerCapture(e.pointerId))
      svg.current.releasePointerCapture(e.pointerId);
  }
  const select = (id: string) => {
    if (!suppressClick.current) onSelect(id);
  };
  return (
    <div className="map-stage">
      <svg
        ref={svg}
        className="city-scene"
        viewBox={`${camera.x} ${camera.y} ${camera.width} ${height}`}
        aria-label="Стилизованная карта районов Астаны"
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={stopDrag}
        onPointerCancel={stopDrag}
        onLostPointerCapture={() => {
          drag.current = null;
        }}
        onPointerLeave={() => {
          if (!drag.current?.moved) drag.current = null;
        }}
      >
        <defs>
          <filter
            id="landmark-shadow"
            x="-70%"
            y="-50%"
            width="240%"
            height="220%"
          >
            <feDropShadow
              dx="2"
              dy="5"
              stdDeviation="4"
              floodColor="#33584b"
              floodOpacity=".17"
            />
          </filter>
        </defs>
        <image href="/maps/astana.svg" x="0" y="0" width="1200" height="850" />
        <g className="zone-boundaries">
          {zones.map((zone) => (
            <polygon
              key={zone.id}
              points={zone.polygon}
              fill={zone.color}
              fillOpacity={selected === zone.id ? 0.17 : 0.09}
              stroke={selected === zone.id ? "#244d7c" : zone.color}
              strokeOpacity={selected === zone.id ? 0.9 : 0.55}
              strokeWidth={selected === zone.id ? 3 : 1.5}
              strokeDasharray={selected === zone.id ? undefined : "6 5"}
              onClick={() => select(zone.id)}
            />
          ))}
        </g>
        <g
          className="geographic-labels"
          pointerEvents="none"
          fill="#558b96"
          fontSize="14"
          fontWeight="600"
        >
          <text
            x="820"
            y="490"
            transform="rotate(27 820 490)"
            letterSpacing="7"
          >
            ЕСИЛЬ
          </text>
          <text x="107" y="693" fontSize="11">
            Талдыколь
          </text>
          <text
            x="425"
            y="585"
            transform="rotate(-76 425 585)"
            fontSize="8"
            fill="#7b8974"
          >
            Қабанбай батыр
          </text>
          <text
            x="725"
            y="355"
            transform="rotate(-16 725 355)"
            fontSize="8"
            fill="#7b8974"
          >
            Тәуелсіздік
          </text>
        </g>
        {camera.width < 1100 ? (
          <g className="infrastructure" pointerEvents="none">
            {infrastructure.map((item) => {
              const p = project(item.lon, item.lat);
              const Icon =
                item.kind === "clinic"
                  ? Cross
                  : item.kind === "police"
                    ? ShieldCheck
                    : GraduationCap;
              return (
                <g key={item.id} transform={`translate(${p.x} ${p.y})`}>
                  <title>{item.name}</title>
                  <rect
                    x="-10"
                    y="-10"
                    width="20"
                    height="20"
                    rx="6"
                    fill="#fffef5"
                    stroke="#c1d3bd"
                  />
                  <Icon x={-6} y={-6} width={12} height={12} color="#70956d" />
                </g>
              );
            })}
          </g>
        ) : null}
        <g className="landmarks" pointerEvents="none">
          {landmarks.map((l) => {
            const p = project(l.lon, l.lat);
            return (
              <g key={l.name} transform={`translate(${p.x} ${p.y})`}>
                <g filter="url(#landmark-shadow)">
                  <g transform="scale(1.35)">
                    <LandmarkArt kind={l.kind} />
                  </g>
                </g>
                <text
                  textAnchor="middle"
                  y="28"
                  fontSize="12"
                  fontWeight="650"
                  fill="#344e70"
                  stroke="#f5f8e9"
                  strokeWidth="4"
                  paintOrder="stroke"
                >
                  {l.name}
                </text>
              </g>
            );
          })}
        </g>
        {zones.map((zone) => {
          const active = selected === zone.id;
          const count = decisions.filter(
            (d) => d.district_id === zone.id,
          ).length;
          return (
            <g
              key={zone.id}
              role="button"
              tabIndex={0}
              aria-label={`Район ${zone.name}`}
              aria-pressed={active}
              className={`district-pin ${active ? "active" : ""}`}
              transform={`translate(${zone.x} ${zone.y})`}
              onClick={() => select(zone.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(zone.id);
                }
              }}
            >
              <title>{`${zone.name} · ориентир: ${zone.landmark}`}</title>
              <rect
                x="-78"
                y="-25"
                width="156"
                height="51"
                rx="18"
                fill={active ? "#203959" : "#fffdfa"}
                stroke={active ? "#fff" : "#d9dfe7"}
                strokeWidth="2"
              />
              <g transform="translate(-49 9) scale(.45)">
                <LandmarkArt kind={zone.icon} />
              </g>
              <text
                x="-24"
                y="-3"
                fill={active ? "#fff" : "#233a56"}
                fontSize="14"
                fontWeight="750"
              >
                {zone.name}
              </text>
              <text
                x="-24"
                y="13"
                fill={active ? "#d1e1ef" : "#687d91"}
                fontSize="9"
              >
                {count ? `${count} в плане` : "Выбрать район"}
              </text>
              {count > 0 ? (
                <g transform="translate(73 -22)">
                  <circle
                    r="12"
                    fill="#e2b25c"
                    stroke="#fffdf5"
                    strokeWidth="2"
                  />
                  <text
                    textAnchor="middle"
                    y="4"
                    fontSize="11"
                    fontWeight="800"
                    fill="#3c4b37"
                  >
                    {count}
                  </text>
                </g>
              ) : null}
              {changes ? (
                <g className="decision-map-markers">
                  {decisions
                    .filter(
                      (d) =>
                        d.district_id === zone.id || d.district_id === null,
                    )
                    .map((d, index) => {
                      const measure = dataset.measures.find(
                        (m) => m.id === d.measure_id,
                      )!;
                      const Icon = measureIcons[measure.direction_id];
                      return (
                        <g
                          key={d.measure_id}
                          transform={`translate(${-56 + index * 28} 71)`}
                        >
                          <title>{`${measure.name} · ${d.district_id === null ? "Весь город" : "Условное место в районе"}`}</title>
                          <rect
                            x="-12"
                            y="-12"
                            width="24"
                            height="24"
                            rx="8"
                            fill="#315d91"
                            stroke="#fffef5"
                            strokeWidth="1.5"
                          />
                          <Icon
                            x={-7}
                            y={-7}
                            width={14}
                            height={14}
                            color="#fffef5"
                          />
                        </g>
                      );
                    })}
                </g>
              ) : null}
              {changes && Math.abs(changes[zone.id] ?? 0) > 0.001 ? (
                <g transform="translate(0 41)">
                  <rect
                    x="-33"
                    y="-9"
                    width="66"
                    height="20"
                    rx="10"
                    fill="#fffef5"
                  />
                  <text textAnchor="middle" y="5" fontSize="11" fill="#315d91">
                    {changes[zone.id] > 0 ? "+" : ""}
                    {changes[zone.id].toFixed(2)} п.
                  </text>
                </g>
              ) : null}
            </g>
          );
        })}
      </svg>
      <div className="map-orientation">
        <Navigation2 size={17} />
        <span>С</span>
      </div>
      <div className="map-controls">
        <button
          aria-label="Увеличить карту"
          onClick={() => zoom(0.8)}
          disabled={camera.width <= 780}
        >
          <Plus size={19} />
        </button>
        <button
          aria-label="Уменьшить карту"
          onClick={() => zoom(1.25)}
          disabled={camera.width >= 1500}
        >
          <Minus size={19} />
        </button>
        <button
          aria-label="Вернуть масштаб карты"
          onClick={() => setCamera({ x: -25, y: 0, width: 1250 })}
        >
          <Scan size={18} />
        </button>
      </div>
      <div className="map-attribution">
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
        >
          © OpenStreetMap · ODbL
        </a>
        <span>Условные границы и кварталы</span>
      </div>
    </div>
  );
}
