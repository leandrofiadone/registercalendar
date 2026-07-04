<div class="hero">
  <h1>Lab</h1>
  <p>
    Espacio para probar alternativas radicales a la app, sin tocar lo existente.
    Cada experimento explora una hipotesis distinta sobre <em>cuanto input</em> realmente vale la pena pedirte.
  </p>

  <ul class="hyp">
    <li>
      <strong>diario</strong> — Una sola entrada por dia con 3 campos cortos: peso, si entrenaste o no, y una linea de como te fue.
      Sin macros, sin sets, sin tablas.
    </li>
    <li>
      <strong>minimo</strong> — Y si la app no pide casi nada: solo el peso una vez por semana y devuelve tendencia.
      Resto: cero friccion.
    </li>
  </ul>

  <p class="foot">
    Los experimentos leen tus datos actuales (perfil, peso) pero no los modifican.
    El diario guarda en <code>data/diario.json</code>, archivo nuevo y aislado.
  </p>
</div>

<style>
  .hero {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    padding: 1rem 0;
  }
  h1 {
    font-family: var(--font-display);
    font-size: 1.8rem;
    font-weight: 600;
  }
  p { color: var(--muted); line-height: 1.6; }
  em { color: var(--text); font-style: italic; }
  .hyp { list-style: none; display: flex; flex-direction: column; gap: 0.75rem; }
  .hyp li {
    padding: 0.85rem 1rem;
    background: var(--s1);
    border: 1px solid var(--b1);
    border-left: 2px solid var(--accent);
    border-radius: 4px;
    color: var(--muted);
    font-size: 0.92rem;
    line-height: 1.55;
  }
  strong { color: var(--text); font-family: var(--font-mono); font-size: 0.85rem; letter-spacing: 0.05em; text-transform: uppercase; }
  .foot {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    color: var(--dim);
    padding-top: 0.75rem;
    border-top: 1px dashed var(--b1);
  }
  code { background: var(--s2); padding: 0.1rem 0.35rem; border-radius: 3px; font-size: 0.75rem; color: var(--accent-l); }
</style>
