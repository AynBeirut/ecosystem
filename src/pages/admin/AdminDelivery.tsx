import React, { useEffect, useState } from 'react';
import { getFirestore, doc, getDoc, updateDoc } from 'firebase/firestore';
import { useAuth } from '@/context/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Clock, Truck, MapPin, Package, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import AdminPageShell from '@/components/admin/AdminPageShell';
import AdminPanel from '@/components/admin/AdminPanel';
import { StoreDeliverySettings, DeliveryZoneSetting, DeliveryPartnerSetting } from '@/types/storeProfile';

const DEFAULT_DELIVERY_SETTINGS: StoreDeliverySettings = {
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
  specialInstructions: '',
  ownDeliveryEnabled: true,
  defaultPickupCarrier: 'in_house',
};

const DEFAULT_DELIVERY_PARTNERS: DeliveryPartnerSetting[] = [
  { id: 'dhl', name: 'DHL', type: 'shipping', active: true },
  { id: 'fedex', name: 'FedEx', type: 'shipping', active: true },
  { id: 'ups', name: 'UPS', type: 'shipping', active: true },
  { id: 'local-courier', name: 'Local Courier', type: 'local', active: true },
];

const DEFAULT_ZONES: DeliveryZoneSetting[] = [
  { id: 1, name: 'Local Zone', radius: '0-10 miles', fee: '3.99', time: '1-2 days' },
  { id: 2, name: 'Regional Zone', radius: '10-25 miles', fee: '5.99', time: '2-3 days' },
  { id: 3, name: 'Extended Zone', radius: '25-50 miles', fee: '9.99', time: '3-5 days' },
];

