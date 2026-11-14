import UnavailablePage from '../components/UnavailablePage';

export default function NotFoundView({ onNavigate }) {
  const path = typeof window !== 'undefined' ? window.location.pathname : '';

  return (
    <UnavailablePage
      label={path && path !== '/' ? path : 'Page unavailable'}
      title="Nothing in this bowl yet"
      description="This corner of Tiwlo doesn’t exist or may have moved somewhere else."
      actionHref="/"
      onAction={onNavigate ? () => onNavigate('landing') : undefined}
    />
  );
}
