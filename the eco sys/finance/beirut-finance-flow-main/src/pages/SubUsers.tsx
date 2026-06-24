
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import AppLayout from "@/components/AppLayout";
import { useAppContext } from "@/context/AppContext";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { User, UserCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const subUserSchema = z.object({
  email: z.string().email("Invalid email address"),
  role: z.enum(["Editor", "Co-Admin"], { required_error: "Please select a role" }),
});

const SubUsers = () => {
  const { user, addSubUser, logout } = useAppContext();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof subUserSchema>>({
    resolver: zodResolver(subUserSchema),
    defaultValues: {
      email: "",
      role: "Editor",
    },
  });

  const onSubmit = (values: z.infer<typeof subUserSchema>) => {
    if (user?.plan !== "pro") {
      toast({
        title: "Premium Required",
        description: "Sub-user management is a premium feature",
        variant: "destructive",
      });
      return;
    }

    addSubUser(values.email, values.role as "Editor" | "Co-Admin");
    
    toast({
      title: "Invitation Sent",
      description: `Invitation email sent to ${values.email}`,
    });
    
    form.reset();
  };

  const handleLogout = () => {
    logout();
    toast({
      title: "Logged out",
      description: "You've been successfully logged out",
    });
  };

  // Redirect non-premium users
  if (user?.plan !== "pro") {
    return (
      <AppLayout onLogout={handleLogout}>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Sub-Users Management</h1>
            <p className="text-gray-500 dark:text-gray-400">Invite team members to your account</p>
          </div>

          <Card className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <UserCheck className="mx-auto h-12 w-12 text-amber-500 mb-4" />
                <h2 className="text-xl font-semibold text-amber-800 dark:text-amber-300">Premium Feature</h2>
                <p className="mt-2 text-amber-700 dark:text-amber-400 max-w-md mx-auto">
                  Sub-user management is available for premium accounts only. Upgrade now to invite team members.
                </p>
                <Button 
                  className="mt-6 bg-amber-600 hover:bg-amber-700"
                  onClick={() => window.location.href = '/premium'}
                >
                  Upgrade to Premium
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout onLogout={handleLogout}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sub-Users Management</h1>
          <p className="text-gray-500 dark:text-gray-400">Invite team members to your account</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Invite New User</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email Address</FormLabel>
                        <FormControl>
                          <Input placeholder="colleague@example.com" {...field} />
                        </FormControl>
                        <FormDescription>
                          We'll send an invitation to this email
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Role</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a role" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Editor">Editor</SelectItem>
                            <SelectItem value="Co-Admin">Co-Admin</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Editor can create/edit documents, Co-Admin can also invite users
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700">
                  Send Invitation
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Current Sub-Users</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {user?.subUsers && user.subUsers.length > 0 ? (
                  user.subUsers.map((subUser) => (
                    <TableRow key={subUser.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center">
                          <div className="h-8 w-8 rounded-full bg-indigo-600 text-white flex items-center justify-center mr-2">
                            {subUser.name.substring(0, 2).toUpperCase()}
                          </div>
                          {subUser.name}
                        </div>
                      </TableCell>
                      <TableCell>{subUser.email}</TableCell>
                      <TableCell>
                        <Badge className={subUser.role === "Co-Admin" 
                          ? "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300"
                          : "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                        }>
                          {subUser.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                          Active
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-4 text-gray-500">
                      No sub-users yet. Invite team members to collaborate.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Role Permissions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h3 className="font-medium">Editor</h3>
                <p className="text-gray-500 dark:text-gray-400">
                  Can create and edit invoices and receipts, but cannot invite users or change account settings.
                </p>
              </div>
              <div>
                <h3 className="font-medium">Co-Admin</h3>
                <p className="text-gray-500 dark:text-gray-400">
                  Can create and edit all documents, invite users with Editor role, and access most settings.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default SubUsers;
