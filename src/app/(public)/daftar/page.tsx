import { redirect } from "next/navigation";

type Props = {
  searchParams: Promise<{ dojo?: string }>;
};

export default async function DaftarPage({ searchParams }: Props) {
  const params = await searchParams;
  const query = params.dojo
    ? `?tab=daftar&dojo=${encodeURIComponent(params.dojo)}`
    : "?tab=daftar";

  redirect(`/login${query}`);
}
