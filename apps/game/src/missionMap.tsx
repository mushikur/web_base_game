import { bn, type GameCatalog } from "@neta/shared";
import { checkpoints } from "./driving";
import {
  worldAreas,
  worldToMap,
  roadCorridors,
} from "../../../packages/shared/src/world-layout";
import {
  missionPhaseLabels,
  type MissionPhase,
} from "../../../packages/shared/src/missions";
import type { AreaId, Point2 } from "../../../packages/shared/src/world-layout";

export type MissionMapData = {
  selectedId: AreaId | null;
  activeId: AreaId | null;
  phases: Record<AreaId, MissionPhase>;
  completed: number;
  route: Point2[];
  routeDistance: number;
  routeMessage: string;
  pickups: (Point2 & { kind: string })[];
  vehicles: Point2[];
  safeStarts: Point2[];
  checkpoint?: AreaId;
  ambulance: Point2 | null;
  ambulances?: Point2[];
  friends: Point2[];
};
const mp = (p: Point2) => {
  const q = worldToMap(p);
  return { x: 8 + q.x * 184, y: 8 + q.y * 146 };
};
export function MissionMap({
  data,
  areas,
  player,
  yaw,
  expanded,
  onSelect,
  onOpen,
}: {
  data: MissionMapData;
  areas: GameCatalog["areas"];
  player: Point2;
  yaw: number;
  expanded?: boolean;
  onSelect?: (id: AreaId) => void;
  onOpen?: () => void;
}) {
  const p = mp(player);
  return (
    <aside
      className={`minimap ${expanded ? "map-expanded" : ""}`}
      aria-label="ঢাকার কাল্পনিক পাড়ার মানচিত্র"
    >
      <div className="map-head">
        <span>পাড়ার পথঘাট</span>
        <span className="north">উ</span>
      </div>
      <svg
        className="map-svg"
        viewBox="0 0 200 162"
        role="img"
        aria-label="পাঁচ এলাকা, আপনি, চলার পথ, চা, গাড়ি ও পাওয়া জিনিস"
      >
        <rect width="200" height="162" fill="#d8d3b5" />
        {roadCorridors.map((road) => {
          const a = mp(road.from),
            b = mp(road.to);
          return (
            <path
              key={road.id}
              d={`M${a.x} ${a.y}L${b.x} ${b.y}`}
              stroke="#758171"
              strokeWidth="9"
              fill="none"
            />
          );
        })}
        {worldAreas.map((area) => {
          const q = mp(area.center);
          return (
            <g key={area.id}>
              <rect
                x={q.x - 12}
                y={q.y - 14}
                width="24"
                height="28"
                rx="3"
                fill="#a7ae92"
                stroke="#ece0bd"
              />
              <path
                d={`M${q.x} ${q.y - 14}v28`}
                stroke="#73816e"
                strokeWidth="8"
              />
            </g>
          );
        })}
        {data.route.length > 1 && (
          <polyline
            points={data.route
              .map((p) => {
                const q = mp(p);
                return `${q.x},${q.y}`;
              })
              .join(" ")}
            stroke="#bf792c"
            strokeWidth="2"
            strokeDasharray="3 2"
            fill="none"
          />
        )}
        {worldAreas.map((area) => {
          const q = mp(area.entrance),
            phase = data.phases[area.id],
            done = phase === "completed";
          return (
            <g
              key={area.id}
              transform={`translate(${q.x} ${q.y})`}
              aria-label={`${areas[area.id].name} • ${missionPhaseLabels[phase]}`}
            >
              <circle
                r={data.selectedId === area.id ? 6 : 4.5}
                fill={
                  done
                    ? "#24785a"
                    : ["failed", "restartable"].includes(phase)
                      ? "#ad4939"
                      : "#e8ba53"
                }
                stroke={data.activeId === area.id ? "#fff6cf" : "#4b4931"}
                strokeWidth="1.4"
              />
              <text y="2.2" textAnchor="middle" fontSize="6" fill="#fff">
                {done ? "✓" : "⚑"}
              </text>
              {expanded && (
                <text
                  y="-8"
                  textAnchor="middle"
                  fontSize="5.8"
                  fill="#163e34"
                  fontWeight="700"
                >
                  {areas[area.id].name}
                </text>
              )}
            </g>
          );
        })}
        {worldAreas.map((area) => {
          const q = mp(area.teaShop);
          return (
            <text key={area.id} x={q.x} y={q.y} fontSize="7" fill="#593c23">
              <title>{areas[area.id].tea}</title>
              চা
            </text>
          );
        })}
        {data.pickups.map((v, i) => {
          const q = mp(v);
          return <circle key={i} cx={q.x} cy={q.y} r="1.7" fill="#b75628" />;
        })}
        {data.vehicles.map((v, i) => {
          const q = mp(v);
          return (
            <rect
              key={i}
              x={q.x - 2}
              y={q.y - 2}
              width="4"
              height="4"
              fill="#1a7c55"
              stroke="#fff2ce"
              strokeWidth=".4"
            />
          );
        })}
        {data.safeStarts.map((v, i) => {
          const q = mp(v);
          return (
            <path
              key={i}
              d={`m${q.x} ${q.y - 2} 2 2-2 2-2-2Z`}
              fill="#416a91"
            />
          );
        })}
        {expanded && checkpoints.map((point) => {
          const q = mp(point);
          return <g key={point.id} transform={`translate(${q.x} ${q.y})`} aria-label={point.name}>
            <path d="M-3 0 0-3 3 0 0 3Z" fill={data.checkpoint === point.id ? "#7c3ca2" : "#f4e8fa"} stroke="#69368a" />
          </g>;
        })}
        {(data.ambulances ?? (data.ambulance ? [data.ambulance] : [])).map(
          (point, index) => {
            const q = mp(point);
            return (
              <g
                key={index}
                transform={`translate(${q.x} ${q.y})`}
                aria-label="স্বস্তি সেবার গাড়ি"
              >
                <rect
                  x="-3"
                  y="-3"
                  width="6"
                  height="6"
                  fill="#fff8db"
                  stroke="#2e7666"
                />
                <path d="M-2 0h4M0-2v4" stroke="#2e7666" />
              </g>
            );
          },
        )}
        {data.friends.map((v, i) => {
          const q = mp(v);
          return <circle key={i} cx={q.x} cy={q.y} r="2" fill="#62adc7" />;
        })}
        <g
          transform={`translate(${p.x} ${p.y}) rotate(${(yaw * 180) / Math.PI})`}
        >
          <path
            d="m0-5 3.5 8L0 1.7-3.5 3Z"
            fill="#fff9d9"
            stroke="#183e34"
            strokeWidth="1.1"
          />
        </g>
      </svg>
      <div className="map-legend">
        ▲ আপনি • ⚑ এলাকা • ▣ গাড়ি • ◆ নিরাপদ শুরু{expanded && " • ◇ চেকপয়েন্ট"}
      </div>
      {!expanded && (
        <button
          className="map-open-button"
          aria-label="বড় মানচিত্র খুলুন"
          onClick={onOpen}
        >
          মানচিত্র <kbd>M</kbd>
        </button>
      )}
      {expanded && onSelect && (
        <div className="mission-map-list">
          {worldAreas.map((area) => (
            <button
              key={area.id}
              onClick={() => onSelect(area.id)}
              aria-pressed={data.selectedId === area.id}
            >
              <strong>{areas[area.id].name}</strong>
              <small>{missionPhaseLabels[data.phases[area.id]]}</small>
            </button>
          ))}
        </div>
      )}
      {expanded && (
        <p className="map-route-info">
          {data.routeMessage}
          {data.routeDistance > 0 ? ` • ${bn(data.routeDistance)} মিটার` : ""} •
          পথ খোলা {bn(data.completed)}/{bn(5)}
        </p>
      )}
    </aside>
  );
}
