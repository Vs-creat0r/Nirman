"use client";

import * as React from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useSession } from "@/components/providers/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UserCircle, KeyRound, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

export function ProfileDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { token } = useSession();
  const me = useQuery(api.users.getMyUser, token ? { token } : "skip");

  const updateMyProfile = useMutation(api.users.updateMyProfile);
  const changeMyPassword = useAction(api.users.changeMyPassword);

  // Profile fields
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [profileError, setProfileError] = React.useState<string | null>(null);
  const [profileSaved, setProfileSaved] = React.useState(false);
  const [savingProfile, setSavingProfile] = React.useState(false);

  // Password fields
  const [currentPw, setCurrentPw] = React.useState("");
  const [newPw, setNewPw] = React.useState("");
  const [confirmPw, setConfirmPw] = React.useState("");
  const [pwError, setPwError] = React.useState<string | null>(null);
  const [pwSaved, setPwSaved] = React.useState(false);
  const [savingPw, setSavingPw] = React.useState(false);

  // Seed fields when the dialog opens / profile loads
  React.useEffect(() => {
    if (open && me) {
      setName(me.name || "");
      setEmail(me.email || "");
      setPhone(me.phone || "");
      setProfileError(null);
      setProfileSaved(false);
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
      setPwError(null);
      setPwSaved(false);
    }
  }, [open, me]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setProfileError(null);
    setProfileSaved(false);
    setSavingProfile(true);
    try {
      await updateMyProfile({
        name: name.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        token,
      });
      setProfileSaved(true);
    } catch (err: unknown) {
      setProfileError(err instanceof Error ? err.message : "Failed to update profile.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setPwError(null);
    setPwSaved(false);
    if (newPw.length < 8) {
      setPwError("New password must be at least 8 characters.");
      return;
    }
    if (newPw !== confirmPw) {
      setPwError("New password and confirmation do not match.");
      return;
    }
    setSavingPw(true);
    try {
      await changeMyPassword({ currentPassword: currentPw, newPassword: newPw, token });
      setPwSaved(true);
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
    } catch (err: unknown) {
      setPwError(err instanceof Error ? err.message : "Failed to change password.");
    } finally {
      setSavingPw(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <UserCircle className="h-4 w-4 text-primary" /> My Profile
          </DialogTitle>
          <DialogDescription className="text-xs">
            Update your contact details and password. Your role is set by an administrator.
          </DialogDescription>
        </DialogHeader>

        {me === undefined ? (
          <div className="py-8 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : (
          <div className="space-y-6 py-2">
            {/* Role (read-only) */}
            <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2">
              <span className="text-xs font-semibold text-foreground">Role</span>
              <Badge variant="success">{me?.role?.replaceAll("_", " ")}</Badge>
            </div>

            {/* Profile form */}
            <form onSubmit={handleSaveProfile} className="space-y-3">
              {profileError && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-xs flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{profileError}</span>
                </div>
              )}
              {profileSaved && (
                <div className="p-3 bg-[--success]/10 border border-[--success]/20 rounded-lg text-[--success] text-xs flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>Profile updated.</span>
                </div>
              )}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Full Name</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} required className="text-xs h-9" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Email</label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="text-xs h-9" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Phone</label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="text-xs h-9" />
                </div>
              </div>
              <div className="flex justify-end">
                <Button type="submit" size="sm" disabled={savingProfile} className="text-xs h-8 gap-1.5 font-semibold">
                  {savingProfile && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save Profile
                </Button>
              </div>
            </form>

            <div className="border-t border-border" />

            {/* Change password */}
            <form onSubmit={handleChangePassword} className="space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-foreground">
                <KeyRound className="h-3.5 w-3.5 text-[--warning]" /> Change Password
              </div>
              {pwError && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-xs flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{pwError}</span>
                </div>
              )}
              {pwSaved && (
                <div className="p-3 bg-[--success]/10 border border-[--success]/20 rounded-lg text-[--success] text-xs flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>Password changed.</span>
                </div>
              )}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Current Password</label>
                <Input type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} required className="text-xs h-9" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">New Password</label>
                  <Input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} required minLength={8} placeholder="Min 8 chars" className="text-xs h-9" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Confirm New</label>
                  <Input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} required className="text-xs h-9" />
                </div>
              </div>
              <div className="flex justify-end">
                <Button type="submit" size="sm" variant="outline" disabled={savingPw} className="text-xs h-8 gap-1.5 font-semibold">
                  {savingPw && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Update Password
                </Button>
              </div>
            </form>
          </div>
        )}

        <DialogFooter className="pt-2">
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)} className="text-xs h-8">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
