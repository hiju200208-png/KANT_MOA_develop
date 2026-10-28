import { AdminLogin } from "@/components/admin/AdminLogin";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: "kant moa_admin" },
};

export default function AdminLoginPage() {
  return <AdminLogin />;
}
