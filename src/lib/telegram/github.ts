import { getTelegramConfig } from "./config";

const GITHUB_API_BASE = "https://api.github.com";

export interface GitHubCommitResult {
  sha: string;
  url: string;
  message: string;
  author?: string;
  date?: string;
}

export interface GitHubFileContent {
  path: string;
  sha: string;
  content: string; // UTF-8 text string
  size: number;
}

function getHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "inkai-sby-telegram-bot",
  };
}

/**
 * Mengambil informasi commit terbaru dari branch yang aktif.
 */
export async function getLatestCommit(branch?: string): Promise<GitHubCommitResult | null> {
  const { githubToken, githubOwner, githubRepo, githubBranch } = getTelegramConfig();
  if (!githubToken) return null;

  const targetBranch = branch || githubBranch;
  try {
    const res = await fetch(
      `${GITHUB_API_BASE}/repos/${githubOwner}/${githubRepo}/commits/${targetBranch}`,
      {
        headers: getHeaders(githubToken),
      },
    );
    if (!res.ok) return null;

    const data = await res.json();
    return {
      sha: data.sha?.slice(0, 7) || "",
      url: data.html_url || "",
      message: data.commit?.message || "",
      author: data.commit?.author?.name || data.author?.login || "Unknown",
      date: data.commit?.author?.date || "",
    };
  } catch (err) {
    console.error("[github] getLatestCommit error:", err);
    return null;
  }
}

/**
 * Mengambil isi file dari repository GitHub (didecode otomatis dari base64).
 */
export async function getFileContent(
  filePath: string,
  branch?: string,
): Promise<GitHubFileContent | null> {
  const { githubToken, githubOwner, githubRepo, githubBranch } = getTelegramConfig();
  if (!githubToken) return null;

  const cleanPath = filePath.replace(/^\/+/, "");
  const targetBranch = branch || githubBranch;

  try {
    const res = await fetch(
      `${GITHUB_API_BASE}/repos/${githubOwner}/${githubRepo}/contents/${cleanPath}?ref=${targetBranch}`,
      {
        headers: getHeaders(githubToken),
      },
    );

    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    if (!data.content) return null;

    const decoded = Buffer.from(data.content, "base64").toString("utf-8");
    return {
      path: data.path,
      sha: data.sha,
      content: decoded,
      size: data.size,
    };
  } catch (err) {
    console.error("[github] getFileContent error:", err);
    return null;
  }
}

/**
 * Mengambil daftar seluruh file dalam repository (menggunakan Git Tree API).
 * Mengabaikan file sistem/build seperti node_modules, .next, .git, dll.
 */
export async function listRepositoryFiles(branch?: string): Promise<string[]> {
  const { githubToken, githubOwner, githubRepo, githubBranch } = getTelegramConfig();
  if (!githubToken) return [];

  const targetBranch = branch || githubBranch;
  try {
    const res = await fetch(
      `${GITHUB_API_BASE}/repos/${githubOwner}/${githubRepo}/git/trees/${targetBranch}?recursive=1`,
      {
        headers: getHeaders(githubToken),
      },
    );

    if (!res.ok) return [];

    const data = await res.json();
    if (!Array.isArray(data.tree)) return [];

    const ignoredPrefixes = [
      "node_modules/",
      ".next/",
      ".git/",
      "dist/",
      "build/",
      ".playwright-cli/",
      "coverage/",
    ];

    const files: string[] = [];
    for (const item of data.tree) {
      if (item.type === "blob" && typeof item.path === "string") {
        if (ignoredPrefixes.some((p) => item.path.startsWith(p))) continue;
        files.push(item.path);
      }
    }

    return files;
  } catch (err) {
    console.error("[github] listRepositoryFiles error:", err);
    return [];
  }
}

/**
 * Mengunggah perubahan 1 file langsung ke branch GitHub melalui Contents API.
 */
