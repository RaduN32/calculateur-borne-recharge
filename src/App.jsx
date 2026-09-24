import { useMemo, useState } from 'react';

const BREAKER_SIZES = [15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100, 110, 125, 150, 175, 200, 225, 250, 300, 350, 400, 450, 500, 600];

// Couleurs de l'Academie Polara (theme sombre), en dehors du CSS car
// utilisees dans des attributs SVG calcules dynamiquement.
const COLOR_SUCCESS = '#35c98d';
const COLOR_ORANGE = '#ff450a';
const COLOR_DANGER = '#e57a68';
const COLOR_HEADING = '#eef1ff';

function nextBreaker(amps) {
  return BREAKER_SIZES.find((b) => b >= amps) ?? BREAKER_SIZES[BREAKER_SIZES.length - 1];
}

// Champ numerique en texte libre : permet d'effacer completement le champ
// et de taper un nouveau nombre sans qu'un "0" residuel reste colle devant
// (bug classique des inputs type="number" controles par React).
const NUMBER_RE = /^\d*\.?\d*$/;

export default function App() {
  const [powerInput, setPowerInput] = useState('40');
  const [voltageInput, setVoltageInput] = useState('600');
  const [phase, setPhase] = useState('triphase');
  const [pf, setPf] = useState(0.98);
  const [continuous, setContinuous] = useState(true);

  const power = parseFloat(powerInput) || 0;
  const voltage = parseFloat(voltageInput) || 0;

  const results = useMemo(() => {
    const P = power * 1000;
    const rawCurrent = voltage <= 0 ? 0 : phase === 'triphase' ? P / (Math.sqrt(3) * voltage * pf) : P / (voltage * pf);
    const designCurrent = continuous ? rawCurrent * 1.25 : rawCurrent;
    const breaker = nextBreaker(designCurrent);
    const loadPct = Math.min(100, (rawCurrent / breaker) * 100);
    return { rawCurrent, designCurrent, breaker, loadPct };
  }, [power, voltage, phase, pf, continuous]);

  const zoneColor = results.loadPct < 60 ? COLOR_SUCCESS : results.loadPct < 85 ? COLOR_ORANGE : COLOR_DANGER;
  const needleAngle = -90 + (results.loadPct / 100) * 180;

  return (
    <>
      <div className="header">
        <div className="eyebrow">⚡ CALCULATEUR TECHNIQUE</div>
        <h1>Dimensionnement électrique — bornes de recharge</h1>
        <div className="subtitle">Calcul du courant nominal, du calibre de disjoncteur et de l'ampacité minimale requise.</div>
      </div>

      <div className="grid">
        <div className="panel">
          <div className="panel-label">Paramètres du circuit</div>

          <div className="field">
            <label>Puissance de la borne (kW)</label>
            <input
              type="text"
              inputMode="decimal"
              value={powerInput}
              onChange={(e) => {
                const v = e.target.value;
                if (NUMBER_RE.test(v)) setPowerInput(v);
              }}
              onBlur={() => {
                if (powerInput === '' || powerInput === '.') setPowerInput('0');
              }}
            />
          </div>

          <div className="field">
            <label>Tension (V)</label>
            <input
              type="text"
              inputMode="decimal"
              value={voltageInput}
              onChange={(e) => {
                const v = e.target.value;
                if (NUMBER_RE.test(v)) setVoltageInput(v);
              }}
              onBlur={() => {
                if (voltageInput === '' || voltageInput === '.') setVoltageInput('0');
              }}
            />
          </div>

          <div className="field">
            <label>Type de circuit</label>
            <div className="phase-row">
              <button
                className={`phase-btn ${phase === 'monophase' ? 'active' : ''}`}
                onClick={() => setPhase('monophase')}
              >
                Monophasé
              </button>
              <button
                className={`phase-btn ${phase === 'triphase' ? 'active' : ''}`}
                onClick={() => setPhase('triphase')}
              >
                Triphasé
              </button>
            </div>
          </div>

          <div className="field">
            <label>
              Facteur de puissance{' '}
              <span className="mono" style={{ color: COLOR_ORANGE }}>{pf.toFixed(2)}</span>
            </label>
            <input
              type="range"
              min="0.8"
              max="1"
              step="0.01"
              value={pf}
              onChange={(e) => setPf(Number(e.target.value))}
            />
          </div>

          <div className="field">
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={continuous}
                onChange={(e) => setContinuous(e.target.checked)}
              />
              Charge continue — appliquer la marge de 125%
            </label>
          </div>

          <div className="note">
            ℹ️ Une borne de recharge est considérée comme une charge continue (fonctionnement &gt; 3h).
            Le code électrique exige alors un dimensionnement à 125% du courant nominal.
          </div>
        </div>

        <div className="panel">
          <div className="panel-label">Résultats</div>

          <div className="gauge-wrap">
            <svg width="220" height="130" viewBox="0 0 220 130">
              <path d="M 20 110 A 90 90 0 0 1 82 27" stroke={COLOR_SUCCESS} strokeWidth="14" fill="none" strokeLinecap="round" />
              <path d="M 82 27 A 90 90 0 0 1 138 27" stroke={COLOR_ORANGE} strokeWidth="14" fill="none" strokeLinecap="round" />
              <path d="M 138 27 A 90 90 0 0 1 200 110" stroke={COLOR_DANGER} strokeWidth="14" fill="none" strokeLinecap="round" />
              <g transform={`rotate(${needleAngle} 110 110)`}>
                <line x1="110" y1="110" x2="110" y2="35" stroke={COLOR_HEADING} strokeWidth="3" strokeLinecap="round" />
              </g>
              <circle cx="110" cy="110" r="7" fill={COLOR_HEADING} />
            </svg>
          </div>
          <div className="gauge-pct">
            <span className="val mono" style={{ color: zoneColor }}>{results.loadPct.toFixed(0)}%</span>
            <div className="lbl">charge du disjoncteur</div>
          </div>

          <div className="result-row">
            <span className="result-label">📟 Courant nominal</span>
            <span className="result-value mono">{results.rawCurrent.toFixed(1)} A</span>
          </div>
          <div className="result-row">
            <span className="result-label">⚡ Courant de conception (125%)</span>
            <span className="result-value mono">{results.designCurrent.toFixed(1)} A</span>
          </div>
          <div className="result-row last">
            <span className="result-label">⚠️ Disjoncteur recommandé</span>
            <span className="result-value mono" style={{ color: COLOR_ORANGE, fontSize: '18px' }}>{results.breaker} A</span>
          </div>
          <div className="result-row last">
            <span className="result-label">🔌 Ampacité minimale du câble</span>
            <span className="result-value mono" style={{ color: COLOR_SUCCESS, fontSize: '18px' }}>{results.designCurrent.toFixed(1)} A</span>
          </div>
        </div>
      </div>

      <div className="disclaimer">
        Cet outil fournit une estimation basée sur des formules standards (I = P / (√3 × V × FP) en triphasé).
        Le calibre final du disjoncteur, le câblage et le calibre AWG doivent être confirmés selon le Code de
        l'électricité applicable (CCE/NEC) et validés par un électricien ou ingénieur qualifié, en tenant compte
        de la longueur des câbles, du mode d'installation et des chutes de tension.
      </div>
    </>
  );
}
