import { json } from '@sveltejs/kit';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// Precios por 1M tokens (USD) — actualizar si cambian
const PRICING = {
  'claude-haiku-4-5-20251001': { in: 0.80,  out: 4.00  },
  'claude-sonnet-4-6':         { in: 3.00,  out: 15.00 },
};

function costUSD(model, tokIn, tokOut) {
  const p = PRICING[model];
  if (!p || tokIn == null) return null;
  return (tokIn / 1_000_000) * p.in + (tokOut / 1_000_000) * p.out;
}

export function GET() {
  const path = join('data', 'tokens_log.json');
  if (!existsSync(path)) return json({ ok: true, requests: [], stats: null });

  const log = JSON.parse(readFileSync(path, 'utf-8'));
  const reqs = log.requests ?? [];

  // Estadísticas agregadas
  let totalIn = 0, totalOut = 0, totalCost = 0, costKnown = 0;
  const byModel   = {};
  const byTipo    = {};
  const byModo    = {};
  const byRespuesta = { json: 0, texto: 0 };
  const daily     = {};

  for (const r of reqs) {
    const day = r.ts?.slice(0, 10) ?? 'unknown';
    totalIn  += r.tok_in  ?? 0;
    totalOut += r.tok_out ?? 0;

    const c = costUSD(r.modelo, r.tok_in, r.tok_out);
    if (c != null) { totalCost += c; costKnown++; }

    byModel[r.modelo]     = (byModel[r.modelo]     ?? 0) + 1;
    byTipo[r.tipo]        = (byTipo[r.tipo]         ?? 0) + 1;
    byModo[r.modo]        = (byModo[r.modo]         ?? 0) + 1;
    byRespuesta[r.respuesta ?? 'texto']++;
    daily[day] = (daily[day] ?? 0) + 1;
  }

  // Últimos 30 días ordenados
  const dailySorted = Object.entries(daily)
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 30)
    .map(([date, count]) => ({ date, count }));

  // Últimas 20 requests con costo
  const recent = reqs.slice(-20).reverse().map(r => ({
    ...r,
    costo_usd: costUSD(r.modelo, r.tok_in, r.tok_out),
  }));

  return json({
    ok: true,
    stats: {
      total_requests: reqs.length,
      total_tok_in:   totalIn,
      total_tok_out:  totalOut,
      total_costo_usd: totalCost,
      costo_conocido:  costKnown,
      by_model:   byModel,
      by_tipo:    byTipo,
      by_modo:    byModo,
      by_respuesta: byRespuesta,
      daily:      dailySorted,
    },
    recent,
  });
}
