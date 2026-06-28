const LAST_SEEN_VERSION_KEY = "flashcards-pc-input:last-seen-version";

export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  const register = () => {
    const serviceWorkerUrl = `${import.meta.env.BASE_URL}sw.js`;
    navigator.serviceWorker.register(serviceWorkerUrl, {
      scope: import.meta.env.BASE_URL,
    });
  };

  if (document.readyState === "complete") {
    register();
  } else {
    window.addEventListener("load", register, { once: true });
  }
}

export async function updateServiceWorkerAndReload(version?: string) {
  if (version) {
    localStorage.setItem(LAST_SEEN_VERSION_KEY, version);
  }

  if (!("serviceWorker" in navigator)) {
    window.location.reload();
    return;
  }

  const registration = await navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL);
  await registration?.update();

  if (registration?.waiting) {
    let reloaded = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!reloaded) {
        reloaded = true;
        window.location.reload();
      }
    });
    registration.waiting.postMessage({ type: "SKIP_WAITING" });
    window.setTimeout(() => {
      if (!reloaded) {
        window.location.reload();
      }
    }, 1000);
    return;
  }

  window.location.reload();
}
