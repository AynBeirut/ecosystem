import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Crown, Shield, User } from 'lucide-react';
import { toast } from 'sonner';

type Plan = 'user_premium' | 'user_moderate' | 'user_free';

export default function PlanSelection() {
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  const plans = [
    {
      id: 'user_premium' as Plan,
      name: 'Premium',
      icon: Crown,
      description: 'Access to all premium content',
      features: ['All premium articles', 'Early access', 'Ad-free experience'],
    },
    {
      id: 'user_moderate' as Plan,
      name: 'Moderate',
      icon: Shield,
      description: 'Access to moderate content',
      features: ['Selected articles', 'Some premium content', 'Limited ads'],
    },
    {
      id: 'user_free' as Plan,
      name: 'Free',
      icon: User,
      description: 'Access to free content',
      features: ['Free articles only', 'Ad-supported', 'Basic access'],
    },
  ];

  const handleSelectPlan = async (plan: Plan) => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from('user_roles')
        .insert({ user_id: user.id, role: plan });

      if (error) throw error;

      toast.success('Plan selected successfully!');
      navigate('/');
    } catch (error: any) {
      toast.error(error.message || 'Failed to select plan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-5xl space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold">Choose Your Plan</h1>
          <p className="text-muted-foreground">Select a plan to get started with The Publisher</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {plans.map((plan) => {
            const Icon = plan.icon;
            return (
              <Card key={plan.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                    <Icon className="w-6 h-6 text-primary" />
                  </div>
                  <CardTitle>{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-2">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="text-sm text-muted-foreground flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="w-full"
                    onClick={() => handleSelectPlan(plan.id)}
                    disabled={loading}
                  >
                    Select {plan.name}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
