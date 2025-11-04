import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Calendar, Settings, LogOut } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";

export default function Header() {
  const location = useLocation();
  const { isAuthenticated, logout } = useAuth();

  const isActive = (path: string) => location.pathname === path;

  const handleLogout = () => {
    logout();
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 max-w-full items-center justify-between px-4">
        <Link
          to="/"
          className="flex items-center gap-2 font-bold text-xl text-primary hover:opacity-80 transition-opacity"
        >
          <Calendar className="h-6 w-6" />
          <span>SalaAgenda</span>
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          <Link
            to="/"
            className={cn(
              "text-sm font-medium transition-colors hover:text-primary",
              isActive("/") ? "text-primary" : "text-muted-foreground",
            )}
          >
            Chatbot
          </Link>
          <Link
            to="/admin"
            className={cn(
              "text-sm font-medium transition-colors hover:text-primary flex items-center gap-2",
              isActive("/admin") ? "text-primary" : "text-muted-foreground",
            )}
          >
            <Settings className="h-4 w-4" />
            Admin
          </Link>
          {isAuthenticated && (
            <Button
              onClick={handleLogout}
              variant="ghost"
              size="sm"
              className="text-sm font-medium text-muted-foreground hover:text-primary flex items-center gap-2"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </Button>
          )}
        </nav>

        <div className="md:hidden">
          <div className="flex items-center gap-2">
            <Link
              to="/admin"
              className={cn(
                "inline-flex items-center gap-2 text-sm font-medium transition-colors hover:text-primary",
                isActive("/admin") ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Settings className="h-5 w-5" />
            </Link>
            {isAuthenticated && (
              <Button
                onClick={handleLogout}
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-primary"
              >
                <LogOut className="h-5 w-5" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
