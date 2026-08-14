import BuilderSetupGate from '@/components/builder/BuilderSetupGate';

/** WordPress path — setup gate only (domain step after site/business questions). */
const UnifiedBuilderWizard = () => <BuilderSetupGate targetMethod="wordpress" />;

export default UnifiedBuilderWizard;
