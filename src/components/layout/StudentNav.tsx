"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { toast } from "sonner";

import { useSupabase } from "@/providers/SupabaseProvider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface StudentNavProps {
  studentName: string;
}

function NavLink({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  const pathname = usePathname();
  const isActive = pathname === href;

  return (
    <Link
      href={href}
      className={cn(
        "text-sm font-medium transition-colors hover:text-foreground",
        isActive ? "text-foreground" : "text-muted-foreground",
      )}
    >
      {label}
    </Link>
  );
}

export function StudentNav({ studentName }: StudentNavProps) {
  const supabase = useSupabase();
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        toast.error(error.message);
        return;
      }
      router.push("/login");
    } catch (err) {
      console.error(err);
      toast.error("Unexpected error while logging out.");
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <header className="border-b bg-background/80 backdrop-blur">
      <nav className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold tracking-tight">
            ProctorApp
          </span>
        </div>
        <div className="flex items-center gap-4">
          <NavLink href="/student/dashboard" label="Dashboard" />
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-muted-foreground sm:inline">
            {studentName ?? "Student"}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={handleLogout}
            disabled={isLoggingOut}
          >
            <LogOut className="mr-1 h-4 w-4" />
            Logout
          </Button>
        </div>
      </nav>
    </header>
  );
}

export default StudentNav;

