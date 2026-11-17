import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';
import './original.css';
import './recovery.css';

// Measure actual Flex gap support (Grid gap support alone is insufficient).
const gapProbe = document.createElement('div'); gapProbe.style.cssText = 'display:flex;flex-direction:column;row-gap:1px;position:absolute;visibility:hidden';
gapProbe.append(document.createElement('div'), document.createElement('div')); document.body.appendChild(gapProbe);
if (gapProbe.scrollHeight !== 1) document.documentElement.classList.add('no-flex-gap'); gapProbe.remove();

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);

import './v1.css';
