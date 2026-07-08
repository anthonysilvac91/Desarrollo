import api from '@/lib/api';

export interface CreateInvitationData {
  email: string;
  role: 'ADMIN' | 'WORKER' | 'EXTERNAL';
  organization_id?: string;
  owner_id?: string;
  asset_access_mode?: 'UNRESTRICTED' | 'RESTRICTED';
  asset_ids?: string[];
  language?: 'en' | 'es';
}

export const invitationsService = {
  async create(data: CreateInvitationData) {
    const res = await api.post<{ message: string; id: string }>('/invitations', data);
    return res.data;
  },
};
