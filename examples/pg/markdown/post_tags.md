# post_tags

## post_tags

Join table for many-to-many relationship between posts and tags

### Columns

| Name | Type | Default | Nullable | Children | Parents | Comment |
|------|------|---------|----------|----------|---------|---------|
| post_id | integer | - | NO | - | [posts.id](#posts) | ID of the post |
| tag_id | integer | - | NO | - | [tags.id](#tags) | ID of the tag |

### Constraints

| Name | Type | Definition |
|------|------|------------|
| pk_post_id_tag_id | PRIMARY KEY | (post_id, tag_id) |
| fk_post_id_posts | FOREIGN KEY | (post_id) → posts(id) |
| fk_tag_id_tags | FOREIGN KEY | (tag_id) → tags(id) |

### Relations

| Parent | Child | Type |
|--------|-------|------|
| [posts.id](#posts) | **[post_tags.post_id](#post-tags)** | Many to One |
| [tags.id](#tags) | **[post_tags.tag_id](#post-tags)** | Many to One |