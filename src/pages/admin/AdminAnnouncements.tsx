import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Megaphone, Plus, Edit3, Trash2, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import AdminPageShell from '@/components/admin/AdminPageShell';
import AdminPanel from '@/components/admin/AdminPanel';
import { StoreAnnouncement } from '@/types/product';

const AdminAnnouncements: React.FC = () => {
  const { toast } = useToast();
  const [announcements, setAnnouncements] = useState<StoreAnnouncement[]>([
    {
      id: 'ann1',
      storeId: 'store1',
      title: 'Summer Sale!',
      message: 'Get 20% off all electronics this summer. Limited time offer!',
      startDate: new Date('2025-06-01'),
      endDate: new Date('2025-06-30'),
      isActive: true
    },
    {
      id: 'ann2',
      storeId: 'store1', 
      title: 'New Product Launch',
      message: 'Check out our latest wireless headphones with premium sound quality.',
      startDate: new Date('2025-07-01'),
      endDate: new Date('2025-07-31'),
      isActive: false
    }
  ]);

  const [isCreating, setIsCreating] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<StoreAnnouncement | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    startDate: new Date(),
    endDate: new Date(),
    isActive: true
  });

  const handleCreate = () => {
    if (!formData.title || !formData.message) {
      toast({ title: "Error", description: "Please fill in all required fields", variant: "destructive" });
      return;
    }

    const newAnnouncement: StoreAnnouncement = {
      id: `ann_${Date.now()}`,
      storeId: 'store1',
      title: formData.title,
      message: formData.message,
      startDate: formData.startDate,
      endDate: formData.endDate,
      isActive: formData.isActive
    };

    setAnnouncements([newAnnouncement, ...announcements]);
    setFormData({ title: '', message: '', startDate: new Date(), endDate: new Date(), isActive: true });
    setIsCreating(false);
    toast({ title: "Success", description: "Announcement created successfully!" });
  };

  const handleEdit = (announcement: StoreAnnouncement) => {
    setEditingAnnouncement(announcement);
    setFormData({
      title: announcement.title,
      message: announcement.message,
      startDate: announcement.startDate,
      endDate: announcement.endDate,
      isActive: announcement.isActive
    });
  };

  const handleUpdate = () => {
    if (!editingAnnouncement || !formData.title || !formData.message) {
      toast({ title: "Error", description: "Please fill in all required fields", variant: "destructive" });
      return;
    }

    const updatedAnnouncement: StoreAnnouncement = {
      ...editingAnnouncement,
      title: formData.title,
      message: formData.message,
      startDate: formData.startDate,
      endDate: formData.endDate,
      isActive: formData.isActive
    };

    setAnnouncements(announcements.map(a => a.id === editingAnnouncement.id ? updatedAnnouncement : a));
    setEditingAnnouncement(null);
    setFormData({ title: '', message: '', startDate: new Date(), endDate: new Date(), isActive: true });
    toast({ title: "Success", description: "Announcement updated successfully!" });
  };

  const handleDelete = (id: string) => {
    setAnnouncements(announcements.filter(a => a.id !== id));
    toast({ title: "Success", description: "Announcement deleted successfully!" });
  };

  const toggleActive = (id: string) => {
    setAnnouncements(announcements.map(a => 
      a.id === id ? { ...a, isActive: !a.isActive } : a
    ));
    const announcement = announcements.find(a => a.id === id);
    toast({ 
      title: announcement?.isActive ? "Announcement Deactivated" : "Announcement Activated",
      description: `"${announcement?.title}" has been ${announcement?.isActive ? 'deactivated' : 'activated'}.`
    });
  };

  const isAnnouncementActive = (announcement: StoreAnnouncement) => {
    const now = new Date();
    return announcement.isActive && 
           now >= announcement.startDate && 
           now <= announcement.endDate;
  };

  return (
    <AdminPageShell
      title="Announcements"
      description="Create and manage store announcements and promotions"
      eyebrow="Business Tools"
      actions={(
        <Dialog open={isCreating} onOpenChange={setIsCreating}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Announcement
            </Button>
          </DialogTrigger>
              <DialogContent className="w-[95vw] max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create Announcement</DialogTitle>
                  <DialogDescription>
                    Create a new announcement for your store.
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="title">Title *</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="Announcement title"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="message">Message *</Label>
                    <Textarea
                      id="message"
                      value={formData.message}
                      onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                      placeholder="Announcement message"
                      rows={4}
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Start Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-start text-left font-normal">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {format(formData.startDate, "MMM dd, yyyy")}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={formData.startDate}
                            onSelect={(date) => date && setFormData(prev => ({ ...prev, startDate: date }))}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    
                    <div>
                      <Label>End Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-start text-left font-normal">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {format(formData.endDate, "MMM dd, yyyy")}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={formData.endDate}
                            onSelect={(date) => date && setFormData(prev => ({ ...prev, endDate: date }))}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="active"
                      checked={formData.isActive}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
                    />
                    <Label htmlFor="active">Active immediately</Label>
                  </div>
                </div>
                
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCreating(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreate}>
                    Create Announcement
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
      )}
    >

        <div className="grid grid-cols-1 gap-4">
          {announcements.map((announcement) => (
            <AdminPanel key={announcement.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2">
                      {announcement.title}
                      {isAnnouncementActive(announcement) && (
                        <Badge className="bg-green-500">Live</Badge>
                      )}
                      {announcement.isActive && !isAnnouncementActive(announcement) && (
                        <Badge variant="secondary">Scheduled</Badge>
                      )}
                      {!announcement.isActive && (
                        <Badge variant="outline">Inactive</Badge>
                      )}
                    </CardTitle>
                    <CardDescription>
                      {format(announcement.startDate, "MMM dd, yyyy")} - {format(announcement.endDate, "MMM dd, yyyy")}
                    </CardDescription>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={announcement.isActive}
                      onCheckedChange={() => toggleActive(announcement.id)}
                    />
                  </div>
                </div>
              </CardHeader>
              
              <CardContent>
                <p className="text-muted-foreground mb-4">{announcement.message}</p>
                
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(announcement)}
                  >
                    <Edit3 className="h-3 w-3 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    Preview
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDelete(announcement.id)}
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </AdminPanel>
          ))}
          
          {announcements.length === 0 && (
            <AdminPanel>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Megaphone className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Announcements Yet</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Create your first announcement to promote sales, events, or important updates
                </p>
                <Button onClick={() => setIsCreating(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Announcement
                </Button>
              </CardContent>
            </AdminPanel>
          )}
        </div>

      {/* Edit Announcement Dialog */}
      <Dialog open={!!editingAnnouncement} onOpenChange={() => setEditingAnnouncement(null)}>
        <DialogContent className="w-[95vw] max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Announcement</DialogTitle>
            <DialogDescription>
              Update your announcement details below.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-title">Title *</Label>
              <Input
                id="edit-title"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Announcement title"
              />
            </div>
            
            <div>
              <Label htmlFor="edit-message">Message *</Label>
              <Textarea
                id="edit-message"
                value={formData.message}
                onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                placeholder="Announcement message"
                rows={4}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Start Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(formData.startDate, "MMM dd, yyyy")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={formData.startDate}
                      onSelect={(date) => date && setFormData(prev => ({ ...prev, startDate: date }))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              
              <div>
                <Label>End Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(formData.endDate, "MMM dd, yyyy")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={formData.endDate}
                      onSelect={(date) => date && setFormData(prev => ({ ...prev, endDate: date }))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch
                id="edit-active"
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
              />
              <Label htmlFor="edit-active">Active</Label>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingAnnouncement(null)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate}>
              Update Announcement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminPageShell>
  );
};

export default AdminAnnouncements;