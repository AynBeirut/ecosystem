import React from 'react';
import { Link } from 'react-router-dom';
import { LayoutTemplate, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/useAuth';
import { canAccessFreelancerPortal, getFreelancerPortalPath } from '@/lib/webBuilderAccess';

type BuilderWorkspaceNavProps = {
  /** Show link back to /builder demo list (hide on /builder itself). */
  showDemoWorkspaceLink?: boolean;
  className?: string;
  compact?: boolean;
};

const BuilderWorkspaceNav: React.FC<BuilderWorkspaceNavProps> = ({
  showDemoWorkspaceLink = false,
  className,
  compact = false,
}) => {
  const { user } = useAuth();
  const isPlatformFreelancer = canAccessFreelancerPortal(user);

  if (!isPlatformFreelancer) {
    return (
      <Button variant="outline" size={compact ? 'sm' : 'default'} asChild className={className}>
        <Link to="/">Home</Link>
      </Button>
    );
  }

  return (
    <div className={`flex flex-wrap gap-2 ${className || ''}`}>
      <Button
        size={compact ? 'sm' : 'default'}
        asChild
        className="bg-teal-600 hover:bg-teal-700 text-white"
      >
        <Link to={getFreelancerPortalPath()}>
          <Users className="h-4 w-4 mr-1.5" />
          Your dashboard
        </Link>
      </Button>
      {showDemoWorkspaceLink ? (
        <Button variant="outline" size={compact ? 'sm' : 'default'} asChild>
          <Link to="/builder">
            <LayoutTemplate className="h-4 w-4 mr-1.5" />
            Demo workspace
          </Link>
        </Button>
      ) : null}
    </div>
  );
};

export default BuilderWorkspaceNav;
