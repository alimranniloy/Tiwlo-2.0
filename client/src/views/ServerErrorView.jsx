import UnavailablePage from '../components/UnavailablePage';

export default function ServerErrorView({ onNavigate }) {
  const path = typeof window !== 'undefined' ? window.location.pathname : '';

  return (
    <UnavailablePage
      label={path && path !== '/' ? path : 'Temporary hiccup'}
      title="Something slipped off the counter"
      description="We hit an unexpected bump loading this view. Head back to Tiwlo and try again."
      actionHref="/"
      onAction={onNavigate ? () => onNavigate('landing') : undefined}
    />
  );
}