const AdminDelivery: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  
  const [deliverySettings, setDeliverySettings] = useState<StoreDeliverySettings>(DEFAULT_DELIVERY_SETTINGS);

  const [zones, setZones] = useState<DeliveryZoneSetting[]>(DEFAULT_ZONES);
  const [deliveryPartners, setDeliveryPartners] = useState<DeliveryPartnerSetting[]>(DEFAULT_DELIVERY_PARTNERS);

  useEffect(() => {
    const loadDeliverySettings = async () => {
      if (!user?.storeId) return;
      try {
        const db = getFirestore();
        const profileRef = doc(db, 'storeProfiles', user.storeId);
        const snap = await getDoc(profileRef);
        if (!snap.exists()) return;

        const data = snap.data() as any;
        const saved = data.deliverySettings as Partial<StoreDeliverySettings> | undefined;

        if (saved && typeof saved === 'object') {
          setDeliverySettings({ ...DEFAULT_DELIVERY_SETTINGS, ...saved });
          if (Array.isArray(saved.zones) && saved.zones.length > 0) {
            setZones(saved.zones as DeliveryZoneSetting[]);
          }
          if (Array.isArray(saved.deliveryPartners) && saved.deliveryPartners.length > 0) {
            setDeliveryPartners(saved.deliveryPartners as DeliveryPartnerSetting[]);
          }
        }
      } catch (error) {
        console.error('Failed to load delivery settings:', error);
      }
    };

    loadDeliverySettings();
  }, [user?.storeId]);

  useEffect(() => {
    const activePartners = deliveryPartners.filter((partner) => partner.active && partner.name.trim() !== '');
    const options = [
      ...(deliverySettings.ownDeliveryEnabled !== false ? ['in_house'] : []),
      ...activePartners.map((partner) => partner.id),
    ];

    if (options.length === 0) {
      if ((deliverySettings.defaultPickupCarrier || '') !== '') {
        setDeliverySettings((prev) => ({ ...prev, defaultPickupCarrier: '' }));
      }
      return;
    }

    const current = deliverySettings.defaultPickupCarrier || '';
    if (!options.includes(current)) {
      setDeliverySettings((prev) => ({ ...prev, defaultPickupCarrier: options[0] }));
    }
  }, [deliveryPartners, deliverySettings.ownDeliveryEnabled, deliverySettings.defaultPickupCarrier]);

  const handleSettingChange = (key: string, value: string | boolean) => {
    setDeliverySettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!user?.storeId) {
      toast({ title: 'Error', description: 'Store not found', variant: 'destructive' });
      return;
    }

    try {
      setIsSaving(true);
      const db = getFirestore();
      const profileRef = doc(db, 'storeProfiles', user.storeId);
      await updateDoc(profileRef, {
        deliverySettings: {
          ...deliverySettings,
          zones,
          deliveryPartners,
        },
      });

      toast({
        title: 'Delivery Settings Saved',
        description: 'Your delivery configuration has been updated successfully.'
      });
    } catch (error) {
      console.error('Failed to save delivery settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to save delivery settings',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
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

  const addDeliveryPartner = (type: 'shipping' | 'local') => {
    const newPartner: DeliveryPartnerSetting = {
      id: `${type}-${Date.now()}`,
      name: type === 'shipping' ? 'New Shipping Partner' : 'New Local Delivery Partner',
      type,
      active: true,
    };
    setDeliveryPartners((prev) => [...prev, newPartner]);
  };

  const updateDeliveryPartner = (id: string, field: keyof DeliveryPartnerSetting, value: string | boolean) => {
    setDeliveryPartners((prev) => prev.map((partner) => (
      partner.id === id ? { ...partner, [field]: value } : partner
    )));
  };

  const removeDeliveryPartner = (id: string) => {
    setDeliveryPartners((prev) => prev.filter((partner) => partner.id !== id));
  };

  const activeDeliveryPartners = deliveryPartners.filter((partner) => partner.active && partner.name.trim() !== '');

  return (
    <AdminPageShell
      title="Delivery Settings"
      description="Configure delivery options, zones, and partners"
      eyebrow="Profile & Store Setup"
    >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Delivery Options */}
          <div className="space-y-4">
            <AdminPanel>
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
                            value={deliverySettings.standardFee === 0 || deliverySettings.standardFee === '' ? '' : deliverySettings.standardFee}
                            onChange={(e) => handleSettingChange('standardFee', e.target.value === '' ? 0 : e.target.value)}
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
                            value={deliverySettings.expressFee === 0 || deliverySettings.expressFee === '' ? '' : deliverySettings.expressFee}
                            onChange={(e) => handleSettingChange('expressFee', e.target.value === '' ? 0 : e.target.value)}
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
            </AdminPanel>

            <AdminPanel>
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
                    value={deliverySettings.freeShippingThreshold === 0 || deliverySettings.freeShippingThreshold === '' ? '' : deliverySettings.freeShippingThreshold}
                    onChange={(e) => handleSettingChange('freeShippingThreshold', e.target.value === '' ? 0 : e.target.value)}
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
            </AdminPanel>

            <AdminPanel>
              <CardHeader>
                <CardTitle>Delivery Partners</CardTitle>
                <CardDescription>
                  Configure multiple shipping partners, local delivery providers, and your own delivery service.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <div className="font-medium">Own Delivery Team</div>
                    <div className="text-sm text-muted-foreground">Allow in-house drivers as a delivery option</div>
                  </div>
                  <Switch
                    checked={deliverySettings.ownDeliveryEnabled !== false}
                    onCheckedChange={(checked) => handleSettingChange('ownDeliveryEnabled', checked)}
                  />
                </div>

                <div>
                  <Label>Default Pickup Carrier</Label>
                  <Select
                    value={deliverySettings.defaultPickupCarrier || 'in_house'}
                    onValueChange={(value) => handleSettingChange('defaultPickupCarrier', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select default carrier" />
                    </SelectTrigger>
                    <SelectContent>
                      {deliverySettings.ownDeliveryEnabled !== false && (
                        <SelectItem value="in_house">In-house</SelectItem>
                      )}
                      {activeDeliveryPartners.map((partner) => (
                        <SelectItem key={partner.id} value={partner.id}>
                          {partner.name} ({partner.type === 'shipping' ? 'Shipping' : 'Local'})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => addDeliveryPartner('shipping')}>Add Shipping Partner</Button>
                  <Button variant="outline" onClick={() => addDeliveryPartner('local')}>Add Local Delivery Partner</Button>
                </div>

                <div className="space-y-3">
                  {deliveryPartners.map((partner) => (
                    <div key={partner.id} className="p-3 border rounded-lg space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="md:col-span-2">
                          <Label>Partner Name</Label>
                          <Input
                            value={partner.name}
                            onChange={(e) => updateDeliveryPartner(partner.id, 'name', e.target.value)}
                            placeholder="Partner name"
                          />
                        </div>
                        <div>
                          <Label>Type</Label>
                          <Select
                            value={partner.type}
                            onValueChange={(value: 'shipping' | 'local') => updateDeliveryPartner(partner.id, 'type', value)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="shipping">Shipping</SelectItem>
                              <SelectItem value="local">Local Delivery</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={partner.active}
                            onCheckedChange={(checked) => updateDeliveryPartner(partner.id, 'active', checked)}
                          />
                          <span className="text-sm">Active</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeDeliveryPartner(partner.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </AdminPanel>
          </div>

          {/* Delivery Zones */}
          <div className="space-y-4">
            <AdminPanel>
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
                            value={zone.fee === 0 || zone.fee === '' ? '' : zone.fee}
                            onChange={(e) => updateZone(zone.id, 'fee', e.target.value === '' ? 0 : e.target.value)}
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
            </AdminPanel>

            <AdminPanel>
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
                    <div className="text-2xl font-bold text-primary">{activeDeliveryPartners.length + (deliverySettings.ownDeliveryEnabled !== false ? 1 : 0)}</div>
                    <div className="text-sm text-muted-foreground">Active Partners</div>
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
            </AdminPanel>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <Button onClick={handleSave} size="lg" disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Delivery Settings'}
          </Button>
        </div>
    </AdminPageShell>
  );
};

export default AdminDelivery;