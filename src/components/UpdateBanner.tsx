import { usePwaUpdate } from '../lib/PwaUpdate';

export function UpdateBanner() {
  const { bannerVisible, dismiss, refreshNow } = usePwaUpdate();

  if (!bannerVisible) return null;

  return (
    <div className="update-banner" role="status" aria-live="polite">
      <button
        type="button"
        className="update-banner-dismiss"
        aria-label="Dismiss update notification"
        onClick={dismiss}
      >
        ×
      </button>
      <div className="update-banner-label">New version available</div>
      <div className="update-banner-body">Reload to refresh app</div>
      <button
        type="button"
        className="update-banner-refresh"
        onClick={refreshNow}
      >
        Refresh
      </button>
    </div>
  );
}
