import { Client, Account, Databases, ID, Query } from 'appwrite';

export const client = new Client()
  .setEndpoint(import.meta.env.VITE_APPWRITE_ENDPOINT || 'https://sgp.cloud.appwrite.io/v1')
  .setProject(import.meta.env.VITE_APPWRITE_PROJECT_ID || '');

export const account = new Account(client);
export const databases = new Databases(client);

// Database and Collection IDs
export const DATABASE_ID = import.meta.env.VITE_APPWRITE_DATABASE_ID || 'default';

// Collections for counselor conversations
export const COUNSELOR_REQUESTS_COLLECTION = 'counselor_requests';
export const COUNSELOR_CHATS_COLLECTION = 'counselor_chats';
export const COUNSELOR_MESSAGES_COLLECTION = 'counselor_messages';

export { ID, Query };