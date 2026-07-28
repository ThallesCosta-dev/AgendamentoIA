import React, { createContext, useCallback, useContext, useState } from "react";

const TOKEN_STORAGE_KEY = "adminToken";

export interface LoginResult {
  success: boolean;
  error?: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  token: string | null;
  login: (username: string, password: string) => Promise<LoginResult>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => {
    // Remove o antigo indicador inseguro de autenticação, se existir
    localStorage.removeItem("adminAuth");
    return sessionStorage.getItem(TOKEN_STORAGE_KEY);
  });

  const login = useCallback(
    async (username: string, password: string): Promise<LoginResult> => {
      try {
        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        });

        const data = await response.json().catch(() => null);

        if (response.ok && data?.success && typeof data.token === "string") {
          sessionStorage.setItem(TOKEN_STORAGE_KEY, data.token);
          setToken(data.token);
          return { success: true };
        }

        return {
          success: false,
          error:
            data && typeof data.error === "string" && data.error.trim()
              ? data.error
              : "Usuário ou senha incorretos",
        };
      } catch {
        return {
          success: false,
          error: "Não foi possível conectar ao servidor. Tente novamente.",
        };
      }
    },
    [],
  );

  const logout = useCallback(() => {
    const currentToken = sessionStorage.getItem(TOKEN_STORAGE_KEY);
    if (currentToken) {
      // Melhor esforço: invalida a sessão no servidor
      fetch("/api/auth/logout", {
        method: "POST",
        headers: { Authorization: `Bearer ${currentToken}` },
      }).catch(() => {});
    }
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    setToken(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ isAuthenticated: !!token, token, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
