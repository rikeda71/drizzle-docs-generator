# users

## users

User accounts table storing basic user information

### Columns

| Name | Type | Default | Nullable | Children | Parents | Comment |
|------|------|---------|----------|----------|---------|---------|
| **id** | integer | - | NO | [comments.author_id](#comments), [posts.author_id](#posts) | - | Auto-generated unique identifier |
| name | text | - | NO | - | - | User's display name |
| email | text | - | NO | - | - | Email address (must be unique) |
| active | integer | `true` | YES | - | - | Whether the user account is active |
| created_at | integer | - | YES | - | - | Timestamp when the user was created (stored as unix timestamp) |

### Indexes

| Name | Columns | Unique | Type |
|------|---------|--------|------|
| users_email_idx | email | NO | - |

### Relations

| Parent | Child | Type |
|--------|-------|------|
| **[users.id](#users)** | [comments.author_id](#comments) | Many to One |
| **[users.id](#users)** | [posts.author_id](#posts) | Many to One |