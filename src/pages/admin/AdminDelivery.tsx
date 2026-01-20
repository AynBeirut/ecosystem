import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Clock, Truck, MapPin, Package, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import MobileHeader from '@/components/MobileHeader';
import BackButton from '@/components/BackButton';
import { useIsMobile } from '@/hooks/use-mobile';

const AdminDelivery: React.FC = () => {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  
  const [deliverySettings, setDeliverySettings] = useState({
    standardDelivery: true,
    expressDelivery: false,
    sameDay: false,
    pickup: true,
    standardTime: '3-5 days',
    expressTime: '1-2 days',
    sameDayTime: '4-6 hours',
    standardFee: '5.99',
    expressFee: '12.99',
    sameDayFee: '19.99',
    freeShippingThreshold: '50.00',
    deliveryRadius: '25',
    workingDays: 'Monday to Friday',
    workingHours: '9:00 AM - 6:00 PM',
    specialInstructions: ''
  });

  const [zones, setZones] = useState([
    { id: 1, name: 'Local Zone', radius: '0-10 miles', fee: '3.99', time: '1-2 days' },
    { id: 2, name: 'Regional Zone', radius: '10-25 miles', fee: '5.99', time: '2-3 days' },
    { id: 3, name: 'Extended Zone', radius: '25-50 miles', fee: '9.99', time: '3-5 days' }
  ]);

  const handleSettingChange = (key: string, value: string | boolean) => {
    setDeliverySettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    toast({
      title: "Delivery Settings Saved",
      description: "Your delivery configuration has been updated successfully."
    });
  };

  const addZone = () => {
    const newZone = {
      id: zones.length + 1,
      name: `Zone ${zones.length + 1}`,
      radius: '0-0 miles',
      fee: '0.00',
      time: '1-2 days'
    };
    setZones([...zones, newZone]);
  };

  const removeZone = (id: number) => {
    setZones(zones.filter(zone => zone.id !== id));
  };

  const updateZone = (id: number, field: string, value: string) => {
    setZones(zones.map(zone => 
      zone.id === id ? { ...zone, [field]: value } : zone
    ));
  };

  return (
    <div className="min-h-screen bg-background">
  {isMobile && <MobileHeader title="Delivery Settings" />}
      
      <div className="p-4 md:p-6">
        <BackButton />
        <div className="mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Truck className="h-6 w-6" />
            Delivery Settings
          </h1>
          <p className="text-muted-foreground">Configure delivery options and shipping zones for your store</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Delivery Options */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Delivery Options</CardTitle>
                <CardDescription>
                  Choose which delivery methods to offer
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Package className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <div className="font-medium">Standard Delivery</div>
                        <div className="text-sm text-muted-foreground">Regular shipping option</div>
                      </div>
                    </div>
                    <Switch
                      checked={deliverySettings.standardDelivery}
                      onCheckedChange={(checked) => handleSettingChange('standardDelivery', checked)}
                    />
                  </div>

                  {deliverySettings.standardDelivery && (
                    <div className="ml-8 space-y-3 border-l-2 border-gray-200 pl-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label htmlFor="standardTime">Delivery Time</Label>
                          <Input
                            id="standardTime"
                            value={deliverySettings.standardTime}
                            onChange={(e) => handleSettingChange('standardTime', e.target.value)}
                            placeholder="3-5 days"
                          />
                        </div>
                        <div>
                          <Label htmlFor="standardFee">Shipping Fee ($)</Label>
                          <Input
                            id="standardFee"
                            type="number"
                            step="0.01"
                            value={deliverySettings.standardFee}
                            onChange={(e) => handleSettingChange('standardFee', e.target.value)}
                            placeholder="5.99"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Clock className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <div className="font-medium">Express Delivery</div>
                        <div className="text-sm text-muted-foreground">Faster shipping option</div>
                      </div>
                    </div>
                    <Switch
                      checked={deliverySettings.expressDelivery}
                      onCheckedChange={(checked) => handleSettingChange('expressDelivery', checked)}
                    />
                  </div>

                  {deliverySettings.expressDelivery && (
                    <div className="ml-8 space-y-3 border-l-2 border-gray-200 pl-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label htmlFor="expressTime">Delivery Time</Label>
                          <Input
                            id="expressTime"
                            value={deliverySettings.expressTime}
                            onChange={(e) => handleSettingChange('expressTime', e.target.value)}
                            placeholder="1-2 days"
                          />
                        </div>
                        <div>
                          <Label htmlFor="expressFee">Shipping Fee ($)</Label>
                          <Input
                            id="expressFee"
                            type="number"
                            step="0.01"
                            value={deliverySettings.expressFee}
                            onChange={(e) => handleSettingChange('expressFee', e.target.value)}
                            placeholder="12.99"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <MapPin className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <div className="font-medium">Store Pickup</div>
                        <div className="text-sm text-muted-foreground">Customers can pick up orders</div>
                      </div>
                    </div>
                    <Switch
                      checked={deliverySettings.pickup}
                      onCheckedChange={(checked) => handleSettingChange('pickup', checked)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>General Settings</CardTitle>
                <CardDescription>
                  Configure general delivery preferences
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="freeShipping">Free Shipping Threshold ($)</Label>
                  <Input
                    id="freeShipping"
                    type="number"
                    step="0.01"
                    value={deliverySettings.freeShippingThreshold}
                    onChange={(e) => handleSettingChange('freeShippingThreshold', e.target.value)}
                    placeholder="50.00"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Orders above this amount get free shipping
                  </p>
                </div>

                <div>
                  <Label htmlFor="workingDays">Working Days</Label>
                  <Select 
                    value={deliverySettings.workingDays} 
                    onValueChange={(value) => handleSettingChange('workingDays', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select working days" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Monday to Friday">Monday to Friday</SelectItem>
                      <SelectItem value="Monday to Saturday">Monday to Saturday</SelectItem>
                      <SelectItem value="Every day">Every day</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="workingHours">Working Hours</Label>
                  <Input
                    id="workingHours"
                    value={deliverySettings.workingHours}
                    onChange={(e) => handleSettingChange('workingHours', e.target.value)}
                    placeholder="9:00 AM - 6:00 PM"
                  />
                </div>

                <div>
                  <Label htmlFor="specialInstructions">Special Delivery Instructions</Label>
                  <Textarea
                    id="specialInstructions"
                    value={deliverySettings.specialInstructions}
                    onChange={(e) => handleSettingChange('specialInstructions', e.target.value)}
                    placeholder="Any special instructions for delivery drivers..."
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Delivery Zones */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Delivery Zones</CardTitle>
                <CardDescription>
                  Configure different delivery zones with specific rates and times
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {zones.map((zone) => (
                  <div key={zone.id} className="p-4 border rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <Input
                        value={zone.name}
                        onChange={(e) => updateZone(zone.id, 'name', e.target.value)}
                        className="font-medium"
                        placeholder="Zone name"
                      />
                      {zones.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeZone(zone.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-1 gap-3">
                      <div>
                        <Label>Coverage Area</Label>
                        <Input
                          value={zone.radius}
                          onChange={(e) => updateZone(zone.id, 'radius', e.target.value)}
                          placeholder="0-10 miles"
                        />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>Delivery Fee ($)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={zone.fee}
                            onChange={(e) => updateZone(zone.id, 'fee', e.target.value)}
                            placeholder="3.99"
                          />
                        </div>
                        <div>
                          <Label>Delivery Time</Label>
                          <Input
                            value={zone.time}
                            onChange={(e) => updateZone(zone.id, 'time', e.target.value)}
                            placeholder="1-2 days"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                
                <Button
                  variant="outline"
                  onClick={addZone}
                  className="w-full"
                >
                  Add New Zone
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Delivery Summary</CardTitle>
                <CardDescription>
                  Overview of your delivery configuration
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">
                      {[deliverySettings.standardDelivery, deliverySettings.expressDelivery, deliverySettings.pickup].filter(Boolean).length}
                    </div>
                    <div className="text-sm text-muted-foreground">Active Options</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">{zones.length}</div>
                    <div className="text-sm text-muted-foreground">Delivery Zones</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">${deliverySettings.freeShippingThreshold}</div>
                    <div className="text-sm text-muted-foreground">Free Shipping</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">{deliverySettings.standardTime}</div>
                    <div className="text-sm text-muted-foreground">Standard Time</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <Button onClick={handleSave} size="lg">
            Save Delivery Settings
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AdminDelivery;