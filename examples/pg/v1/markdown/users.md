# users

## users

User accounts table storing basic user information

### Columns

| Name | Type | Default | Nullable | Children | Parents | Comment |
|------|------|---------|----------|----------|---------|---------|
| **id** | serial | - | NO | [posts.author_id](./posts.md), [comments.author_id](./comments.md) | - | Auto-generated unique identifier |
| name | varchar(100) | - | NO | - | - | User's display name |
| email | varchar(255) | - | NO | - | - | Email address (must be unique) |
| active | boolean | `true` | YES | - | - | Whether the user account is active |
| created_at | timestamp | `now()` | YES | - | - | Timestamp when the user was created |

### Indexes

| Name | Columns | Unique | Type |
|------|---------|--------|------|
| users_email_idx | email | NO | - |

### Relations

| Parent | Child | Type |
|--------|-------|------|
| **[users.id](./users.md)** | [posts.author_id](./posts.md) | Many to One |
| **[users.id](./users.md)** | [comments.author_id](./comments.md) | Many to One |
