import { request, getToken } from './api';

const BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export const topicQuestionApi = {
  list: (params = {}) => {
    const query = new URLSearchParams();
    if (params.search) query.set('search', params.search);
    if (params.topic) query.set('topic', params.topic);
    if (params.status) query.set('status', params.status);
    const qs = query.toString();
    return request(`/admin/topic-questions${qs ? `?${qs}` : ''}`);
  },

  update: (id, payload) =>
    request(`/admin/topic-questions/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: payload,
    }),

  deleteSubmission: (id) =>
    request(`/admin/topic-questions/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  deleteQuestion: (submissionId, questionId) =>
    request(
      `/admin/topic-questions/${encodeURIComponent(submissionId)}/questions/${encodeURIComponent(questionId)}`,
      {
        method: 'DELETE',
      }
    ),

  downloadCsv: async () => {
    const token = getToken();
    const res = await fetch(`${BASE_URL}/api/v1/admin/topic-questions/export`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    if (!res.ok) {
      throw new Error('Failed to download CSV');
    }

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ciim2026-doctor-questions-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  },
};

