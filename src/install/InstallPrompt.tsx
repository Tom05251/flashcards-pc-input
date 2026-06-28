import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function InstallPrompt() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(isStandalone());

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
    };

    const handleInstalled = () => {
      setInstalled(true);
      setPromptEvent(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!promptEvent) {
      return;
    }

    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice.outcome === "accepted") {
      setInstalled(true);
      setPromptEvent(null);
    }
  };

  if (installed) {
    return <div className="install-box">Installed</div>;
  }

  return (
    <aside className="install-box" aria-label="Install instructions">
      {promptEvent ? (
        <button type="button" onClick={handleInstall}>
          Install App
        </button>
      ) : (
        <>
          <strong>Install from Chrome or Edge</strong>
          <ol>
            <li>Open this page in Chrome or Edge.</li>
            <li>Use the install icon or browser menu.</li>
            <li>Select Install app or Install this site as an app.</li>
          </ol>
        </>
      )}
    </aside>
  );
}

export default InstallPrompt;
