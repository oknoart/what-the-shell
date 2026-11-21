export const DEFAULTS = { W: 2.0, D: 0.25, T: 1.5 };

export const PRESETS = {
  ammonite: { W: 2.2, D: 0.15, T: 0.0 },
  turritella: { W: 1.35, D: 0.1, T: 4.5 },
  snail: { W: 2.0, D: 0.25, T: 1.5 },
  ramshorn: { W: 1.8, D: 0.65, T: 0.8 },
  // Stylized: a real abalone is a low-spired, ear-shaped shell.
  abalone: { W: 8.0, D: 0.1, T: 0.4 },
};

const PARAMS = ['W', 'D', 'T'];

/**
 * Wire up the control panel.
 *
 * @param {object} handlers
 * @param {(params: {W:number,D:number,T:number}) => void} handlers.onChange
 * @param {(enabled: boolean) => void} handlers.onWireframe
 * @param {(enabled: boolean) => void} handlers.onAutoRotate
 */
export function createControls({ onChange, onWireframe, onAutoRotate }) {
  const inputs = {};
  const outputs = {};

  for (const key of PARAMS) {
    inputs[key] = document.getElementById(key);
    outputs[key] = document.getElementById(`${key}-value`);
  }

  function readParams() {
    return {
      W: Number(inputs.W.value),
      D: Number(inputs.D.value),
      T: Number(inputs.T.value),
    };
  }

  function renderOutputs() {
    for (const key of PARAMS) {
      const decimals = key === 'W' ? 2 : 2;
      outputs[key].value = Number(inputs[key].value).toFixed(decimals);
    }
  }

  function emit() {
    renderOutputs();
    onChange(readParams());
  }

  function setParams(params) {
    for (const key of PARAMS) {
      if (params[key] === undefined) continue;
      inputs[key].value = String(params[key]);
    }
    emit();
  }

  for (const key of PARAMS) {
    inputs[key].addEventListener('input', emit);
  }

  for (const button of document.querySelectorAll('[data-preset]')) {
    button.addEventListener('click', () => {
      const preset = PRESETS[button.dataset.preset];
      if (preset) setParams(preset);
    });
  }

  document.getElementById('reset').addEventListener('click', () => {
    setParams(DEFAULTS);
  });

  const wireframe = document.getElementById('wireframe');
  wireframe.addEventListener('change', () => onWireframe(wireframe.checked));

  const autorotate = document.getElementById('autorotate');
  autorotate.addEventListener('change', () => onAutoRotate(autorotate.checked));

  renderOutputs();

  return { setParams, getParams: readParams };
}
