# post_tags

## post_tags

Join table for many-to-many relationship between posts and tags

### Columns

| Name    | Type    | Default | Nullable | Children | Parents                | Comment        |
| ------- | ------- | ------- | -------- | -------- | ---------------------- | -------------- |
| post_id | integer | -       | NO       | -        | [posts.id](./posts.md) | ID of the post |
| tag_id  | integer | -       | NO       | -        | [tags.id](./tags.md)   | ID of the tag  |

### Constraints

| Name              | Type        | Definition            |
| ----------------- | ----------- | --------------------- |
| pk_post_id_tag_id | PRIMARY KEY | (post_id, tag_id)     |
| fk_post_id_posts  | FOREIGN KEY | (post_id) → posts(id) |
| fk_tag_id_tags    | FOREIGN KEY | (tag_id) → tags(id)   |

### Relations

| Parent                 | Child                                   | Type        |
| ---------------------- | --------------------------------------- | ----------- |
| [posts.id](./posts.md) | **[post_tags.post_id](./post_tags.md)** | Many to One |
| [tags.id](./tags.md)   | **[post_tags.tag_id](./post_tags.md)**  | Many to One |
