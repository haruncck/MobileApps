import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { AppStoreProvider } from './store/AppStore';

/*
 * Güncelleme: yeni sürüm arka planda hemen yüklenir (skipWaiting), ama sayfa kendiliğinden yenilenmez.
 * Yeni sürüm devreye girince "Güncelle" düğmesi gösterilir; kayıtlar her değişiklikte zaten kaydedildiği için
 * yenileme veri kaybettirmez.
 */
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker
    .register('./sw.js', { scope: './' })
    .then((reg) => {
      // Uygulama öne geldikçe yeni sürüm var mı diye bak
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') reg.update().catch(() => undefined);
      });
    })
    .catch(() => undefined);
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController) window.dispatchEvent(new CustomEvent('hd:update-ready'));
  });
}
(window as unknown as { __hdUpdate: () => void }).__hdUpdate = () => location.reload();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppStoreProvider>
      <App />
    </AppStoreProvider>
  </StrictMode>,
);
