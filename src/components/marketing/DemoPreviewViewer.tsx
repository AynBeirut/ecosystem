import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Lock } from 'lucide-react';
import DemoPreviewMockScreen from '@/components/marketing/DemoPreviewMockScreen';
import type { DemoPreviewScreen } from '@/data/marketing/demoPreviewCatalog';

type Props = {
  screens: DemoPreviewScreen[];
  signupHref: string;
  signupLabel?: string;
};

const DemoPreviewViewer: React.FC<Props> = ({
  screens,
  signupHref,
  signupLabel = 'Sign in to use Grabio',
}) => {
  const [activeId, setActiveId] = useState(screens[0]?.id ?? '');
  const [gateVisible, setGateVisible] = useState(false);

  const active = screens.find((screen) => screen.id === activeId) ?? screens[0];

  const showGate = () => {
    setGateVisible(true);
    window.setTimeout(() => setGateVisible(false), 3200);
  };

  if (!active) return null;

  return (
    <section className="public-panel demo-preview-panel">
      <div className="demo-preview-tabs" role="tablist" aria-label="Product screens">
        {screens.map((screen) => (
          <button
            key={screen.id}
            type="button"
            role="tab"
            aria-selected={screen.id === active.id}
            className={`demo-preview-tab${screen.id === active.id ? ' is-active' : ''}`}
            onClick={() => setActiveId(screen.id)}
          >
            {screen.label}
          </button>
        ))}
      </div>

      <div className="demo-preview-frame" onClick={showGate} role="presentation">
        <DemoPreviewMockScreen type={active.type} label={active.label} />
        <div className="demo-preview-overlay" aria-hidden="true">
          <p className="demo-preview-overlay-hint">Click any control to continue</p>
        </div>
        {gateVisible && (
          <div className="demo-preview-gate" role="status" aria-live="polite">
            <Lock className="h-5 w-5" aria-hidden />
            <div>
              <p className="demo-preview-gate-title">Sign in to use this screen</p>
              <p className="demo-preview-gate-copy">This tour is read-only. Create a free account to run the live demo.</p>
            </div>
            <Link to={signupHref} className="demo-preview-gate-cta">
              {signupLabel}
            </Link>
          </div>
        )}
      </div>

      <p className="demo-preview-footnote">
        Preview uses sample data.{' '}
        <Link to={signupHref} className="font-semibold text-teal-700 hover:text-teal-800">
          Sign in free
        </Link>{' '}
        to open your own store with real POS, inventory, and reports.
      </p>
    </section>
  );
};

export default DemoPreviewViewer;
