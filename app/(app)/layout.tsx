import { redirect } from "next/navigation";
import NavFrame from "@/components/NavFrame";
import { getUserId } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!(await getUserId())) redirect("/login");
  return <NavFrame>{children}</NavFrame>;
}
