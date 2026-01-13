# posts

## posts

Blog posts created by users

### Columns

| Name       | Type    | Default | Nullable | Children                                                               | Parents                | Comment                             |
| ---------- | ------- | ------- | -------- | ---------------------------------------------------------------------- | ---------------------- | ----------------------------------- |
| **id**     | integer | -       | NO       | [comments.post_id](./comments.md), [post_tags.post_id](./post_tags.md) | -                      | Auto-generated unique identifier    |
| title      | text    | -       | NO       | -                                                                      | -                      | Post title                          |
| content    | text    | -       | YES      | -                                                                      | -                      | Post content body                   |
| published  | integer | `false` | YES      | -                                                                      | -                      | Whether the post is published       |
| author_id  | integer | -       | NO       | -                                                                      | [users.id](./users.md) | ID of the post author               |
| created_at | integer | -       | YES      | -                                                                      | -                      | Timestamp when the post was created |

### Constraints

| Name               | Type        | Definition              |
| ------------------ | ----------- | ----------------------- |
| fk_author_id_users | FOREIGN KEY | (author_id) → users(id) |

### Indexes

| Name             | Columns   | Unique | Type |
| ---------------- | --------- | ------ | ---- |
| posts_author_idx | author_id | NO     | -    |

### Relations

| Parent                     | Child                               | Type        |
| -------------------------- | ----------------------------------- | ----------- |
| [users.id](./users.md)     | **[posts.author_id](./posts.md)**   | Many to One |
| **[posts.id](./posts.md)** | [comments.post_id](./comments.md)   | Many to One |
| **[posts.id](./posts.md)** | [post_tags.post_id](./post_tags.md) | Many to One |
