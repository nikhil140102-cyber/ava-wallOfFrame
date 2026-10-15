import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export default async function Index() {
  redirect((await getCurrentUser()) ? "/home" : "/login");
}
