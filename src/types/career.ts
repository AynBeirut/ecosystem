export type FreelancerTrack = 'designer_builder' | 'accounting';

export type CareerApplicationStatus = 'pending' | 'approved' | 'rejected';

export type CareerApplication = {
  id: string;
  track: FreelancerTrack;
  name: string;
  email: string;
  phone?: string;
  portfolioUrl?: string;
  message?: string;
  status: CareerApplicationStatus;
  applicantUid?: string;
  createdAt: string;
  updatedAt: string;
};

export type PlatformFreelancer = {
  track: FreelancerTrack;
  status: 'active' | 'pending' | 'suspended';
  displayName: string;
  email: string;
  phone?: string;
  portfolioUrl?: string;
  clientStoreIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type AccountingTestSandbox = {
  id: string;
  name: string;
  moduleFocus?: string;
  storeId?: string;
  status: 'draft' | 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
};
