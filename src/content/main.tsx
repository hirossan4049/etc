import { createRoot } from 'react-dom/client';
import { FloatingButton } from './floating-button';
import { isLoggedInPage } from './site-detect';

function mount() {
  if (!isLoggedInPage()) return;
  if (document.getElementById('etc-dashboard-host')) return;

  const host = document.createElement('div');
  host.id = 'etc-dashboard-host';
  document.body.appendChild(host);
  const shadow = host.attachShadow({ mode: 'open' });
  const mountPoint = document.createElement('div');
  shadow.appendChild(mountPoint);

  const root = createRoot(mountPoint);
  root.render(
    <FloatingButton
      retrievedCount={0}
      onClick={() => {
        chrome.runtime.sendMessage({ type: 'OPEN_DASHBOARD' });
      }}
    />,
  );
}

mount();
