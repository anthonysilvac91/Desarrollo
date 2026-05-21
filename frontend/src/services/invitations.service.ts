import api from '@/lib/api';

export interface CreateInvitationData {
  email: string;
  role: 'ADMIN' | 'WORKER' | 'EXTERNAL';
  owner_id?: string;
}

export const invitationsService = {
  async create(data: CreateInvitationData) {
    const res = await api.post<{ message: string; id: string }>('/invitations', data);
    return res.data;
  },
};
