import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { Lock } from "lucide-react";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username.trim() || !password.trim()) {
      toast.error("Preencha todos os campos");
      return;
    }

    setIsLoading(true);

    // Simular um pequeno atraso para UX
    setTimeout(() => {
      if (login(username, password)) {
        toast.success("Login realizado com sucesso!");
        navigate("/admin");
      } else {
        toast.error("Usuário ou senha incorretos");
      }
      setIsLoading(false);
    }, 500);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      <Card className="w-full max-w-md border border-border">
        <div className="p-8">
          <div className="flex justify-center mb-6">
            <div className="bg-primary/10 p-3 rounded-full">
              <Lock className="h-8 w-8 text-primary" />
            </div>
          </div>
          
          <h1 className="text-2xl font-bold text-foreground text-center mb-2">
            Painel de Admin
          </h1>
          <p className="text-muted-foreground text-center mb-8">
            Faça login para acessar o painel administrativo
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Usuário
              </label>
              <Input
                type="text"
                placeholder="login"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isLoading}
                className="border-border focus:border-primary focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Senha
              </label>
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                className="border-border focus:border-primary focus:ring-primary"
              />
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium h-10"
            >
              {isLoading ? "Entrando..." : "Entrar"}
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
}
