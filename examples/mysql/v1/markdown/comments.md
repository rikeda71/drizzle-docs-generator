# comments

## comments

Comments on posts

### Columns

| Name | Type | Default | Nullable | Children | Parents | Comment |
|------|------|---------|----------|----------|---------|---------|
| **id** | serial | - | NO | - | - | Auto-generated unique identifier |
| body | text | - | NO | - | - | Comment text |
| post_id | int | - | NO | - | [posts.id](./posts.md) | ID of the post this comment belongs to |
| author_id | int | - | NO | - | [users.id](./users.md) | ID of the user who wrote the comment |
| created_at | timestamp | `(now())` | YES | - | - | Timestamp when the comment was created |

### Constraints

| Name | Type | Definition |
|------|------|------------|
| fk_post_id_posts | FOREIGN KEY | (post_id) → posts(id) |
| fk_author_id_users | FOREIGN KEY | (author_id) → users(id) |

### Relations

| Parent | Child | Type |
|--------|-------|------|
| [posts.id](./posts.md) | **[comments.post_id](./comments.md)** | Many to One |
| [users.id](./users.md) | **[comments.author_id](./comments.md)** | Many to One |
