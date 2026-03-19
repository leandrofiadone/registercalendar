<script>
  import { gymKcalDetallado, actividadKcal } from '$lib/activity.js';

  let { ventanas = [], sessions = [], perfil = null } = $props();

  let trend = $derived.by(() => {
    if (!perfil?.metabolismo || !ventanas.length) return null;
    const me = perfil.metabolismo;
    const pesoKg = perfil.historial_peso?.at(-1)?.peso_kg ?? 80;

    // Last 7 completed days (excluding today)
    const today = new Date();
    const dates = [];
    for (let i = 1; i <= 7; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().split('T')[0];
      dates.push(iso);
    }

    let totalConsumed = 0;
    let totalSpent = 0;

    for (const date of dates) {
      const v = ventanas.find(vv => vv.ventana_id === date);
      totalConsumed += v?.totales_ventana?.kcal || 0;

      let actKcal = 0;
      // Gym session kcal
      const gymSess = sessions.find(s => s.date === date);
      if (gymSess) {
        const det = gymKcalDetallado(gymSess, pesoKg);
        actKcal += det.fuerza + det.cardio.reduce((sum, c) => sum + c.kcal, 0);
      }
      // Extra activities (walks, yoga, etc. from ventana.actividades)
      if (v?.actividades?.length) {
        for (const act of v.actividades) {
          actKcal += actividadKcal(act, pesoKg);
        }
      }

      totalSpent += (me.gasto_total_descanso_kcal || 2776) + actKcal;
    }

    const days = dates.length;
    if (!days) return null;
    const avgConsumed = Math.round(totalConsumed / days);
    const avgSpent = Math.round(totalSpent / days);
    const avgDeficit = avgSpent - avgConsumed;

    return { avgConsumed, avgSpent, avgDeficit, days };
  });
</script>

{#if trend}
  {@const ok = trend.avgDeficit >= 0}
  <div
    class="tc"
    style="color:{ok ? 'var(--green)' : 'var(--red)'};background:{ok ? 'rgba(16,185,129,.12)' : 'rgba(239,68,68,.12)'};border-color:{ok ? 'var(--green)' : 'var(--red)'}33"
    title="Últimos {trend.days}d: promedio {trend.avgConsumed} consumidas vs {trend.avgSpent} gastadas por día"
  >
    <span class="ti">{ok ? '📉' : '📈'}</span>
    <span class="tv">{ok ? '-' : '+'}{Math.abs(Math.round(trend.avgDeficit))}</span>
    <span class="tl">kcal/d · {trend.days}d</span>
  </div>
{/if}

<style>
  .tc {
    display: flex; align-items: center; gap: 5px;
    border: 1px solid; border-radius: 6px;
    padding: 3px 10px; font-size: 11px;
    white-space: nowrap; flex-shrink: 0;
    cursor: default;
  }
  .tv { font-weight: 700; font-variant-numeric: tabular-nums; }
  .tl { opacity: 0.85; }
</style>
