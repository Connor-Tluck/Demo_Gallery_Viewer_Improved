/**
 * Creates a loading overlay with progress bar for mesh loading.
 * Call show() before load, updateProgress(loaded, total) during load, hide() when done.
 * Automatically tracks load time and reports it to the parent frame via postMessage.
 * @param {Object} [options] - Optional configuration
 * @param {boolean} [options.isNonGltf] - If true, shows warning that OBJ/non-GLTF formats load slower than GLTF
 * @param {boolean} [options.isLargeFile] - If true, shows warning that this is a large file and will take time to load
 */
export function createMeshLoadingOverlay(options = {}) {
  const { isNonGltf = false, isLargeFile = false } = options;
  let loadStartTime = null;
  const warnings = [];
  if (isNonGltf) warnings.push('OBJ and other non-GLTF formats load slower than GLTF examples.');
  if (isLargeFile) warnings.push('This is a large file and will take some time to load.');

  const overlay = document.createElement('div');
  overlay.id = 'mesh-loading-overlay';
  overlay.innerHTML = `
    <div class="mesh-loading-content">
      <div class="mesh-loading-spinner"></div>
      <p class="mesh-loading-text">Loading mesh...</p>
      ${warnings.length ? `<p class="mesh-loading-warning">${warnings.join(' ')}</p>` : ''}
      <div class="mesh-loading-bar"><div class="mesh-loading-progress"></div></div>
    </div>
  `;
  overlay.style.cssText = `
    position: fixed; inset: 0; z-index: 9999; background: rgba(0,0,0,0.7);
    display: flex; align-items: center; justify-content: center;
    font-family: system-ui, sans-serif; color: #fff;
  `;
  const content = overlay.querySelector('.mesh-loading-content');
  content.style.cssText = `
    text-align: center; padding: 2rem; background: rgba(0,0,0,0.5);
    border-radius: 12px; min-width: 280px;
  `;
  const progressBar = overlay.querySelector('.mesh-loading-progress');
  overlay.querySelector('.mesh-loading-bar').style.cssText = `
    width: 100%; height: 6px; background: rgba(255,255,255,0.2);
    border-radius: 3px; overflow: hidden; margin-top: 1rem;
  `;
  progressBar.style.cssText = `
    height: 100%; background: #049EF4; width: 0%; transition: width 0.15s;
  `;
  overlay.querySelector('.mesh-loading-spinner').style.cssText = `
    width: 40px; height: 40px; border: 3px solid rgba(255,255,255,0.3);
    border-top-color: #049EF4; border-radius: 50%; animation: mesh-spin 0.8s linear infinite;
    margin: 0 auto 1rem;
  `;
  const warningEl = overlay.querySelector('.mesh-loading-warning');
  if (warningEl) {
    warningEl.style.cssText = `
      font-size: 12px; color: rgba(255,255,255,0.85); margin-top: 0.5rem; max-width: 260px;
      line-height: 1.4;
    `;
  }
  const style = document.createElement('style');
  style.textContent = '@keyframes mesh-spin { to { transform: rotate(360deg); } }';
  document.head.appendChild(style);

  function reportLoadTime() {
    if (loadStartTime == null || window.self === window.top) return;
    const elapsed = Date.now() - loadStartTime;
    const pageFile = window.location.pathname.split('/').pop().replace('.html', '');
    try {
      window.parent.postMessage({
        type: 'meshLoadTime',
        mesh: document.title || pageFile,
        meshId: pageFile,
        meshType: isNonGltf ? 'obj' : 'gltf',
        loadTimeMs: elapsed
      }, '*');
    } catch (_) {}
  }

  return {
    show: () => { loadStartTime = Date.now(); document.body.appendChild(overlay); },
    hide: () => { reportLoadTime(); overlay.remove(); },
    updateProgress: (loaded, total) => {
      const pct = total ? Math.min(100, (loaded / total) * 100) : 0;
      progressBar.style.width = pct + '%';
      overlay.querySelector('.mesh-loading-text').textContent =
        total ? `Loading mesh... ${Math.round(pct)}%` : 'Loading mesh...';
    }
  };
}
