import { getAllUniverses } from "@/lib/squads";

export function generateStaticParams() {
  return getAllUniverses().map((u) => ({ id: u.id }));
}

export default function SquadLayout({ children }: { children: React.ReactNode }) {
  return children;
}
