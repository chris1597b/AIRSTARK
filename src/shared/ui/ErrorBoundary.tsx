import React, { Component, ErrorInfo, ReactNode } from 'react';

export interface ErrorBoundaryProps {
  children: ReactNode;
  label: string;
  fallbackTitle?: string;
  onReset?: () => void;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error(`[ErrorBoundary - ${this.props.label}] Error capturado:`, error, errorInfo);
  }

  public handleReset = (): void => {
    if (this.props.onReset) {
      this.props.onReset();
    }
    this.setState({ hasError: false, error: null });
  };

  public render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="p-4 rounded-2xl bg-gray-900/90 border border-red-500/40 backdrop-blur-md shadow-2xl text-center flex flex-col items-center justify-center gap-3 m-2 text-gray-200 animate-in fade-in duration-300 pointer-events-auto z-50">
          <div className="w-10 h-10 rounded-full bg-red-500/20 border border-red-500/50 flex items-center justify-center text-red-400 font-bold text-lg">
            ⚠️
          </div>
          <h3 className="text-base font-bold text-white tracking-wide">
            {this.props.fallbackTitle || `Error en ${this.props.label}`}
          </h3>
          <p className="text-xs text-gray-400 max-w-xs line-clamp-2">
            {this.state.error?.message || 'Ocurrió un error inesperado en este componente.'}
          </p>
          <button
            onClick={this.handleReset}
            className="mt-1 px-4 py-1.5 rounded-full bg-red-600 hover:bg-red-500 text-white text-xs font-semibold transition-all shadow-md active:scale-95 cursor-pointer"
          >
            Reintentar
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