export async function commitFileChange(params: {
  path: string;
  content: string;
  message: string;
  branch?: string;
}): Promise<{ ok: boolean; commitUrl?: string; sha?: string; error?: string }> {
  const { githubToken, githubOwner, githubRepo, githubBranch } = getTelegramConfig();
  if (!githubToken) {
    return { ok: false, error: "GITHUB_TOKEN belum diset di Vercel" };
  }

  const cleanPath = params.path.replace(/^\/+/, "");
  const targetBranch = params.branch || githubBranch;

  try {
    // 1. Ambil SHA file yang ada sekarang (jika file sudah ada)
    const existing = await getFileContent(cleanPath, targetBranch);

    const body: Record<string, unknown> = {
      message: params.message,
      content: Buffer.from(params.content, "utf-8").toString("base64"),
      branch: targetBranch,
    };

    if (existing?.sha) {
      body.sha = existing.sha;
    }

    const res = await fetch(
      `${GITHUB_API_BASE}/repos/${githubOwner}/${githubRepo}/contents/${cleanPath}`,
      {
        method: "PUT",
        headers: getHeaders(githubToken),
        body: JSON.stringify(body),
      },
    );

    const data = await res.json();
    if (!res.ok) {
      return {
        ok: false,
        error: data.message || `Gagal commit file ${cleanPath}`,
      };
    }

    const commitSha = data.commit?.sha?.slice(0, 7) || "";
    const commitUrl = data.commit?.html_url || "";

    return {
      ok: true,
      sha: commitSha,
      commitUrl,
    };
  } catch (err: unknown) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Mengunggah perubahan banyak file sekaligus dalam SATU commit menggunakan Git Tree & Commit API.
 */
export async function commitMultipleFiles(params: {
  files: Array<{ path: string; content: string }>;
  message: string;
  branch?: string;
}): Promise<{ ok: boolean; commitUrl?: string; sha?: string; error?: string }> {
  const { githubToken, githubOwner, githubRepo, githubBranch } = getTelegramConfig();
  if (!githubToken) {
    return { ok: false, error: "GITHUB_TOKEN belum diset di Vercel" };
  }

  if (params.files.length === 0) {
    return { ok: false, error: "Tidak ada file yang diubah" };
  }

  if (params.files.length === 1) {
    return commitFileChange({
      path: params.files[0].path,
      content: params.files[0].content,
      message: params.message,
      branch: params.branch,
    });
  }

  const targetBranch = params.branch || githubBranch;

  try {
    // 1. Ambil commit SHA head dari branch
    const refRes = await fetch(
      `${GITHUB_API_BASE}/repos/${githubOwner}/${githubRepo}/git/ref/heads/${targetBranch}`,
      { headers: getHeaders(githubToken) },
    );
    if (!refRes.ok) throw new Error("Gagal mengambil referensi branch");
    const refData = await refRes.json();
    const latestCommitSha = refData.object.sha;

    // 2. Buat tree baru
    const treeItems = params.files.map((f) => ({
      path: f.path.replace(/^\/+/, ""),
      mode: "100644",
      type: "blob",
      content: f.content,
    }));

    const treeRes = await fetch(
      `${GITHUB_API_BASE}/repos/${githubOwner}/${githubRepo}/git/trees`,
      {
        method: "POST",
        headers: getHeaders(githubToken),
        body: JSON.stringify({
          base_tree: latestCommitSha,
          tree: treeItems,
        }),
      },
    );
    if (!treeRes.ok) throw new Error("Gagal membuat Git Tree");
    const treeData = await treeRes.json();

    // 3. Buat commit baru
    const commitRes = await fetch(
      `${GITHUB_API_BASE}/repos/${githubOwner}/${githubRepo}/git/commits`,
      {
        method: "POST",
        headers: getHeaders(githubToken),
        body: JSON.stringify({
          message: params.message,
          tree: treeData.sha,
          parents: [latestCommitSha],
        }),
      },
    );
    if (!commitRes.ok) throw new Error("Gagal membuat Git Commit");
    const newCommit = await commitRes.json();

    // 4. Update ref branch (fast-forward)
    const updateRefRes = await fetch(
      `${GITHUB_API_BASE}/repos/${githubOwner}/${githubRepo}/git/refs/heads/${targetBranch}`,
      {
        method: "PATCH",
        headers: getHeaders(githubToken),
        body: JSON.stringify({
          sha: newCommit.sha,
          force: false,
        }),
      },
    );
    if (!updateRefRes.ok) throw new Error("Gagal memperbarui branch ref");

    const shortSha = newCommit.sha.slice(0, 7);
    const commitUrl = `https://github.com/${githubOwner}/${githubRepo}/commit/${newCommit.sha}`;

    return {
      ok: true,
      sha: shortSha,
      commitUrl,
    };
  } catch (err: unknown) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
