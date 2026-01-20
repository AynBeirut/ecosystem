import React, { useState, useEffect } from 'react';
import BackButton from '@/components/BackButton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Palette, Eye, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import MobileHeader from '@/components/MobileHeader';
import { useIsMobile } from '@/hooks/use-mobile';

import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import { useAuth } from '@/context/useAuth';

const AdminTemplates: React.FC = () => {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const db = getFirestore();
  const [selectedTemplate, setSelectedTemplate] = useState('modern');

  // Load selected template from Firestore on mount
  useEffect(() => {
    const fetchTemplate = async () => {
      if (user?.id) {
        const profileRef = doc(db, 'storeProfiles', user.id);
        const profileSnap = await getDoc(profileRef);
        if (profileSnap.exists()) {
          const data = profileSnap.data();
          if (data.template) setSelectedTemplate(data.template);
        }
      }
    };
    fetchTemplate();
    // eslint-disable-next-line
  }, [user?.id]);

  const templates = [
    {
      id: 'modern',
      name: 'Modern',
      description: 'Clean, contemporary design with bold typography and spacious layouts',
      preview: 'https://placehold.co/400x300/38B2AC/fff?text=Modern+Template',
      colors: ['#38B2AC', '#2C5282', '#ED8936'],
      features: ['Responsive Design', 'Dark Mode', 'Animation Effects'],
      isPremium: false
    },
    {
      id: 'minimal',
      name: 'Minimal',
      description: 'Simple, elegant design focusing on content and whitespace',
      preview: 'https://placehold.co/400x300/718096/fff?text=Minimal+Template',
      colors: ['#718096', '#2D3748', '#E2E8F0'],
      features: ['Clean Layout', 'Typography Focus', 'Fast Loading'],
      isPremium: false
    },
    {
      id: 'classic',
      name: 'Classic',
      description: 'Traditional design with proven usability and timeless appeal',
      preview: 'https://placehold.co/400x300/2C5282/fff?text=Classic+Template',
      colors: ['#2C5282', '#3182CE', '#63B3ED'],
      features: ['Traditional Layout', 'High Contrast', 'Easy Navigation'],
      isPremium: false
    },
    {
      id: 'vibrant',
      name: 'Vibrant',
      description: 'Energetic design with bold colors and dynamic elements',
      preview: 'https://placehold.co/400x300/ED8936/fff?text=Vibrant+Template',
      colors: ['#ED8936', '#F56565', '#9F7AEA'],
      features: ['Bold Colors', 'Dynamic Layout', 'Interactive Elements'],
      isPremium: true
    },
    {
      id: 'professional',
      name: 'Professional',
      description: 'Corporate-style design perfect for business and B2B stores',
      preview: 'https://placehold.co/400x300/2D3748/fff?text=Professional+Template',
      colors: ['#2D3748', '#4A5568', '#718096'],
      features: ['Corporate Style', 'Trust Elements', 'Formal Layout'],
      isPremium: true
    },
    {
      id: 'artistic',
      name: 'Artistic',
      description: 'Creative design with unique layouts and artistic elements',
      preview: 'https://placehold.co/400x300/9F7AEA/fff?text=Artistic+Template',
      colors: ['#9F7AEA', '#ED64A6', '#F6AD55'],
      features: ['Creative Layout', 'Artistic Elements', 'Unique Design'],
      isPremium: true
    }
  ];

  const handleSelectTemplate = async (templateId: string) => {
    setSelectedTemplate(templateId);
    if (user?.id) {
      const profileRef = doc(db, 'storeProfiles', user.id);
      await setDoc(profileRef, { template: templateId }, { merge: true });
    }
    toast({
      title: "Template Applied",
      description: `Your store is now using the ${templates.find(t => t.id === templateId)?.name} template.`
    });
  };

  const handlePreview = (templateId: string) => {
    toast({
      title: "Preview Mode",
      description: `Opening preview for ${templates.find(t => t.id === templateId)?.name} template.`
    });
  };

  return (
    <div className="min-h-screen bg-background">
  {isMobile && <MobileHeader title="Store Templates" />}
      
      <div className="p-4 md:p-6">
        <BackButton to="/admin/profile" label="Back to Store Profile" />
        <div className="mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Palette className="h-6 w-6" />
            Store Templates
          </h1>
          <p className="text-muted-foreground">Choose a template that best represents your brand and style</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((template) => (
            <Card key={template.id} className={`relative overflow-hidden ${selectedTemplate === template.id ? 'ring-2 ring-primary' : ''}`}>
              {selectedTemplate === template.id && (
                <div className="absolute top-2 right-2 z-10">
                  <Badge className="bg-primary text-primary-foreground">
                    <Check className="h-3 w-3 mr-1" />
                    Active
                  </Badge>
                </div>
              )}
              
              {template.isPremium && (
                <div className="absolute top-2 left-2 z-10">
                  <Badge variant="secondary">Premium</Badge>
                </div>
              )}

              <div className="aspect-video relative overflow-hidden">
                <img 
                  src={template.preview} 
                  alt={`${template.name} template preview`}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/20 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handlePreview(template.id)}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Preview
                  </Button>
                </div>
              </div>

              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  {template.name}
                </CardTitle>
                <CardDescription>
                  {template.description}
                </CardDescription>
              </CardHeader>

              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="text-sm font-medium mb-2">Color Palette</div>
                    <div className="flex gap-2">
                      {template.colors.map((color, index) => (
                        <span
                          key={index}
                          className="w-6 h-6 rounded-full border-2 border-white shadow-sm template-color"
                          data-color={color}
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="text-sm font-medium mb-2">Features</div>
                    <div className="flex flex-wrap gap-1">
                      {template.features.map((feature, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {feature}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant={selectedTemplate === template.id ? "default" : "outline"}
                      className="flex-1"
                      onClick={() => handleSelectTemplate(template.id)}
                      disabled={selectedTemplate === template.id}
                    >
                      {selectedTemplate === template.id ? (
                        <>
                          <Check className="h-4 w-4 mr-2" />
                          Active
                        </>
                      ) : (
                        'Use Template'
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handlePreview(template.id)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Template Customization */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Template Customization</CardTitle>
            <CardDescription>
              Advanced customization options for your selected template
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary mb-2">6</div>
                <div className="text-sm text-muted-foreground">Available Templates</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary mb-2">3</div>
                <div className="text-sm text-muted-foreground">Premium Templates</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary mb-2">∞</div>
                <div className="text-sm text-muted-foreground">Customization Options</div>
              </div>
            </div>
            
            <div className="mt-6 p-4 bg-muted rounded-lg">
              <h4 className="font-medium mb-2">Coming Soon: Advanced Customization</h4>
              <p className="text-sm text-muted-foreground">
                Soon you'll be able to customize colors, fonts, layouts, and more to create a truly unique store design.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminTemplates;