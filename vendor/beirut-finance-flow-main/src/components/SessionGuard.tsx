import { useSessionGuard } from "@/hooks/useSessionGuard";

const SessionGuard = () => {
  useSessionGuard();
  return null;
};

export default SessionGuard;
