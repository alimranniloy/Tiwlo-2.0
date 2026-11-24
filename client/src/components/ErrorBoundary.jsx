import React from 'react';
import ServerErrorView from '../views/ServerErrorView';
import { getAuthUrl } from '../utils/navigation';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Captured by Tiwlo Application ErrorBoundary:', error, errorInfo);
    const msg = String(error?.message || error || '');
    const isChunkFailure =
      /Failed to fetch dynamically imported module|Importing a module script failed|ChunkLoadError|error loading dynamically imported module/i.test(msg);
    if (isChunkFailure && typeof window !== 'undefined' && typeof sessionStorage !== 'undefined') {
      const retryKey = `tiwlo.chunkReload:${window.location.pathname}`;
      if (!sessionStorage.getItem(retryKey)) {
        sessionStorage.setItem(retryKey, String(Date.now()));
        window.location.reload();
      }
    }
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <ServerErrorView
          error={this.state.error}
          onReload={this.handleReload}
          onNavigate={(tab) => {
            this.setState({ hasError: false, error: null });
            if (this.props.onNavigate) {
              this.props.onNavigate(tab);
            } else if (tab === 'login' || tab === 'signin') {
              window.location.replace(getAuthUrl('/login'));
            } else {
              window.location.href = tab === 'landing' ? '/' : `/${tab}`;
            }
          }}
        />
      );
    }

    return this.props.children;
  }
}
