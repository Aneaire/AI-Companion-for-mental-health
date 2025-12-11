import type { User } from '@/lib/appwriteSchema';

export interface UserListResponse {
  users: User[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalUsers: number;
    hasNext: boolean;
    hasPrev: boolean;
    limit: number;
  };
  search: string;
  sortBy: string;
  sortOrder: string;
}

export interface UserListParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: 'createdAt' | 'email' | 'firstName' | 'lastName';
  sortOrder?: 'asc' | 'desc';
  filterType?: 'all' | 'roles' | 'admin-users';
  token?: string;
}

export const getUsers = async (params: UserListParams = {}): Promise<UserListResponse> => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      sortBy = 'createdAt',
      sortOrder = 'desc',
      filterType = 'all',
      token
    } = params;

    if (!token) {
      throw new Error('Authentication token is required');
    }

    const queryParams = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      search,
      sortBy,
      sortOrder,
      filterType,
    });

    const response = await fetch(`/api/admin/users?${queryParams}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch users: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching users:', error);
    throw error;
  }
};

export const updateUserRole = async (userId: number, newRole: string, token: string): Promise<{ success: boolean; message: string }> => {
  try {
    if (!token) {
      throw new Error('Authentication token is required');
    }

    const response = await fetch(`/api/role-management/users/${userId}/role`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ newRole }),
    });

    if (!response.ok) {
      throw new Error(`Failed to update user role: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error updating user role:', error);
    throw error;
  }
};

export const userService = {
  getUsers,
  updateUserRole,
};