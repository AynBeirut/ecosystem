
import React from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, CreditCard, ShoppingBag, User } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

interface AccountTypeSelectionProps {
  onSelect: (type: 'user' | 'admin') => void;
  isLoading: boolean;
}

const AccountTypeSelection: React.FC<AccountTypeSelectionProps> = ({ onSelect, isLoading }) => {
  const isMobile = useIsMobile();
  
  return (
    <div className="space-y-4 md:space-y-6 px-4 md:px-0">
      <h2 className="text-xl md:text-2xl font-bold text-center">Choose Your Account Type</h2>
      <p className="text-center text-gray-600 mb-2 md:mb-4 text-sm md:text-base">Select the type of account you want to create</p>
      
      <div className="grid gap-4 md:gap-6 md:grid-cols-2">
        <Card className="relative overflow-hidden hover:shadow-lg transition-shadow">
          <div className="absolute top-2 right-2 bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-semibold">
            Free
          </div>
          <CardHeader className={isMobile ? "p-4" : ""}>
            <CardTitle className="flex items-center text-base md:text-lg">
              <User className="mr-2 h-4 w-4 md:h-5 md:w-5" />
              Regular User
            </CardTitle>
            <CardDescription>Shop in the marketplace</CardDescription>
          </CardHeader>
          <CardContent className={`space-y-2 ${isMobile ? "p-4 pt-0" : ""}`}>
            <ul className="space-y-1 md:space-y-2">
              <li className="flex items-start">
                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5 md:mr-2 md:h-4 md:w-4 text-green-500 mt-0.5" />
                <span className="text-xs md:text-sm">Browse all stores and products</span>
              </li>
              <li className="flex items-start">
                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5 md:mr-2 md:h-4 md:w-4 text-green-500 mt-0.5" />
                <span className="text-xs md:text-sm">Save favorite items</span>
              </li>
              <li className="flex items-start">
                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5 md:mr-2 md:h-4 md:w-4 text-green-500 mt-0.5" />
                <span className="text-xs md:text-sm">Earn credits by watching ads</span>
              </li>
              <li className="flex items-start">
                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5 md:mr-2 md:h-4 md:w-4 text-green-500 mt-0.5" />
                <span className="text-xs md:text-sm">Use credits for discounts</span>
              </li>
            </ul>
          </CardContent>
          <CardFooter className={isMobile ? "p-4" : ""}>
            <Button 
              variant="outline" 
              className="w-full text-xs md:text-sm" 
              onClick={() => onSelect('user')}
              disabled={isLoading}
              size={isMobile ? "sm" : "default"}
            >
              Continue as Regular User
            </Button>
          </CardFooter>
        </Card>

        <Card className="relative overflow-hidden border-primary hover:shadow-lg transition-shadow">
          <div className="absolute top-2 right-2 bg-primary text-white px-2 py-1 rounded-full text-xs font-semibold">
            Premium
          </div>
          <CardHeader className={isMobile ? "p-4" : ""}>
            <CardTitle className="flex items-center text-base md:text-lg">
              <ShoppingBag className="mr-2 h-4 w-4 md:h-5 md:w-5" />
              Admin User
            </CardTitle>
            <CardDescription>Create and manage your own store</CardDescription>
          </CardHeader>
          <CardContent className={`space-y-2 ${isMobile ? "p-4 pt-0" : ""}`}>
            <div className="text-center mb-1 md:mb-2">
              <span className="font-bold text-lg md:text-xl">$10</span>
              <span className="text-xs md:text-sm text-gray-500">/month</span>
              <p className="text-xs md:text-sm text-primary font-semibold">First month FREE!</p>
            </div>
            <ul className="space-y-1 md:space-y-2">
              <li className="flex items-start">
                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5 md:mr-2 md:h-4 md:w-4 text-green-500 mt-0.5" />
                <span className="text-xs md:text-sm">All regular user features</span>
              </li>
              <li className="flex items-start">
                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5 md:mr-2 md:h-4 md:w-4 text-green-500 mt-0.5" />
                <span className="text-xs md:text-sm">Create your own store</span>
              </li>
              <li className="flex items-start">
                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5 md:mr-2 md:h-4 md:w-4 text-green-500 mt-0.5" />
                <span className="text-xs md:text-sm">Add unlimited products</span>
              </li>
              <li className="flex items-start">
                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5 md:mr-2 md:h-4 md:w-4 text-green-500 mt-0.5" />
                <span className="text-xs md:text-sm">Choose from 3 store templates</span>
              </li>
            </ul>
          </CardContent>
          <CardFooter className={isMobile ? "p-4" : ""}>
            <Button 
              variant="default" 
              className="w-full text-xs md:text-sm" 
              onClick={() => onSelect('admin')}
              disabled={isLoading}
              size={isMobile ? "sm" : "default"}
            >
              <CreditCard className="mr-1.5 h-3.5 w-3.5 md:mr-2 md:h-4 md:w-4" />
              Start Free Trial
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default AccountTypeSelection;
