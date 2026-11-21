import { createShellViewer } from './scene/shellViewer.js';
import { createControls, DEFAULTS } from './ui/controls.js';

const viewport = document.getElementById('viewport');
const viewer = createShellViewer(viewport);

viewer.update(DEFAULTS);

createControls({
  onChange: (params) => viewer.update(params),
  onWireframe: (enabled) => viewer.setWireframe(enabled),
  onAutoRotate: (enabled) => viewer.setAutoRotate(enabled),
});
