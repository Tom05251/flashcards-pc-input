import { useEffect, useState } from "react";
import InstallPrompt from "./install/InstallPrompt";
import UpdateBanner from "./update/UpdateBanner";
import { checkAppVersion, type AppUpdate } from "./update/checkAppVersion";
import { registerServiceWorker, updateServiceWorkerAndReload } from "./update/serviceWorkerUpdate";
import { loadDraft, saveDraft } from "./storage/autosave";

function App() {
  const [draft, setDraft] = useState(() => loadDraft());
  const [update, setUpdate] = useState<AppUpdate | null>(null);
  const [updateDismissed, setUpdateDismissed] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    registerServiceWorker();
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      saveDraft(draft);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [draft]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      saveDraft(draft);
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [draft]);

  useEffect(() => {
    checkAppVersion().then(setUpdate).catch(() => undefined);
  }, []);

  const handleUpdateNow = async () => {
    setSaveError(null);
    try {
      saveDraft(draft);
      await updateServiceWorkerAndReload(update?.latest.version);
    } catch {
      setSaveError("Saving failed. Please check your input and try again.");
    }
  };

  return (
    <main className="app-shell">
      {update && !updateDismissed ? (
        <UpdateBanner
          update={update}
          onUpdateNow={handleUpdateNow}
          onDismiss={() => setUpdateDismissed(true)}
        />
      ) : null}

      <section className="hero" aria-labelledby="app-title">
        <div>
          <p className="eyebrow">PWA Ready</p>
          <h1 id="app-title">Flashcards PC Input</h1>
          <p className="lead">
            Prepare flashcards and notes from your PC, then export data for the Android app.
          </p>
        </div>
        <InstallPrompt />
      </section>

      <section className="workspace" aria-labelledby="draft-title">
        <div className="section-heading">
          <h2 id="draft-title">Draft input</h2>
          <span>Autosaved locally</span>
        </div>
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Enter a sample card or note here. This draft is saved before updates."
          rows={9}
        />
        {saveError ? <p className="error-message">{saveError}</p> : null}
      </section>

      <section className="status-grid" aria-label="Feature status">
        <article>
          <h2>Offline startup</h2>
          <p>Core files are cached by the Service Worker after the first load.</p>
        </article>
        <article>
          <h2>Update notices</h2>
          <p>The app checks version.json and changelog.json when it starts.</p>
        </article>
        <article>
          <h2>Export / Import</h2>
          <p>CSV and ZIP export/import are coming after the PWA foundation.</p>
        </article>
      </section>
    </main>
  );
}

export default App;
