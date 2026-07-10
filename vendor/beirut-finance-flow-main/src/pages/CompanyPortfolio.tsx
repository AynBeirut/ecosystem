import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import AppLayout from "@/components/AppLayout";
import { useAppContext } from "@/context/AppContext";
import { Textarea } from "@/components/ui/textarea";
import { FileUpload } from "@/components/FileUpload";
import { useToast } from "@/hooks/use-toast";
import { Image as ImageIcon, Plus, Trash, Upload, X, FileDown, Mail, Send } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";

const CompanyPortfolio = () => {
  const { user, portfolioItems, addPortfolioItem, logout } = useAppContext();
  const { toast } = useToast();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [description, setDescription] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  
  // Store multiple images in temporary state
  const [portfolioImages, setPortfolioImages] = useState<Array<{
    image: string;
    caption: string;
    description: string;
  }>>([]);

  const [isSendDialogOpen, setIsSendDialogOpen] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string | null>(null);
  
  const handleLogout = () => {
    logout();
    toast({
      title: "Logged out",
      description: "You've been successfully logged out",
    });
  };


  const handleImageUpload = (fileDataUrl: string) => {
    setSelectedImage(fileDataUrl);
  };

  const handleAddImageToCollection = () => {
    if (!selectedImage) {
      toast({
        title: "Image Required",
        description: "Please upload an image for your portfolio item",
        variant: "destructive",
      });
      return;
    }

    if (!caption) {
      toast({
        title: "Caption Required",
        description: "Please provide a caption for your portfolio item",
        variant: "destructive",
      });
      return;
    }

    // Check if we're already at the limit of 3 images
    if (portfolioImages.length >= 3) {
      toast({
        title: "Maximum Images Reached",
        description: "You can only add up to 3 images at once. Submit these first or remove some.",
        variant: "destructive",
      });
      return;
    }

    // Add to temporary portfolio images
    setPortfolioImages([...portfolioImages, {
      image: selectedImage,
      caption: caption,
      description: description,
    }]);

    // Reset form for next image
    setSelectedImage(null);
    setCaption("");
    setDescription("");

    toast({
      title: "Image Added to Collection",
      description: "Add up to 3 images before submitting to your portfolio",
    });
  };

  const handleRemoveImageFromCollection = (index: number) => {
    const newImages = [...portfolioImages];
    newImages.splice(index, 1);
    setPortfolioImages(newImages);
  };

  const handleAddPortfolioItems = () => {
    if (portfolioImages.length === 0 && !selectedImage) {
      toast({
        title: "No Images Selected",
        description: "Please add at least one image to your portfolio",
        variant: "destructive",
      });
      return;
    }

    // If there's a current image in the form, add it first
    if (selectedImage && caption) {
      if (portfolioImages.length >= 3) {
        toast({
          title: "Maximum Images Reached",
          description: "You can only add up to 3 images at once. Submit these first or remove some.",
          variant: "destructive",
        });
        return;
      }

      portfolioImages.push({
        image: selectedImage,
        caption: caption,
        description: description || "",
      });

      setSelectedImage(null);
      setCaption("");
      setDescription("");
    }

    // Now add all images in the collection to the portfolio
    portfolioImages.forEach(item => {
      addPortfolioItem({
        image: item.image,
        caption: item.caption,
        description: item.description || undefined,
      });
    });

    // Clear the collection
    setPortfolioImages([]);

    toast({
      title: "Items Added",
      description: `${portfolioImages.length} portfolio item(s) have been added successfully`,
    });
  };

  const removePortfolioItem = (id: string) => {
    // This would be implemented in a real app
    toast({
      title: "Coming Soon",
      description: "Item removal will be available in the next update",
    });
  };

  const handlePreviewPortfolio = () => {
    setPreviewOpen(true);
  };
  
  const handleExportPortfolioAsPdf = () => {
    // In a real app, this would call a PDF generation service
    toast({
      title: "Portfolio Exported",
      description: "Your portfolio has been exported to PDF",
    });
  };
  
  const handleSendPortfolio = (portfolioId: string | null = null) => {
    setSelectedPortfolioId(portfolioId);
    setIsSendDialogOpen(true);
  };
  
  const confirmSendPortfolio = () => {
    if (!recipientEmail) {
      toast({
        title: "Email Required",
        description: "Please provide a valid email address",
        variant: "destructive",
      });
      return;
    }
    
    // In a real app, this would send an email with the portfolio
    toast({
      title: "Portfolio Sent",
      description: `Your portfolio has been sent to ${recipientEmail}`,
    });
    
    setIsSendDialogOpen(false);
    setRecipientEmail("");
  };

  return (
    <AppLayout onLogout={handleLogout}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Portfolio</h1>
          <p className="text-gray-500 dark:text-gray-400">Preview how your portfolio will appear to clients</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>Add New Portfolio Item</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Project Image</label>
                  <div className="flex flex-col gap-4">
                    {selectedImage ? (
                      <div className="relative">
                        <img 
                          src={selectedImage} 
                          alt="Portfolio Preview" 
                          className="w-full aspect-video object-cover rounded-md border"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute top-2 right-2 bg-white/80 hover:bg-white/90 dark:bg-black/50 dark:hover:bg-black/70 rounded-full w-8 h-8 p-0"
                          onClick={() => setSelectedImage(null)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center w-full aspect-video bg-gray-100 dark:bg-gray-800 rounded-md">
                        <ImageIcon className="h-12 w-12 text-gray-400" />
                      </div>
                    )}
                    <FileUpload 
                      onFileUpload={handleImageUpload} 
                      accept="image/*"
                      maxSize={5}
                      label="Upload Image"
                      icon={<Upload className="mr-2 h-4 w-4" />}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Caption</label>
                  <Input 
                    placeholder={`Enter a caption for this image`}
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Description</label>
                  <Textarea 
                    placeholder={`Enter a detailed description of this project or achievement`}
                    className="resize-none min-h-[120px]"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>

                <Button 
                  className="w-full bg-indigo-600 hover:bg-indigo-700"
                  onClick={handleAddImageToCollection}
                  disabled={!selectedImage || !caption}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add
                </Button>

                {/* Display temporary collection of images */}
                {portfolioImages.length > 0 && (
                    <div className="mt-4 space-y-4">
                      <div className="flex justify-between items-center">
                        <h3 className="text-sm font-medium">Images Ready to Add ({portfolioImages.length}/3)</h3>
                      </div>
                    <div className="space-y-3">
                      {portfolioImages.map((item, index) => (
                        <div key={index} className="flex items-center gap-3 p-2 border rounded-md">
                          <img 
                            src={item.image} 
                            alt={item.caption} 
                            className="w-16 h-12 object-cover rounded"
                          />
                          <div className="flex-grow min-w-0">
                            <p className="text-sm font-medium truncate">{item.caption}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="p-1 h-8 w-8 text-red-500"
                            onClick={() => handleRemoveImageFromCollection(index)}
                          >
                            <Trash className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                    <Button 
                      className="w-full mt-2"
                      onClick={handleAddPortfolioItems}
                    >
                      Submit All Images
                    </Button>
                  </div>
                )}

                {portfolioImages.length === 0 && selectedImage === null && (
                  <div className="p-3 bg-amber-50 dark:bg-amber-900/30 rounded-md text-sm text-amber-800 dark:text-amber-300">
                    <p>You can add up to 3 images at once to your portfolio.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Portfolio Items</CardTitle>
              </CardHeader>
              <CardContent>
                {portfolioItems.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <ImageIcon className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                    <p>No portfolio items yet</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {portfolioItems.map((item) => (
                      <div key={item.id} className="border rounded-lg overflow-hidden bg-white dark:bg-gray-800">
                        <div className="relative">
                          <img 
                            src={item.image} 
                            alt={item.caption} 
                            className="w-full aspect-video object-cover"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute top-2 right-2 bg-white/80 hover:bg-white/90 dark:bg-black/50 dark:hover:bg-black/70 rounded-full w-8 h-8 p-0"
                            onClick={() => removePortfolioItem(item.id)}
                          >
                            <Trash className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                        <div className="p-3">
                          <h3 className="font-medium">{item.caption}</h3>
                          {item.description && (
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                              {item.description}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                  <div className="mt-4">
                    <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg border">
                      <h3 className="text-sm font-medium mb-2">Portfolio Preview</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Preview how your portfolio will appear to clients
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button 
                          className="bg-indigo-600 hover:bg-indigo-700"
                          onClick={handlePreviewPortfolio}
                        >
                          Preview Portfolio
                        </Button>
                        
                        <Button 
                          variant="outline"
                          onClick={handleExportPortfolioAsPdf}
                        >
                          <FileDown className="mr-2 h-4 w-4" />
                          Save as PDF
                        </Button>
                        
                        <Button 
                          variant="outline"
                          onClick={() => handleSendPortfolio(null)}
                        >
                          <Send className="mr-2 h-4 w-4" />
                          Send
                        </Button>
                      </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Portfolio Preview Dialog */}
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Portfolio Preview</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-8">
              {/* Company Information */}
              <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <div className="h-20 w-20 bg-indigo-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                    {user?.company.logo ? (
                      <img 
                        src={user.company.logo} 
                        alt={user.company.name} 
                        className="w-full h-full object-cover rounded-full" 
                      />
                    ) : (
                      user?.company.name.substring(0, 2).toUpperCase()
                    )}
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">{user?.company.name}</h2>
                    <p className="text-gray-500 dark:text-gray-400">{user?.company.description}</p>
                    
                    <div className="mt-2 flex flex-wrap gap-2">
                      {user?.company.website && (
                        <a 
                          href={user.company.website} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-sm text-indigo-600 hover:underline"
                        >
                          {user.company.website}
                        </a>
                      )}
                      
                      {user?.company.email && (
                        <a 
                          href={`mailto:${user.company.email}`}
                          className="text-sm text-indigo-600 hover:underline"
                        >
                          {user.company.email}
                        </a>
                      )}
                      
                      {user?.company.phone && (
                        <a 
                          href={`tel:${user.company.phone}`}
                          className="text-sm text-indigo-600 hover:underline"
                        >
                          {user.company.phone}
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Portfolio Items */}
              <div className="space-y-6">
                <h3 className="text-xl font-bold">Our Work</h3>
                
                {portfolioItems.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <p>No portfolio items yet.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {portfolioItems.map((item) => (
                      <div key={item.id} className="bg-white dark:bg-gray-800 rounded-lg overflow-hidden shadow-sm">
                        <img 
                          src={item.image} 
                          alt={item.caption} 
                          className="w-full aspect-video object-cover" 
                        />
                        <div className="p-4">
                          <h4 className="text-lg font-medium">{item.caption}</h4>
                          {item.description && (
                            <p className="mt-2 text-gray-600 dark:text-gray-300">
                              {item.description}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="flex flex-wrap gap-2 justify-end">
                <Button 
                  variant="outline"
                  onClick={() => setPreviewOpen(false)}
                >
                  Close Preview
                </Button>
                
                <Button 
                  variant="outline"
                  onClick={handleExportPortfolioAsPdf}
                >
                  <FileDown className="mr-2 h-4 w-4" />
                  Save as PDF
                </Button>
                
                <Button 
                  variant="outline"
                  onClick={() => {
                    setPreviewOpen(false);
                    handleSendPortfolio(null);
                  }}
                >
                  <Mail className="mr-2 h-4 w-4" />
                  Send by Email
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Send Portfolio Dialog */}
        <Dialog open={isSendDialogOpen} onOpenChange={setIsSendDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Send Portfolio</DialogTitle>
              <DialogDescription>
                Enter the recipient's email address to send your portfolio.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Recipient Email</label>
                <Input
                  type="email"
                  placeholder="client@example.com"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                />
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsSendDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={confirmSendPortfolio}
                className="bg-indigo-600"
                disabled={!recipientEmail}
              >
                <Send className="mr-2 h-4 w-4" />
                Send Portfolio
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};

export default CompanyPortfolio;
