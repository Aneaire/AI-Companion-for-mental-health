# Appwrite Database Manual Setup Guide

Since the automated setup encountered permission issues, please follow these steps to manually create the Appwrite database and collections.

## 🔧 Step 1: Create/Verify Appwrite Project

1. Go to [Appwrite Console](https://cloud.appwrite.io)
2. Sign in or create an account
3. Create a new project or use an existing one
4. Note your **Project ID** from the project settings

## 🔧 Step 2: Generate API Key

1. In your project dashboard, go to **Settings** → **API Keys**
2. Create a new API key with the following permissions:
   - **Databases**: Read, Write, Delete
   - **Collections**: Read, Write, Delete
   - **Documents**: Read, Write, Delete
3. Copy the API key (it starts with "standard_")

## 🔧 Step 3: Update Environment Variables

Update your `.env.local` file with the correct values:

```bash
# Appwrite Configuration
VITE_APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
VITE_APPWRITE_PROJECT_ID=your-actual-project-id
VITE_APPWRITE_DATABASE_ID=ai-companion-db
VITE_APPWRITE_MCP_API_KEY=your-actual-api-key
```

## 🔧 Step 4: Create Database

1. In Appwrite Console, go to **Databases**
2. Click **Create Database**
3. Enter:
   - **Database ID**: `ai-companion-db`
   - **Name**: `AI Companion Database`
4. Click **Create**

## 🔧 Step 5: Create Collections

### Collection 1: counselor_requests

1. Click **Create Collection**
2. Enter:
   - **Collection ID**: `counselor_requests`
   - **Name**: `Counselor Requests`
3. Add the following attributes:

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

### Collection 2: counselor_chats

1. Click **Create Collection**
2. Enter:
   - **Collection ID**: `counselor_chats`
   - **Name**: `Counselor Chats`
3. Add the following attributes:

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

### Collection 3: counselor_messages

1. Click **Create Collection**
2. Enter:
   - **Collection ID**: `counselor_messages`
   - **Name**: `Counselor Messages`
3. Add the following attributes:

| Attribute | Type | Size | Required | Default |
|-----------|------|------|----------|---------|
| chatId | String | 255 | ✅ | - |
| senderId | String | 255 | ✅ | - |
| senderType | String | 20 | ✅ | - |
| message | String | 5000 | ✅ | - |
| messageType | String | 20 | ✅ | text |
| isRead | Boolean | - | ❌ | false |
| timestamp | DateTime | - | ❌ | - |

## 🔧 Step 6: Set Permissions

### counselor_requests Collection Permissions

Go to **Settings** tab in the collection and add these permissions:

```
Create: role:member
Read: user:{userId}
Update: user:{userId} OR role:member
Delete: role:member
```

### counselor_chats Collection Permissions

```
Create: role:member
Read: user:{userId} OR user:{adminId}
Update: role:member
Delete: role:member
```

### counselor_messages Collection Permissions

```
Create: user:{userId} OR user:{adminId}
Read: user:{userId} OR user:{adminId}
Update: user:{senderId}
Delete: role:member
```

## 🔧 Step 7: Update MCP Configuration

Update your `opencode.json` with the correct project ID and API key:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "appwrite": {
      "type": "local",
      "command": [
        "uvx",
        "mcp-server-appwrite",
        "--sites",
        "--databases"
      ],
      "enabled": true,
      "environment": {
        "APPWRITE_PROJECT_ID": "your-actual-project-id",
        "APPWRITE_API_KEY": "your-actual-api-key",
        "APPWRITE_ENDPOINT": "https://cloud.appwrite.io/v1"
      }
    }
  }
}
```

## 🔧 Step 8: Test the Setup

1. Restart your development server
2. Navigate to `/counselor` in your app
3. Try creating a counselor request
4. Check the Appwrite console to see if data appears

## 🚨 Troubleshooting

### Common Issues

1. **"Project not found"**: Double-check your Project ID in the Appwrite console
2. **"Unauthorized"**: Ensure your API key has the correct permissions
3. **"Collection not found"**: Verify collection names match exactly (case-sensitive)
4. **"Permission denied"**: Check collection permissions in Appwrite console

### Verification Steps

1. **Test API Connection**: Use the Appwrite console's API playground
2. **Check Environment Variables**: Ensure all variables are correctly set
3. **Verify Permissions**: Make sure your API key has database and collection permissions
4. **Test with Simple Data**: Try creating a simple document first

## 📋 Next Steps

Once the database is set up:

1. ✅ Test creating counselor requests
2. ✅ Test chat functionality
3. ✅ Verify real-time updates work
4. ✅ Set up admin dashboard for managing requests
5. ✅ Implement notification system

## 🎯 Success Criteria

Your setup is complete when:

- [ ] Database `ai-companion-db` exists
- [ ] All three collections are created with correct attributes
- [ ] Permissions are properly configured
- [ ] Frontend can connect to Appwrite
- [ ] You can create and read counselor requests
- [ ] Real-time updates are working

---

**Note**: If you continue to experience issues, consider creating a fresh Appwrite project with a new API key to ensure clean permissions.