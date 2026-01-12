# posts

## posts

Blog posts created by users

### Columns

| Name | Type | Default | Nullable | Children | Parents | Comment |
|------|------|---------|----------|----------|---------|---------|
| **id** | serial | - | NO | [comments.post_id](#comments), [post_tags.post_id](#post-tags) | - | Auto-generated unique identifier |
| title | varchar(200) | - | NO | - | - | Post title |
| content | text | - | YES | - | - | Post content body |
| published | boolean | `false` | YES | - | - | Whether the post is published |
| author_id | int | - | NO | - | [users.id](#users) | ID of the post author |
| created_at | timestamp | `(now())` | YES | - | - | Timestamp when the post was created |

### Constraints

| Name | Type | Definition |
|------|------|------------|
| fk_author_id_users | FOREIGN KEY | (author_id) → users(id) |

### Indexes

| Name | Columns | Unique | Type |
|------|---------|--------|------|
| posts_author_idx | author_id | NO | - |

### Relations

| Parent | Child | Type |
|--------|-------|------|
| **[posts.id](#posts)** | [comments.post_id](#comments) | Many to One |
| **[posts.id](#posts)** | [post_tags.post_id](#post-tags) | Many to One |
| [users.id](#users) | **[posts.author_id](#posts)** | Many to One |