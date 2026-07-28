import React from "react";
import { Button } from "@/components/ui/button";

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(
      "ErrorBoundary capturou um erro:",
      error,
      errorInfo.componentStack,
    );
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
          <div className="text-center max-w-md">
            <h1 className="text-2xl font-bold text-foreground mb-2">
              Algo deu errado
            </h1>
            <p className="text-muted-foreground mb-6">
              Ocorreu um erro inesperado no SalaAgenda. Por favor, recarregue a
              página para continuar.
            </p>
            <Button
              onClick={this.handleReload}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              Recarregar
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
