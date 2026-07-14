import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { Navigate } from "react-router-dom";
import { Users, UserPlus, Trash2, ShieldCheck, Crown } from "lucide-react";
import { toast } from "sonner";

import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import { useAppContext } from "@/context/AppContext";
import { supabase } from "@/integrations/supabase/client";

type AssignableRole = "admin" | "manager" | "agent" | "assistant";
const SEAT_LIMITS: Record<string, number> = { free: 1, paid: 5, pro: 10 };

const OrgMembers = () => {
  const {
    activeOrganizationId, organizations, currentUserRole,
    inviteUserToOrg, listOrgMembers, removeOrgMember, updateMemberRole, updateOrgPlan,
  } = useAppContext();

  const [members, setMembers] = useState<Array<{ user_id: string; role: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AssignableRole>("assistant");
  const [inviting, setInviting] = useState(false);
  const lastInviteRef = useRef(0);

  const canManage = currentUserRole === "owner" || currentUserRole === "admin";
  const isOwner = currentUserRole === "owner";

  const org = useMemo(
    () => organizations.find((o) => o.id === activeOrganizationId),
    [organizations, activeOrganizationId]
  );
  const plan = ((org as any)?.plan || "free") as "free" | "paid" | "pro";
  const limit = SEAT_LIMITS[plan] ?? 1;
  const used = members.length;

  const refresh = useCallback(async () => {
    setLoading(true);
    const rows = await listOrgMembers();
    setMembers(rows);
    setLoading(false);
  }, [listOrgMembers]);

  useEffect(() => { refresh(); }, [refresh, activeOrganizationId]);

  const handleInvite = async () => {
    if (!email.trim()) return;
    if (Date.now() - lastInviteRef.current < 3000) {
      toast.error("Please wait a few seconds before sending another invite");
      return;
    }
    if (used >= limit) {
      toast.error(`Plan limit reached (${plan}: ${limit} member${limit > 1 ? "s" : ""}). Upgrade to add more.`);
      return;
    }
    lastInviteRef.current = Date.now();
    setInviting(true);
    const res = await inviteUserToOrg(email.trim(), role);
    setInviting(false);
    if (res.ok) { toast.success(res.message); setEmail(""); refresh(); }
    else toast.error(res.message);
  };

  const handleRemove = async (userId: string) => {
    if (!confirm("Remove this member from the organization?")) return;
    const ok = await removeOrgMember(userId);
    if (ok) { toast.success("Member removed"); refresh(); }
    else toast.error("Failed to remove member");
  };

  const handleRoleChange = async (userId: string, newRole: AssignableRole) => {
    const ok = await updateMemberRole(userId, newRole);
    if (ok) { toast.success("Role updated"); refresh(); }
    else toast.error("Failed to update role");
  };

  const handlePlanChange = async (_newPlan: "free" | "paid" | "pro") => {
    toast.error("Plan changes require verified payment. Please contact support to upgrade.");
  };

  if (!activeOrganizationId) return <Navigate to="/" replace />;

  return (
    <AppLayout onLogout={() => supabase.auth.signOut()}>
      <div className="space-y-6 max-w-4xl">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6 text-indigo-600" /> Organization Members
          </h1>
          <p className="text-sm text-muted-foreground">{org?.name}</p>
        </div>

        {/* Plan & seats */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Crown className="h-4 w-4" /> Plan & Seats
            </CardTitle>
            <CardDescription>
              Current plan: <b>{plan}</b> · Members: <b>{used} / {limit}</b>
            </CardDescription>
          </CardHeader>
          {isOwner && (
            <CardContent>
              <div className="flex items-center gap-2">
                <span className="text-sm">Change plan:</span>
                <Select value={plan} onValueChange={(v: any) => handlePlanChange(v)}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Free (1)</SelectItem>
                    <SelectItem value="paid">Paid (5)</SelectItem>
                    <SelectItem value="pro">Pro (10)</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-xs text-muted-foreground">
                  Real billing not wired yet — manual upgrade for now.
                </span>
              </div>
            </CardContent>
          )}
        </Card>

        {canManage && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <UserPlus className="h-4 w-4" /> Invite member
              </CardTitle>
              <CardDescription>
                The user must have already signed up. We'll add them to this organization by email.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <Input
                  type="email"
                  placeholder="email@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1 min-w-[220px]"
                />
                <Select value={role} onValueChange={(v: any) => setRole(v)}>
                  <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="agent">Agent</SelectItem>
                    <SelectItem value="assistant">Assistant</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={handleInvite} disabled={inviting || !email.trim() || used >= limit}>
                  {inviting ? "Adding…" : "Add member"}
                </Button>
              </div>
              {used >= limit && (
                <p className="text-xs text-amber-600 mt-2">
                  Seat limit reached for the <b>{plan}</b> plan ({limit}). Upgrade to invite more.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Current members ({members.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User ID</TableHead>
                    <TableHead>Role</TableHead>
                    {canManage && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading && (
                    <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-6">Loading…</TableCell></TableRow>
                  )}
                  {!loading && members.length === 0 && (
                    <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-6">No members</TableCell></TableRow>
                  )}
                  {members.map(m => (
                    <TableRow key={m.user_id}>
                      <TableCell className="font-mono text-xs">{m.user_id}</TableCell>
                      <TableCell>
                        {m.role === "owner" ? (
                          <Badge className="bg-amber-600 hover:bg-amber-600"><ShieldCheck className="h-3 w-3 mr-1" /> owner</Badge>
                        ) : (
                          <Badge variant={m.role === "admin" ? "default" : "secondary"}>{m.role}</Badge>
                        )}
                      </TableCell>
                      {canManage && (
                        <TableCell className="text-right">
                          {m.role !== "owner" && (
                            <div className="flex items-center gap-2 justify-end">
                              {isOwner && (
                                <Select
                                  value={(["admin","manager","agent","assistant"].includes(m.role) ? m.role : "assistant") as string}
                                  onValueChange={(v) => handleRoleChange(m.user_id, v as AssignableRole)}
                                >
                                  <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="admin">Admin</SelectItem>
                                    <SelectItem value="manager">Manager</SelectItem>
                                    <SelectItem value="agent">Agent</SelectItem>
                                    <SelectItem value="assistant">Assistant</SelectItem>
                                  </SelectContent>
                                </Select>
                              )}
                              <Button size="sm" variant="ghost" onClick={() => handleRemove(m.user_id)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default OrgMembers;
