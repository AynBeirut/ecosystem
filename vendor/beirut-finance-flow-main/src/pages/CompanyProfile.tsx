import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import AppLayout from "@/components/AppLayout";
import { useAppContext } from "@/context/AppContext";
import { FileUpload } from "@/components/FileUpload";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, Palette, Image, Signature, Building, Globe, Mail, Phone } from "lucide-react";
import SignatureCanvas from "@/components/SignatureCanvas";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

const CompanyProfile = () => {
  const { user, updateCompanyProfile, logout } = useAppContext();
  const { toast } = useToast();

  const [companyProfile, setCompanyProfile] = useState({
    name: user?.company.name || "",
    email: user?.company.email || "",
    website: user?.company.website || "",
    address: user?.company.address || "",
    phone: user?.company.phone || "",
    taxId: user?.company.taxId || "",
    commercialRegistry: user?.company.commercialRegistry || "",
    description: user?.company.description || "",
    logo: user?.company.logo || "",
    signature: user?.company.signature || "",
    primaryColor: user?.company.primaryColor || "#4F46E5",
    secondaryColor: user?.company.secondaryColor || "#C7D2FE",
    invoiceTemplate: user?.company.invoiceTemplate || "basic",
  });

  const [signatureMethod, setSignatureMethod] = useState<"upload" | "draw">("upload");
  const [signatureDataURL, setSignatureDataURL] = useState<string>("");

  // Load user data when component mounts or user changes
  useEffect(() => {
    if (user?.company) {
      console.log("Loading user company data:", user.company);
      setCompanyProfile({
        name: user.company.name || "",
        email: user.company.email || "",
        website: user.company.website || "",
        address: user.company.address || "",
        phone: user.company.phone || "",
        taxId: user.company.taxId || "",
        commercialRegistry: user.company.commercialRegistry || "",
        description: user.company.description || "",
        logo: user.company.logo || "",
        signature: user.company.signature || "",
        primaryColor: user.company.primaryColor || "#4F46E5",
        secondaryColor: user.company.secondaryColor || "#C7D2FE",
        invoiceTemplate: user.company.invoiceTemplate || "basic",
      });

      if (user.company.signature) {
        setSignatureDataURL(user.company.signature);
      }
    }
  }, [user]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    console.log(`Input changed: ${name} = ${value}`);
    setCompanyProfile(prev => ({ ...prev, [name]: value }));
  };

  const handleLogoUpload = (dataURL: string) => {
    console.log("Logo file uploaded, updating state");
    setCompanyProfile(prev => ({ ...prev, logo: dataURL }));
    updateCompanyProfile({
      ...companyProfile,
      logo: dataURL
    });
    toast({
      title: "Logo Updated",
      description: "Your company logo has been uploaded",
    });
  };

  const handleSignatureUpload = (dataURL: string) => {
    console.log("Signature file uploaded, updating state");
    setSignatureDataURL(dataURL);
    setCompanyProfile(prev => ({ ...prev, signature: dataURL }));
    updateCompanyProfile({
      ...companyProfile,
      signature: dataURL
    });
    toast({
      title: "Signature Updated",
      description: "Your signature has been uploaded",
    });
  };

  const handleSignatureChange = (dataURL: string) => {
    console.log("Signature canvas changed, updating state");
    setSignatureDataURL(dataURL);
    setCompanyProfile(prev => ({ ...prev, signature: dataURL }));
    updateCompanyProfile({
      ...companyProfile,
      signature: dataURL
    });
  };

  const handlePrimaryColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const color = e.target.value;
    console.log("Primary color changed:", color);
    setCompanyProfile(prev => ({ ...prev, primaryColor: color }));
    updateCompanyProfile({
      ...companyProfile,
      primaryColor: color
    });
  };

  const handleSecondaryColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const color = e.target.value;
    console.log("Secondary color changed:", color);
    setCompanyProfile(prev => ({ ...prev, secondaryColor: color }));
    updateCompanyProfile({
      ...companyProfile,
      secondaryColor: color
    });
  };

  const handleTemplateChange = (template: "basic" | "modern" | "professional") => {
    console.log("Template changed:", template);
    setCompanyProfile(prev => ({ ...prev, invoiceTemplate: template }));
    updateCompanyProfile({
      ...companyProfile,
      invoiceTemplate: template
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Saving company profile:", companyProfile);
    
    try {
      // Make sure we're passing all the required fields with the correct names
      updateCompanyProfile({
        name: companyProfile.name,
        email: companyProfile.email,
        website: companyProfile.website,
        address: companyProfile.address,
        phone: companyProfile.phone,
        taxId: companyProfile.taxId,
        commercialRegistry: companyProfile.commercialRegistry,
        description: companyProfile.description,
        logo: companyProfile.logo,
        signature: companyProfile.signature,
        primaryColor: companyProfile.primaryColor,
        secondaryColor: companyProfile.secondaryColor,
        invoiceTemplate: companyProfile.invoiceTemplate,
      });
      
      toast({
        title: "Profile Updated",
        description: "Your company profile has been updated successfully",
      });
    } catch (error) {
      console.error("Error updating profile:", error);
      toast({
        title: "Error",
        description: "Failed to update company profile",
        variant: "destructive",
      });
    }
  };

  const handleLogout = () => {
    logout();
    toast({
      title: "Logged out",
      description: "You've been successfully logged out",
    });
  };

  return (
    <AppLayout onLogout={handleLogout}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
          <p className="text-gray-500 dark:text-gray-400">
            Update your company profile information
          </p>
        </div>

        <Tabs defaultValue="general">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="appearance">Appearance</TabsTrigger>
          </TabsList>

          <TabsContent value="general">
            <Card>
              <CardHeader>
                <CardTitle>Business Information</CardTitle>
                <CardDescription>
                  Add your company details for invoices and documents
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label htmlFor="name" className="text-sm font-medium">
                        <Building className="inline-block w-4 h-4 mr-2" />
                        Company Name
                      </label>
                      <Input
                        id="name"
                        name="name"
                        placeholder="Your Company Name"
                        value={companyProfile.name}
                        onChange={handleInputChange}
                      />
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="email" className="text-sm font-medium">
                        <Mail className="inline-block w-4 h-4 mr-2" />
                        Business Email
                      </label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        placeholder="company@example.com"
                        value={companyProfile.email}
                        onChange={handleInputChange}
                      />
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="website" className="text-sm font-medium">
                        <Globe className="inline-block w-4 h-4 mr-2" />
                        Website
                      </label>
                      <Input
                        id="website"
                        name="website"
                        placeholder="https://www.example.com"
                        value={companyProfile.website}
                        onChange={handleInputChange}
                      />
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="phone" className="text-sm font-medium">
                        <Phone className="inline-block w-4 h-4 mr-2" />
                        Phone Number
                      </label>
                      <Input
                        id="phone"
                        name="phone"
                        placeholder="+1 234 567 890"
                        value={companyProfile.phone}
                        onChange={handleInputChange}
                      />
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="address" className="text-sm font-medium">
                        Address
                      </label>
                      <Input
                        id="address"
                        name="address"
                        placeholder="123 Business Street, City"
                        value={companyProfile.address}
                        onChange={handleInputChange}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label htmlFor="taxId" className="text-sm font-medium">
                          Tax ID (Optional)
                        </label>
                        <Input
                          id="taxId"
                          name="taxId"
                          placeholder="Tax ID Number"
                          value={companyProfile.taxId}
                          onChange={handleInputChange}
                        />
                      </div>

                      <div className="space-y-2">
                        <label htmlFor="commercialRegistry" className="text-sm font-medium">
                          Commercial Registry Number (Optional)
                        </label>
                        <Input
                          id="commercialRegistry"
                          name="commercialRegistry"
                          placeholder="Registry Number"
                          value={companyProfile.commercialRegistry}
                          onChange={handleInputChange}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="description" className="text-sm font-medium">
                        Business Description (Optional)
                      </label>
                      <Input
                        id="description"
                        name="description"
                        placeholder="Brief description of your business"
                        value={companyProfile.description}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>

                  <Button type="submit" className="w-full">Save Information</Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="appearance">
            <Card>
              <CardHeader>
                <CardTitle>Brand Appearance</CardTitle>
                <CardDescription>
                  Customize how your brand appears on invoices and documents
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-4">
                    <div className="space-y-3">
                      <label className="text-sm font-medium">
                        <Image className="inline-block w-4 h-4 mr-2" />
                        Company Logo
                      </label>
                      <div className="flex items-center gap-4">
                        {companyProfile.logo && (
                          <div className="relative w-24 h-24 border rounded-lg overflow-hidden bg-white">
                            <img
                              src={companyProfile.logo}
                              alt="Company Logo"
                              className="w-full h-full object-contain"
                            />
                          </div>
                        )}
                        <div className="flex-1">
                          <FileUpload
                            icon={<Upload className="w-4 h-4 mr-2" />}
                            label="Upload Logo"
                            accept="image/*"
                            onFileUpload={handleLogoUpload}
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            Recommended size: 200x200 pixels. Max 2MB.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="text-sm font-medium">
                        <Signature className="inline-block w-4 h-4 mr-2" />
                        Digital Signature
                      </label>
                      
                      <div className="space-y-2">
                        <div className="flex gap-4">
                          <Button 
                            type="button"
                            variant={signatureMethod === "upload" ? "default" : "outline"} 
                            size="sm"
                            onClick={() => setSignatureMethod("upload")}
                          >
                            Upload
                          </Button>
                          <Button 
                            type="button"
                            variant={signatureMethod === "draw" ? "default" : "outline"}
                            size="sm"
                            onClick={() => setSignatureMethod("draw")}
                          >
                            Draw
                          </Button>
                        </div>
                        
                        {signatureMethod === "upload" ? (
                          <div className="flex items-center gap-4">
                            {signatureDataURL && (
                              <div className="relative w-40 h-24 border rounded-lg overflow-hidden bg-white">
                                <img
                                  src={signatureDataURL}
                                  alt="Signature"
                                  className="w-full h-full object-contain"
                                />
                              </div>
                            )}
                            <div className="flex-1">
                              <FileUpload
                                icon={<Upload className="w-4 h-4 mr-2" />}
                                label="Upload Signature"
                                accept="image/*"
                                onFileUpload={handleSignatureUpload}
                              />
                              <p className="text-xs text-gray-500 mt-1">
                                Recommended size: 400x200 pixels. Max 2MB.
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <SignatureCanvas onChange={handleSignatureChange} initialImage={signatureDataURL} />
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <label className="text-sm font-medium">
                        <Palette className="inline-block w-4 h-4 mr-2" />
                        Brand Colors
                      </label>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label htmlFor="primaryColor" className="text-sm">Primary Color</label>
                          <div className="flex gap-2 items-center">
                            <input
                              type="color"
                              id="primaryColor"
                              value={companyProfile.primaryColor}
                              onChange={handlePrimaryColorChange}
                              className="w-10 h-10 rounded cursor-pointer"
                            />
                            <Input
                              value={companyProfile.primaryColor}
                              onChange={handlePrimaryColorChange}
                              className="font-mono"
                            />
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <label htmlFor="secondaryColor" className="text-sm">Secondary Color</label>
                          <div className="flex gap-2 items-center">
                            <input
                              type="color"
                              id="secondaryColor"
                              value={companyProfile.secondaryColor}
                              onChange={handleSecondaryColorChange}
                              className="w-10 h-10 rounded cursor-pointer"
                            />
                            <Input
                              value={companyProfile.secondaryColor}
                              onChange={handleSecondaryColorChange}
                              className="font-mono"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Label className="text-sm font-medium">Invoice Template</Label>
                      <Select
                        value={companyProfile.invoiceTemplate}
                        onValueChange={(value: "basic" | "modern" | "professional") => handleTemplateChange(value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a template" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="basic">Basic</SelectItem>
                          <SelectItem value="modern">Modern</SelectItem>
                          <SelectItem value="professional">Professional</SelectItem>
                        </SelectContent>
                      </Select>
                      
                      <div className="mt-4">
                        <div className="border rounded-md p-4 bg-white">
                          <div className="text-sm text-gray-500 mb-2">Preview:</div>
                          {companyProfile.invoiceTemplate === "basic" && (
                            <div className="border rounded p-3 bg-white">
                              <div className="flex justify-between mb-4">
                                <div>
                                  <h3 className="font-bold">Your Company</h3>
                                  <p className="text-sm">123 Street, City</p>
                                </div>
                                <div className="text-right">
                                  <h2 style={{color: companyProfile.primaryColor}} className="font-bold text-lg">INVOICE</h2>
                                  <p className="text-sm">#INV-12345</p>
                                </div>
                              </div>
                              <table className="w-full text-sm">
                                <thead style={{backgroundColor: companyProfile.secondaryColor}}>
                                  <tr>
                                    <th className="text-left p-1">Item</th>
                                    <th className="text-right p-1">Amount</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  <tr>
                                    <td className="p-1">Service</td>
                                    <td className="text-right p-1">$100.00</td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                          )}
                          
                          {companyProfile.invoiceTemplate === "modern" && (
                            <div className="border rounded p-3 bg-white">
                              <div className="mb-4" style={{backgroundColor: companyProfile.primaryColor, padding: "10px", borderRadius: "4px", color: "white"}}>
                                <h2 className="font-bold text-lg">INVOICE #INV-12345</h2>
                              </div>
                              <div className="flex justify-between mb-4">
                                <div>
                                  <h3 className="font-bold">Your Company</h3>
                                  <p className="text-sm">123 Street, City</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-sm">Date: 01/01/2025</p>
                                  <p className="text-sm">Due Date: 01/15/2025</p>
                                </div>
                              </div>
                              <table className="w-full text-sm">
                                <thead>
                                  <tr style={{borderBottom: `2px solid ${companyProfile.secondaryColor}`}}>
                                    <th className="text-left p-1">Item</th>
                                    <th className="text-right p-1">Amount</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  <tr>
                                    <td className="p-1">Service</td>
                                    <td className="text-right p-1">$100.00</td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                          )}
                          
                          {companyProfile.invoiceTemplate === "professional" && (
                            <div className="border rounded p-3 bg-white">
                              <div className="flex justify-between items-center mb-6 pb-4" style={{borderBottom: `3px solid ${companyProfile.primaryColor}`}}>
                                <div>
                                  <h3 className="font-bold text-xl">Your Company</h3>
                                </div>
                                <div className="text-right">
                                  <h2 style={{color: companyProfile.primaryColor}} className="font-bold text-2xl">INVOICE</h2>
                                  <p className="text-sm">#INV-12345</p>
                                </div>
                              </div>
                              <div className="flex justify-between mb-4">
                                <div>
                                  <p className="text-sm font-bold mb-1">BILL TO:</p>
                                  <p className="text-sm">Client Name</p>
                                  <p className="text-sm">123 Client St</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-sm font-bold mb-1">DETAILS:</p>
                                  <p className="text-sm">Date: 01/01/2025</p>
                                  <p className="text-sm">Due Date: 01/15/2025</p>
                                </div>
                              </div>
                              <table className="w-full text-sm">
                                <thead style={{backgroundColor: companyProfile.secondaryColor}}>
                                  <tr>
                                    <th className="text-left p-2 rounded-l">Item</th>
                                    <th className="text-right p-2 rounded-r">Amount</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  <tr>
                                    <td className="p-2">Professional Service</td>
                                    <td className="text-right p-2">$100.00</td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full" 
                    style={{backgroundColor: companyProfile.primaryColor}}
                  >
                    Save Appearance Settings
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default CompanyProfile;
