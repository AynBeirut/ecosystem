import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DROPSHIP_SUPPLIER_OPTIONS,
  isSupplierProductUrl,
  supplierLinkPlaceholder,
} from '@/lib/dropship';
import type { SupplierPlatform } from '@/types/product';

type Props = {
  idPrefix: string;
  enabled: boolean;
  platform: SupplierPlatform;
  productUrl: string;
  onEnabledChange: (enabled: boolean) => void;
  onPlatformChange: (platform: SupplierPlatform) => void;
  onUrlChange: (url: string) => void;
};

const DropshipSupplierFields: React.FC<Props> = ({
  idPrefix,
  enabled,
  platform,
  productUrl,
  onEnabledChange,
  onPlatformChange,
  onUrlChange,
}) => {
  const invalidUrl =
    enabled && productUrl.trim().length > 0 && !isSupplierProductUrl(platform, productUrl);

  return (
    <div className="space-y-3 border rounded-md p-3">
      <div className="flex items-center space-x-2">
        <Switch
          id={`${idPrefix}-dropship`}
          checked={enabled}
          onCheckedChange={onEnabledChange}
        />
        <Label htmlFor={`${idPrefix}-dropship`}>Enable Dropshipping</Label>
      </div>
      {enabled && (
        <div className="space-y-3">
          <div>
            <Label htmlFor={`${idPrefix}-platform`} className="text-sm">
              Supplier
            </Label>
            <Select value={platform} onValueChange={(v) => onPlatformChange(v as SupplierPlatform)}>
              <SelectTrigger id={`${idPrefix}-platform`} className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DROPSHIP_SUPPLIER_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor={`${idPrefix}-url`} className="text-sm">
              Product link
            </Label>
            <Input
              id={`${idPrefix}-url`}
              value={productUrl}
              onChange={(e) => onUrlChange(e.target.value)}
              placeholder={supplierLinkPlaceholder(platform)}
              className="mt-1"
            />
          </div>
          {invalidUrl && (
            <p className="text-xs text-red-600">URL does not match the selected supplier.</p>
          )}
        </div>
      )}
    </div>
  );
};

export default DropshipSupplierFields;
