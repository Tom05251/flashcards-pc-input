import type { AppUpdate } from "./checkAppVersion";

type Props = {
  update: AppUpdate;
  onUpdateNow: () => void;
  onDismiss: () => void;
};

function UpdateBanner({ update, onUpdateNow, onDismiss }: Props) {
  const items = update.changelog?.items ?? ["A new version is available."];

  return (
    <section className="update-banner" aria-label="Update notice">
      <div>
        <h2>New version available</h2>
        <p>
          Version {update.latest.version} was released on {update.latest.releasedAt}.
        </p>
        <ul>
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p>Your current input is autosaved before the latest version is applied.</p>
      </div>
      <div className="banner-actions">
        <button type="button" onClick={onUpdateNow}>
          Update now
        </button>
        <button type="button" className="secondary" onClick={onDismiss}>
          Later
        </button>
      </div>
    </section>
  );
}

export default UpdateBanner;
