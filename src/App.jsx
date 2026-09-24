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

function NumberField({ label, value, onChange, suffix, placeholder }) {
  const body = (
    <input
      type="text"
      inputMode="decimal"
      value={value}
      placeholder={placeholder}
      onChange={(e) => {
        const v = e.target.value;
        if (NUMBER_RE.test(v)) onChange(v);
      }}
      onBlur={() => {
        if (value === '' || value === '.') onChange('0');
      }}
    />
  );
  return (
    <div className="field">
      <label>{label}</label>
      {suffix ? (
        <div className="input-unit-wrap">
          {body}
          <span className="input-unit-suffix">{suffix}</span>
        </div>
      ) : body}
    </div>
  );
}

export default function App() {
  const [mode, setMode] = useState('direct'); // 'direct' | 'inverse' | 'capacity'
  const [powerInput, setPowerInput] = useState('40');
  const [voltageInput, setVoltageInput] = useState('600');
  const [breakerInput, setBreakerInput] = useState('60');
  const [phase, setPhase] = useState('triphase');
  const [pf, setPf] = useState(0.98);
  const [continuous, setContinuous] = useState(true);

  const [kvaInput, setKvaInput] = useState('225');
  const [existingLoadInput, setExistingLoadInput] = useState('0');
  const [chargerKwInput, setChargerKwInput] = useState('19.2');
  const [chargerPreset, setChargerPreset] = useState('ac');

  const power = parseFloat(powerInput) || 0;
  const voltage = parseFloat(voltageInput) || 0;
  const breakerAmps = parseFloat(breakerInput) || 0;
  const kva = parseFloat(kvaInput) || 0;
  const existingLoad = parseFloat(existingLoadInput) || 0;
  const chargerKw = parseFloat(chargerKwInput) || 0;

  function selectPreset(preset, kw) {
    setChargerPreset(preset);
    setChargerKwInput(String(kw));
  }

  const results = useMemo(() => {
    if (mode === 'inverse') {
      // Le disjoncteur existant fixe le courant de conception maximal admissible ;
      // on retire la marge de 125% pour retrouver le courant nominal max, puis la puissance.
      const breaker = breakerAmps;
      const designCurrent = breaker;
      const rawCurrent = continuous ? designCurrent / 1.25 : designCurrent;
      const maxPowerW = voltage <= 0 ? 0 : phase === 'triphase' ? rawCurrent * Math.sqrt(3) * voltage * pf : rawCurrent * voltage * pf;
      const loadPct = breaker <= 0 ? 0 : Math.min(100, (rawCurrent / breaker) * 100);
      return { rawCurrent, designCurrent, breaker, loadPct, maxPowerKw: maxPowerW / 1000 };
    }

    if (mode === 'capacity') {
      // kVA de la plaque signaletique x facteur de puissance = puissance reelle disponible (kW).
      const availableKw = kva * pf;
      const remainingBeforeKw = Math.max(0, availableKw - existingLoad);
      const perChargerKw = continuous ? chargerKw * 1.25 : chargerKw;
      const count = perChargerKw > 0 ? Math.floor(remainingBeforeKw / perChargerKw) : 0;
      const usedByNew = count * perChargerKw;
      const remainingAfterKw = remainingBeforeKw - usedByNew;
      const shortfallForOneMore = perChargerKw - remainingAfterKw;
      const loadPct = availableKw > 0 ? Math.min(100, ((existingLoad + usedByNew) / availableKw) * 100) : 0;
      return { availableKw, remainingBeforeKw, perChargerKw, count, usedByNew, remainingAfterKw, shortfallForOneMore, loadPct };
    }

    const P = power * 1000;
    const rawCurrent = voltage <= 0 ? 0 : phase === 'triphase' ? P / (Math.sqrt(3) * voltage * pf) : P / (voltage * pf);
    const designCurrent = continuous ? rawCurrent * 1.25 : rawCurrent;
    const breaker = nextBreaker(designCurrent);
    const loadPct = Math.min(100, (rawCurrent / breaker) * 100);
    return { rawCurrent, designCurrent, breaker, loadPct, maxPowerKw: null };
  }, [mode, power, voltage, breakerAmps, phase, pf, continuous, kva, existingLoad, chargerKw]);

  const zoneColor = results.loadPct < 60 ? COLOR_SUCCESS : results.loadPct < 85 ? COLOR_ORANGE : COLOR_DANGER;
  const needleAngle = -90 + (results.loadPct / 100) * 180;

  return (
    <>
      <div className="header">
        <div className="eyebrow">⚡ CALCULATEUR TECHNIQUE</div>
        <h1>Dimensionnement électrique — bornes de recharge</h1>
        <div className="subtitle">Calcul du courant nominal, du calibre de disjoncteur, de la puissance maximale et du nombre de bornes installables.</div>
      </div>

      <div className="grid">
        <div className="panel">
          <div className="panel-label">Paramètres</div>

          <div className="field">
            <label>Sens du calcul</label>
            <div className="mode-row">
              <button
                className={`phase-btn ${mode === 'direct' ? 'active' : ''}`}
                onClick={() => setMode('direct')}
              >
                Puissance d'une borne → Disjoncteur
              </button>
              <button
                className={`phase-btn ${mode === 'inverse' ? 'active' : ''}`}
                onClick={() => setMode('inverse')}
              >
                Disjoncteur → Puissance max d'une borne
              </button>
              <button
                className={`phase-btn ${mode === 'capacity' ? 'active' : ''}`}
                onClick={() => setMode('capacity')}
              >
                Capacité du transfo (kVA) → Nombre de bornes
              </button>
            </div>
          </div>

          {mode === 'direct' && (
            <NumberField label="Puissance de la borne (kW)" value={powerInput} onChange={setPowerInput} />
          )}

          {mode === 'inverse' && (
            <NumberField label="Disjoncteur disponible" value={breakerInput} onChange={setBreakerInput} suffix="A" />
          )}

          {mode === 'capacity' && (
            <>
              <NumberField label="Puissance du transformateur (plaque signalétique)" value={kvaInput} onChange={setKvaInput} suffix="kVA" />
              <NumberField label="Charge déjà utilisée sur ce transfo" value={existingLoadInput} onChange={setExistingLoadInput} suffix="kW" placeholder="0 si site neuf" />

              <div className="field">
                <label>Préréglages rapides</label>
                <div className="phase-row">
                  <button
                    className={`phase-btn ${chargerPreset === 'ac' ? 'active' : ''}`}
                    onClick={() => selectPreset('ac', 19.2)}
                  >
                    AC 19.2 kW
                  </button>
                  <button
                    className={`phase-btn ${chargerPreset === 'dc' ? 'active' : ''}`}
                    onClick={() => selectPreset('dc', 40)}
                  >
                    DC 40 kW
                  </button>
                  <button
                    className={`phase-btn ${chargerPreset === 'custom' ? 'active' : ''}`}
                    onClick={() => setChargerPreset('custom')}
                  >
                    Personnalisé
                  </button>
                </div>
              </div>

              <NumberField
                label="Puissance par borne (kW)"
                value={chargerKwInput}
                onChange={(v) => { setChargerKwInput(v); setChargerPreset('custom'); }}
                suffix="kW"
              />
            </>
          )}

          {mode !== 'capacity' && (
            <NumberField label="Tension (V)" value={voltageInput} onChange={setVoltageInput} />
          )}

          {mode !== 'capacity' && (
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
          )}

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
              {mode === 'capacity' ? 'Charge continue — appliquer la marge de 125% par borne' : 'Charge continue — appliquer la marge de 125%'}
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
            <div className="lbl">{mode === 'capacity' ? 'utilisation totale du transfo' : 'charge du disjoncteur'}</div>
          </div>

          {mode === 'inverse' && (
            <div className="result-row">
              <span className="result-label">🔋 Puissance maximale de la borne</span>
              <span className="result-value mono" style={{ color: COLOR_ORANGE, fontSize: '18px' }}>{results.maxPowerKw.toFixed(1)} kW</span>
            </div>
          )}

          {mode !== 'capacity' && (
            <>
              <div className="result-row">
                <span className="result-label">📟 Courant nominal{mode === 'inverse' ? ' max' : ''}</span>
                <span className="result-value mono">{results.rawCurrent.toFixed(1)} A</span>
              </div>
              <div className="result-row">
                <span className="result-label">⚡ Courant de conception (125%)</span>
                <span className="result-value mono">{results.designCurrent.toFixed(1)} A</span>
              </div>
              <div className="result-row last">
                <span className="result-label">{mode === 'inverse' ? '⚠️ Disjoncteur utilisé' : '⚠️ Disjoncteur recommandé'}</span>
                <span className="result-value mono" style={{ color: COLOR_ORANGE, fontSize: '18px' }}>{results.breaker} A</span>
              </div>
              <div className="result-row last">
                <span className="result-label">🔌 Ampacité minimale du câble</span>
                <span className="result-value mono" style={{ color: COLOR_SUCCESS, fontSize: '18px' }}>{results.designCurrent.toFixed(1)} A</span>
              </div>
            </>
          )}

          {mode === 'capacity' && (
            <>
              <div className="result-row">
                <span className="result-label">🔢 Bornes installables</span>
                <span className="result-value mono" style={{ color: COLOR_ORANGE, fontSize: '18px' }}>{results.count}</span>
              </div>
              <div className="result-row">
                <span className="result-label">🏭 Capacité totale du transfo</span>
                <span className="result-value mono">{results.availableKw.toFixed(1)} kW</span>
              </div>
              <div className="result-row">
                <span className="result-label">📉 Déjà utilisé</span>
                <span className="result-value mono">{existingLoad.toFixed(1)} kW</span>
              </div>
              <div className="result-row">
                <span className="result-label">✅ Disponible avant ajout</span>
                <span className="result-value mono">{results.remainingBeforeKw.toFixed(1)} kW</span>
              </div>
              <div className="result-row">
                <span className="result-label">⚡ Requis par borne (125%)</span>
                <span className="result-value mono">{results.perChargerKw.toFixed(1)} kW</span>
              </div>
              <div className="result-row last">
                <span className="result-label">🔋 Utilisé par les nouvelles bornes</span>
                <span className="result-value mono">{results.usedByNew.toFixed(1)} kW</span>
              </div>
              <div className="result-row last">
                <span className="result-label">🔌 Capacité restante après installation</span>
                <span className="result-value mono" style={{ color: COLOR_SUCCESS, fontSize: '18px' }}>{results.remainingAfterKw.toFixed(1)} kW</span>
              </div>
              {results.remainingAfterKw > 0 && results.remainingAfterKw < results.perChargerKw && (
                <div className="note" style={{ marginTop: '12px' }}>
                  ℹ️ Il reste {results.remainingAfterKw.toFixed(1)} kW après ces {results.count} borne(s) — insuffisant pour une borne
                  additionnelle de cette taille. Il faudrait {results.shortfallForOneMore.toFixed(1)} kW de plus.
                </div>
              )}
              {results.count === 0 && (
                <div className="note" style={{ marginTop: '12px' }}>
                  ⚠️ Aucune borne de cette taille ne peut être ajoutée avec la capacité restante actuelle.
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div className="disclaimer">
        Cet outil fournit une estimation basée sur des formules standards (I = P / (√3 × V × FP) en triphasé, kW = kVA × FP).
        Le calibre final du disjoncteur, le câblage, le calibre AWG et la capacité réelle du transformateur doivent être confirmés
        selon le Code de l'électricité applicable (CCE/NEC) et validés par un électricien ou ingénieur qualifié, en tenant compte
        de la longueur des câbles, du mode d'installation, des chutes de tension et de la charge existante réelle du site.
      </div>
    </>
  );
}
