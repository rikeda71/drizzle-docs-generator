# tags

## tags

Tags for categorizing posts

### Columns

| Name   | Type    | Default     | Nullable | Children                           | Parents | Comment                          |
| ------ | ------- | ----------- | -------- | ---------------------------------- | ------- | -------------------------------- |
| **id** | integer | -           | NO       | [post_tags.tag_id](./post_tags.md) | -       | Auto-generated unique identifier |
| name   | text    | -           | NO       | -                                  | -       | Tag name (must be unique)        |
| color  | text    | `'#000000'` | YES      | -                                  | -       | Tag color for display            |

### Constraints

| Name             | Type   | Definition |
| ---------------- | ------ | ---------- |
| tags_name_unique | UNIQUE | (name)     |

### Relations

| Parent                   | Child                              | Type        |
| ------------------------ | ---------------------------------- | ----------- |
| **[tags.id](./tags.md)** | [post_tags.tag_id](./post_tags.md) | Many to One |
