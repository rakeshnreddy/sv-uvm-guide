"use client";

import React, { Component, ReactNode } from 'react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
}

export class WebGLFallbackBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false
    };

    public static getDerivedStateFromError(_: Error): State {
        return { hasError: true };
    }

    public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error("WebGLFallbackBoundary caught an error:", error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return this.props.fallback || (
                <div className="w-full h-[600px] flex items-center justify-center bg-slate-900/50 rounded-xl" data-testid="webgl-fallback">
                    <p className="text-slate-400 font-mono text-sm">3D Visualization unavailable (WebGL context Error)</p>
                </div>
            );
        }

        return this.props.children;
    }
}
