import React, { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { Lock } from 'lucide-react';

type Props = {
  signupHref: string;
  signupLabel?: string;
  children: React.ReactNode;
  className?: string;
};

const DemoOsGate: React.FC<Props> = ({
  signupHref,
  signupLabel = 'Sign in to use Grabio',
  children,
  className = '',
}) => {
  const [gateVisible, setGateVisible] = useState(false);

  const showGate = useCallback(() => {
    setGateVisible(true);
    window.setTimeout(() => setGateVisible(false), 3200);
  }, []);

  return (
    <div
      className={`demo-os-gate-frame ${className}`.trim()}
      onClick={showGate}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') showGate();
      }}
      role="presentation"
    >
      {children}
      <div className="demo-os-gate-overlay" aria-hidden="true">
        <p className="demo-os-gate-hint">Click any control to continue</p>
      </div>
      {gateVisible && (
        <div className="demo-os-gate-popup" role="status" aria-live="polite">
          <Lock className="h-5 w-5 shrink-0" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="demo-os-gate-title">Sign in to use this screen</p>
            <p className="demo-os-gate-copy">This tour is read-only. Create a free account to run the live admin.</p>
          </div>
          <Link to={signupHref} className="demo-os-gate-cta shrink-0">
            {signupLabel}
          </Link>
        </div>
      )}
    </div>
  );
};

export default DemoOsGate;
