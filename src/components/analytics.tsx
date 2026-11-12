"use client";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { ChartNoAxesCombined, Target, Check, TrendingUp } from "lucide-react";
import type { StudyData } from "@/lib/data";
export function Analytics({
  data,
  topics,
  sessions,
  exerciseCount,
}: {
  data: StudyData;
  topics: { topic: string; correct: number; total: number }[];
  sessions: { duration_seconds: number; created_at: string }[];
  exerciseCount: number;
}) {
  const points = [...data.attempts].reverse().map((a, i) => ({
    name: `QCM ${i + 1}`,
    score: Math.round((100 * a.score) / a.total),
  }));
  const total = data.attempts.reduce((n, a) => n + a.total, 0);
  const correct = data.attempts.reduce((n, a) => n + a.score, 0);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { name: "QCM terminés", value: data.attempts.length, Icon: Check },
          {
            name: "Précision",
            value: total ? `${Math.round((100 * correct) / total)}%` : "—",
            Icon: Target,
          },
          {
            name: "Temps en session",
            value: `${Math.round(sessions.reduce((n, s) => n + s.duration_seconds, 0) / 60)} min`,
            Icon: TrendingUp,
          },
          {
            name: "Exercices terminés",
            value: exerciseCount,
            Icon: ChartNoAxesCombined,
          },
        ].map((x) => (
          <div className="panel p-5" key={x.name}>
            <div className="flex justify-between text-xs muted">
              {x.name}
              <x.Icon size={17} />
            </div>
            <p className="text-3xl font-semibold mt-5">{x.value}</p>
          </div>
        ))}
      </div>
      <section className="panel p-6">
        <h2 className="font-semibold">L’évolution de vos résultats</h2>
        <p className="muted text-xs mt-2">
          Vos 30 dernières tentatives terminées · QCM et examens blancs.
        </p>
        {points.length ? (
          <div className="h-72 mt-6">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={points}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: "var(--secondary)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 10, fill: "var(--secondary)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--panel)",
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="score"
                  name="Précision (%)"
                  stroke="#15946a"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-64 empty-pattern mt-5 rounded-xl flex flex-col items-center justify-center text-center">
            <ChartNoAxesCombined size={34} className="muted mb-4" />
            <p className="font-semibold">Votre progression se dessinera ici.</p>
            <p className="muted text-xs mt-3">
              Terminez votre premier QCM pour commencer.
            </p>
          </div>
        )}
      </section>
      <section className="panel p-6">
        <h2 className="font-semibold">Notions à consolider</h2>
        <p className="muted text-xs mt-2">
          Précision observée par sujet, calculée à partir de vos réponses.
        </p>
        {topics.length ? (
          <div className="space-y-5 mt-6">
            {topics
              .sort((a, b) => a.correct / a.total - b.correct / b.total)
              .slice(0, 10)
              .map((t, i) => (
                <div key={`${t.topic}-${i}`}>
                  <div className="text-xs flex justify-between mb-2">
                    <span>{t.topic}</span>
                    <span className="muted">
                      {t.correct}/{t.total} ·{" "}
                      {Math.round((t.correct / t.total) * 100)}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[var(--muted)]">
                    <div
                      className="h-full rounded-full bg-emerald-600"
                      style={{ width: `${(100 * t.correct) / t.total}%` }}
                    />
                  </div>
                </div>
              ))}
          </div>
        ) : (
          <p className="text-xs muted py-8">
            Pas encore de réponses associées à un module.
          </p>
        )}
      </section>
      <p className="text-xs muted">
        Ces indicateurs reflètent vos activités dans l’application. Le temps en
        session inclut le temps entre le démarrage et la soumission, plafonné à
        5 heures.
      </p>
    </div>
  );
}
