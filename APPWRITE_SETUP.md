# Appwrite Database Setup Guide

This guide will help you set up Appwrite database for the counselor conversation system.

## Prerequisites

1. Create an Appwrite account at [https://appwrite.io](https://appwrite.io)
2. Create a new project
3. Note down your Project ID, Endpoint URL, and generate an API Key

## Environment Variables

Add these to your `.env` file (root) and `.env.local` (frontend):

```bash
# Appwrite Configuration
VITE_APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
VITE_APPWRITE_PROJECT_ID=your-appwrite-project-id
VITE_APPWRITE_DATABASE_ID=your-appwrite-database-id
```

## Database Setup

### 1. Create Database

1. Go to your Appwrite console
2. Navigate to "Databases"
3. Click "Create Database"
4. Name it `ai-companion-db` (or your preferred name)
5. Note the Database ID

### 2. Create Collections

Create the following collections with the specified attributes:

#### Collection: `counselor_requests`

| Attribute | Type | Size | Required | Default |
|-----------|------|------|----------|---------|
| userId | String | 255 | ✅ | - |
| adminId | String | 255 | ❌ | - |
| status | String | 20 | ✅ | pending |
| requestReason | String | 2000 | ✅ | - |
| urgencyLevel | String | 10 | ✅ | medium |
| userContext | String | 5000 | ❌ | - |
| requestedAt | DateTime | - | ❌ | - |
| acceptedAt | DateTime | - | ❌ | - |
| completedAt | DateTime | - | ❌ | - |
| adminNotes | String | 2000 | ❌ | - |
| satisfactionRating | Integer | - | ❌ | - |

#### Collection: `counselor_chats`

| Attribute | Type | Size | Required | Default |
|-----------|------|------|----------|---------|
| requestId | String | 255 | ✅ | - |
| userId | String | 255 | ✅ | - |
| adminId | String | 255 | ✅ | - |
| status | String | 20 | ✅ | active |
| startedAt | DateTime | - | ❌ | - |
| endedAt | DateTime | - | ❌ | - |
| messageCount | Integer | - | ❌ | 0 |
| sessionDuration | Integer | - | ❌ | - |
| transferReason | String | 1000 | ❌ | - |
| adminSummary | String | 3000 | ❌ | - |

#### Collection: `counselor_messages`

| Attribute | Type | Size | Required | Default |
|-----------|------|------|----------|---------|
| chatId | String | 255 | ✅ | - |
| senderId | String | 255 | ✅ | - |
| senderType | String | 20 | ✅ | - |
| message | String | 5000 | ✅ | - |
| messageType | String | 20 | ✅ | text |
| isRead | Boolean | - | ❌ | false |
| timestamp | DateTime | - | ❌ | - |

### 3. Set Permissions

For each collection, set the following permissions:

#### counselor_requests
- **Create**: Any authenticated user
- **Read**: Users can read their own requests (`userId` matches their ID)
- **Update**: Users can update their own requests, admins can update any
- **Delete**: Admins only

#### counselor_chats
- **Create**: Admins only
- **Read**: Users can read chats they're part of (`userId` or `adminId` matches their ID)
- **Update**: Admins only
- **Delete**: Admins only

#### counselor_messages
- **Create**: Users and admins in the chat
- **Read**: Users and admins in the chat
- **Update**: Message sender only
- **Delete**: Admins only

### 4. Update Environment Variables

Update your `.env` files with the actual values:

```bash
VITE_APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
VITE_APPWRITE_PROJECT_ID=your-actual-project-id
VITE_APPWRITE_DATABASE_ID=your-actual-database-id
```

## Testing the Setup

1. Start your development server: `bun run dev:all`
2. Navigate to `/counselor` in your app
3. Try creating a counselor request
4. Check the Appwrite console to see if data is being created

## Migration from PostgreSQL

If you have existing data in PostgreSQL, you'll need to:

1. Export existing counselor data from PostgreSQL
2. Transform the data to match Appwrite's document structure
3. Import the data into Appwrite collections
4. Update user IDs to match Clerk user IDs

## Features Implemented

- ✅ Real-time messaging with Appwrite
- ✅ Counselor request management
- ✅ Chat session tracking
- ✅ Message history
- ✅ Read/unread status
- ✅ User authentication integration with Clerk

## Troubleshooting

### Common Issues

1. **Permission Denied**: Check collection permissions in Appwrite console
2. **Collection Not Found**: Verify collection names match exactly
3. **Invalid Environment Variables**: Ensure all Appwrite env vars are set correctly
4. **CORS Issues**: Make sure your frontend domain is added to Appwrite's allowed domains

### Debug Tips

- Check browser console for Appwrite errors
- Use Appwrite's real-time logs to monitor API calls
- Verify user authentication status with Clerk
- Test with different user roles (user vs admin)

## Next Steps

1. Implement admin dashboard for managing counselor requests
2. Add file upload support for chat attachments
3. Implement notification system for new messages
4. Add analytics and reporting features
5. Set up automated backups