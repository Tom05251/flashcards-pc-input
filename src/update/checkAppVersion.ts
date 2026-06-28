export type RemoteVersion = {
  version: string;
  releasedAt: string;
  requiredRefresh: boolean;
};

export type ChangelogEntry = {
  version: string;
  date: string;
  items: string[];
};

export type AppUpdate = {
  latest: RemoteVersion;
  changelog: ChangelogEntry | null;
};

const CURRENT_APP_VERSION = "1.0.0";

function versionParts(version: string) {
  return version.split(".").map((part) => Number.parseInt(part, 10) || 0);
}

function isNewerVersion(remote: string, current: string) {
  const remoteParts = versionParts(remote);
  const currentParts = versionParts(current);
  const length = Math.max(remoteParts.length, currentParts.length);

  for (let index = 0; index < length; index += 1) {
    const remotePart = remoteParts[index] ?? 0;
    const currentPart = currentParts[index] ?? 0;
    if (remotePart > currentPart) return true;
    if (remotePart < currentPart) return false;
  }

  return false;
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${import.meta.env.BASE_URL}${path}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${path}`);
  }

  return response.json() as Promise<T>;
}

export async function checkAppVersion(): Promise<AppUpdate | null> {
  const latest = await fetchJson<RemoteVersion>("version.json");
  const changelog = await fetchJson<ChangelogEntry[]>("changelog.json").catch(() => []);

  if (!isNewerVersion(latest.version, CURRENT_APP_VERSION)) {
    return null;
  }

  return {
    latest,
    changelog: changelog.find((entry) => entry.version === latest.version) ?? null,
  };
}
