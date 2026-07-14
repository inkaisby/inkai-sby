import { inkaiFetch } from "@/lib/inkai-api/server";

export async function notifyUser({
  userId,
  title,
  content,
  type = "SUCCESS",
  token,
}: {
  userId: string;
  title: string;
  content: string;
  type?: string;
  token: string;
}) {
  const { res, data } = await inkaiFetch(
    "/v1/notifications",
    {
      method: "POST",
      body: JSON.stringify({ userId, title, content, type }),
    },
    token,
  );
  if (!res.ok) {
    throw new Error(typeof data.message === "string" ? data.message : "Gagal mengirim notifikasi");
  }
  return data.data;
}
